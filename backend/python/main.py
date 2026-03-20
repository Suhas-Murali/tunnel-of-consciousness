import logging
import os
from pathlib import Path
import re
import time
import uuid

import networkx as nx
import torch
from argostranslate import package as argos_package
from argostranslate import translate as argos_translate
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import pipeline
from typing import Any, Dict, List

LOG_LEVEL = os.getenv("PY_SERVICE_LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] [py-ai] %(message)s",
)
logger = logging.getLogger("py-ai-service")


def load_service_env() -> None:
    project_env = Path(__file__).resolve().parent.parent / ".env"
    local_env = Path(__file__).resolve().parent / ".env"

    loaded_project_env = load_dotenv(project_env)
    loaded_local_env = load_dotenv(local_env)
    logger.info(
        "Environment loaded projectEnv=%s localEnv=%s",
        loaded_project_env,
        loaded_local_env,
    )


load_service_env()

app = FastAPI(title="Modular Script Intelligence")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Allow your React app
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods (POST, GET, OPTIONS, etc.)
    allow_headers=["*"],  # Allow all headers
)

# --- CONFIGURATION ---
SUMMARIZATION_MODEL = "sshleifer/distilbart-cnn-12-6"
EMOTION_MODEL = "j-hartmann/emotion-english-distilroberta-base"
SENTIMENT_MODEL = "distilbert-base-uncased-finetuned-sst-2-english"
SUPPORTED_TRANSLATION_LANGUAGES = {"en", "hi", "kn"}
REQUIRED_TRANSLATION_PAIRS = [("hi", "en"), ("kn", "en")]
TRANSLATION_DEVICE = int(os.getenv("TRANSLATION_DEVICE", "-1"))
HF_TRANSLATION_MODELS = {
    "hi": "Helsinki-NLP/opus-mt-hi-en",
    "kn": "Helsinki-NLP/opus-mt-kn-en",
}

device = 0 if torch.cuda.is_available() else -1
logger.info("Service booting on %s", "GPU" if device == 0 else "CPU")
logger.info(
    "HF translation fallback device=%s",
    "GPU" if TRANSLATION_DEVICE == 0 else "CPU",
)

models = {}
translation_ready = {f"{src}->{dst}": False for src, dst in REQUIRED_TRANSLATION_PAIRS}
translation_backend = {f"{src}->{dst}": "unavailable" for src, dst in REQUIRED_TRANSLATION_PAIRS}
hf_translators: Dict[str, Any] = {}


def get_hf_token() -> str:
    token = (
        os.getenv("HUGGINGFACE_API_TOKEN")
        or os.getenv("HF_TOKEN")
        or os.getenv("HUGGING_FACE_HUB_TOKEN")
    )

    if token:
        # Normalize env names so downstream huggingface_hub calls can discover token.
        os.environ["HF_TOKEN"] = token
        os.environ["HUGGING_FACE_HUB_TOKEN"] = token

    return token or ""


def is_translation_pair_installed(source: str, target: str) -> bool:
    installed_languages = argos_translate.get_installed_languages()
    from_lang = next((lang for lang in installed_languages if lang.code == source), None)
    to_lang = next((lang for lang in installed_languages if lang.code == target), None)
    if not from_lang or not to_lang:
        return False

    try:
        from_lang.get_translation(to_lang)
        return True
    except Exception:
        return False


def ensure_translation_pair(source: str, target: str) -> bool:
    pair_key = f"{source}->{target}"

    if is_translation_pair_installed(source, target):
        logger.info("Argos translation pair already installed: %s", pair_key)
        return True

    logger.warning("Argos translation pair %s missing. Attempting install...", pair_key)
    try:
        argos_package.update_package_index()
        available_packages = argos_package.get_available_packages()
        package = next(
            (pkg for pkg in available_packages if pkg.from_code == source and pkg.to_code == target),
            None,
        )

        if package is None:
            logger.error("Argos package not found for pair %s", pair_key)
            return False

        download_path = package.download()
        argos_package.install_from_path(download_path)
        installed = is_translation_pair_installed(source, target)
        if installed:
            logger.info("Argos translation pair installed successfully: %s", pair_key)
        else:
            logger.error("Argos install completed but pair is still unavailable: %s", pair_key)
        return installed
    except Exception:
        logger.exception("Failed to install Argos translation pair %s", pair_key)
        return False


def ensure_hf_translation_backend(source: str, target: str) -> bool:
    pair_key = f"{source}->{target}"
    if pair_key in hf_translators:
        return True

    model_name = HF_TRANSLATION_MODELS.get(source)
    if not model_name:
        logger.error("No HF fallback model configured for pair %s", pair_key)
        return False

    logger.warning(
        "Attempting HF fallback translator for %s using model=%s",
        pair_key,
        model_name,
    )

    hf_token = get_hf_token()
    if hf_token:
        logger.info("HF token found in env for fallback model bootstrap pair=%s", pair_key)
    else:
        logger.warning("HF token not found. Fallback model bootstrap will use public access pair=%s", pair_key)

    try:
        if hf_token:
            hf_translators[pair_key] = pipeline(
                "translation",
                model=model_name,
                device=TRANSLATION_DEVICE,
                token=hf_token,
            )
        else:
            hf_translators[pair_key] = pipeline(
                "translation",
                model=model_name,
                device=TRANSLATION_DEVICE,
            )

        logger.info("HF fallback translator ready for %s", pair_key)
        return True
    except Exception as exc:
        message = str(exc).lower()
        is_auth_failure = "401" in message or "unauthorized" in message

        if hf_token and is_auth_failure:
            logger.warning(
                "HF fallback bootstrap got auth failure for %s; retrying without token (public model path)",
                pair_key,
            )
            try:
                hf_translators[pair_key] = pipeline(
                    "translation",
                    model=model_name,
                    device=TRANSLATION_DEVICE,
                )
                logger.info("HF fallback translator ready for %s after no-token retry", pair_key)
                return True
            except Exception:
                logger.exception(
                    "Failed to initialize HF fallback translator for %s even after no-token retry",
                    pair_key,
                )
                return False

        logger.exception("Failed to initialize HF fallback translator for %s", pair_key)
        return False


def ensure_translation_backend(source: str, target: str) -> bool:
    pair_key = f"{source}->{target}"
    if ensure_translation_pair(source, target):
        translation_ready[pair_key] = True
        translation_backend[pair_key] = "argos"
        return True

    if ensure_hf_translation_backend(source, target):
        translation_ready[pair_key] = True
        translation_backend[pair_key] = "hf"
        logger.warning(
            "Using HF fallback for %s because Argos package is unavailable",
            pair_key,
        )
        return True

    translation_ready[pair_key] = False
    translation_backend[pair_key] = "unavailable"
    return False


def chunk_text_for_translation(text: str, max_chars: int = 350) -> List[str]:
    if len(text) <= max_chars:
        return [text]

    chunks = []
    current_lines = []
    current_len = 0
    for line in text.split("\n"):
        next_len = len(line) + 1
        if current_lines and (current_len + next_len > max_chars):
            chunks.append("\n".join(current_lines))
            current_lines = [line]
            current_len = next_len
        else:
            current_lines.append(line)
            current_len += next_len

    if current_lines:
        chunks.append("\n".join(current_lines))

    return chunks


def translate_with_hf(text: str, source: str, target: str) -> str:
    pair_key = f"{source}->{target}"
    translator = hf_translators.get(pair_key)
    if translator is None:
        raise RuntimeError(f"HF translator for {pair_key} not initialized")

    chunks = chunk_text_for_translation(text)
    translated_chunks = []
    for index, chunk in enumerate(chunks):
        result = translator(chunk)
        translated_chunk = result[0].get("translation_text", chunk) if result else chunk
        translated_chunks.append(translated_chunk)
        logger.info(
            "[Translate][HF] pair=%s chunk=%s/%s inChars=%s outChars=%s",
            pair_key,
            index + 1,
            len(chunks),
            len(chunk),
            len(translated_chunk),
        )

    return "\n".join(translated_chunks)


def bootstrap_translation_pairs() -> None:
    for source, target in REQUIRED_TRANSLATION_PAIRS:
        pair_key = f"{source}->{target}"
        ensure_translation_backend(source, target)

    logger.info("Translation readiness status: %s", translation_ready)
    logger.info("Translation backend status: %s", translation_backend)


def get_request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "unknown")

# Load models on startup
@app.on_event("startup")
async def load_models():
    logger.info("Startup sequence started")
    # Load lighter models first
    models["sentiment"] = pipeline("text-classification", model=SENTIMENT_MODEL, device=device)
    logger.info("Sentiment model loaded")
    models["emotion"] = pipeline("text-classification", model=EMOTION_MODEL, return_all_scores=True, device=device)
    logger.info("Emotion model loaded")
    # Summarizer is heaviest, load last
    models["summarizer"] = pipeline("summarization", model=SUMMARIZATION_MODEL, device=device)
    logger.info("Summarizer model loaded")
    bootstrap_translation_pairs()
    logger.info("Startup sequence completed")


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    request.state.request_id = request_id
    start = time.perf_counter()

    logger.info(
        "[REQ][%s] START method=%s path=%s",
        request_id,
        request.method,
        request.url.path,
    )
    try:
        response = await call_next(request)
    except Exception:
        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.exception(
            "[REQ][%s] FAIL method=%s path=%s durationMs=%.2f",
            request_id,
            request.method,
            request.url.path,
            elapsed_ms,
        )
        raise

    elapsed_ms = (time.perf_counter() - start) * 1000
    response.headers["x-request-id"] = request_id
    logger.info(
        "[REQ][%s] END method=%s path=%s status=%s durationMs=%.2f",
        request_id,
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    return response

# --- DATA SCHEMAS ---

class TextPayload(BaseModel):
    text: str

class SceneData(BaseModel):
    id: str
    text: str

class NetworkPayload(BaseModel):
    # List of sets of characters per scene
    # e.g. [["Shepard", "Garrus"], ["Liara", "Wrex"], ...]
    interactions: List[List[str]] 


class TranslatePayload(BaseModel):
    text: str
    sourceLanguage: str
    targetLanguage: str = "en"

# --- ENDPOINT 1: PARSING (Fast, CPU only) ---
# Used when loading a file to get the basic structure
@app.post("/parse")
async def parse_structure(payload: TextPayload, request: Request):
    """
    Fast Regex parse. Returns scenes and characters structures 
    WITHOUT running heavy AI models.
    """
    request_id = get_request_id(request)
    logger.info("[Parse][%s] chars=%s", request_id, len(payload.text))
    scenes = []
    current_scene = None
    
    # Simple screenplay regex
    scene_heading = re.compile(r'^\s*(INT\.|EXT\.|INT\./EXT\.|I/E)(.*)$', re.MULTILINE)
    
    lines = payload.text.split('\n')
    
    for line in lines:
        line = line.strip()
        if not line: continue
        
        if scene_heading.match(line):
            if current_scene: scenes.append(current_scene)
            current_scene = {
                "name": line,
                "raw_text": "",
                "characters": set(),
                "action_lines": 0, 
                "dialogue_lines": 0
            }
        
        if current_scene:
            current_scene["raw_text"] += line + "\n"
            # Detect Character (All caps, no numbers, short)
            if line.isupper() and len(line) < 30 and not scene_heading.match(line):
                char_name = line.split('(')[0].strip()
                if char_name not in ["CUT TO:", "FADE TO:"]:
                    current_scene["characters"].add(char_name)
                    current_scene["dialogue_lines"] += 1
            else:
                current_scene["action_lines"] += 1

    if current_scene: scenes.append(current_scene)
    
    # Format for JSON
    results = []
    for i, s in enumerate(scenes):
        results.append({
            "id": f"scene-{i}",
            "name": s["name"],
            "raw_text": s["raw_text"],
            "characters": list(s["characters"]),
            # Basic math metrics
            "metrics": {
                "actionRatio": (s["action_lines"] / max(1, s["action_lines"] + s["dialogue_lines"])) * 100,
                "pacing": 50 # Default, to be filled by AI later
            }
        })
        
    logger.info("[Parse][%s] extracted_scenes=%s", request_id, len(results))
    return {"scenes": results}

# --- ENDPOINT 2: SCENE ANALYSIS (Medium cost) ---
# Call this when a user finishes editing a specific scene, or lazy-load it
@app.post("/analyze_scene")
async def analyze_scene(payload: SceneData, request: Request):
    """
    Generates Summary, Sentiment, and Pacing for ONE scene.
    """
    request_id = get_request_id(request)
    text = payload.text[:1024] # Limit length
    logger.info("[AnalyzeScene][%s] id=%s chars=%s", request_id, payload.id, len(text))
    
    # 1. Summary
    try:
        if len(text) > 100:
            sum_res = models["summarizer"](text, max_length=60, min_length=5, do_sample=False)
            synopsis = sum_res[0]['summary_text']
        else:
            synopsis = text
    except Exception:
        logger.exception("[AnalyzeScene][%s] summarization failed id=%s", request_id, payload.id)
        synopsis = "Analysis failed."

    # 2. Sentiment / Pacing
    # We use sentiment to detect "Intensity" or Vibe
    try:
        sent_res = models["sentiment"](text[:512])[0]
        score = sent_res['score'] if sent_res['label'] == 'POSITIVE' else -sent_res['score']
    except Exception:
        logger.exception("[AnalyzeScene][%s] sentiment failed id=%s", request_id, payload.id)
        score = 0
        
    return {
        "id": payload.id,
        "synopsis": synopsis,
        "metrics": {
            "sentiment": score,
            # In a real app, linguistic density = syllables / second. 
            # Here we proxy it via text length vs lines
            "linguisticDensity": min(100, len(text) / 20) 
        }
    }

# --- ENDPOINT 3: CHARACTER EMOTION (Heavy cost) ---
# Call this on specific dialogue blocks or aggregated character text
@app.post("/analyze_emotion")
async def analyze_emotion(payload: TextPayload, request: Request):
    """
    Returns the dominant emotion and vector for a block of text.
    """
    request_id = get_request_id(request)
    logger.info("[AnalyzeEmotion][%s] chars=%s", request_id, len(payload.text))
    try:
        # Get probabilities for all emotions
        results = models["emotion"](payload.text[:512])[0]
        # Sort by score
        sorted_emotions = sorted(results, key=lambda x: x['score'], reverse=True)
        dominant = sorted_emotions[0]['label']
        
        return {
            "dominant": dominant,
            "breakdown": {x['label']: x['score'] for x in results}
        }
    except Exception as e:
        logger.exception("[AnalyzeEmotion][%s] failed", request_id)
        raise HTTPException(500, str(e))


@app.post("/translate")
async def translate_text(payload: TranslatePayload, request: Request):
    """
    Translates hi/kn text to English. English input is returned as-is.
    """
    request_id = get_request_id(request)
    source_language = payload.sourceLanguage.lower().strip()
    target_language = payload.targetLanguage.lower().strip()
    text = payload.text or ""

    logger.info(
        "[Translate][%s] source=%s target=%s chars=%s",
        request_id,
        source_language,
        target_language,
        len(text),
    )

    if source_language not in SUPPORTED_TRANSLATION_LANGUAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported source language '{source_language}'. Supported: en, hi, kn",
        )

    if target_language != "en":
        raise HTTPException(
            status_code=400,
            detail="Only targetLanguage='en' is currently supported",
        )

    if source_language == "en":
        logger.info("[Translate][%s] skipped translation for english input", request_id)
        return {
            "sourceLanguage": source_language,
            "targetLanguage": target_language,
            "didTranslate": False,
            "originalText": text,
            "translatedText": text,
        }

    pair_key = f"{source_language}->{target_language}"
    if not translation_ready.get(pair_key):
        logger.warning("[Translate][%s] pair not ready for %s, retrying init", request_id, pair_key)
        ensure_translation_backend(source_language, target_language)

    if not translation_ready.get(pair_key):
        raise HTTPException(
            status_code=503,
            detail=(
                f"Translation pair {pair_key} is not ready. Check service logs and ensure "
                "Argos or HF fallback model can be initialized locally."
            ),
        )

    try:
        backend = translation_backend.get(pair_key, "unavailable")
        if backend == "argos":
            translated_text = argos_translate.translate(text, source_language, target_language)
        elif backend == "hf":
            translated_text = translate_with_hf(text, source_language, target_language)
        else:
            raise RuntimeError(f"No translation backend is ready for {pair_key}")

        logger.info(
            "[Translate][%s] success source=%s target=%s backend=%s outChars=%s",
            request_id,
            source_language,
            target_language,
            backend,
            len(translated_text),
        )
        return {
            "sourceLanguage": source_language,
            "targetLanguage": target_language,
            "backend": backend,
            "didTranslate": True,
            "originalText": text,
            "translatedText": translated_text,
        }
    except Exception as e:
        logger.exception("[Translate][%s] failed", request_id)
        raise HTTPException(status_code=500, detail=str(e))

# --- ENDPOINT 4: NETWORK METRICS (Cheap) ---
# Call this whenever the character lists in scenes change
@app.post("/analyze_network")
async def analyze_network(payload: NetworkPayload, request: Request):
    """
    Calculates Influence (Centrality) based on who appears in scenes together.
    """
    request_id = get_request_id(request)
    logger.info("[AnalyzeNetwork][%s] interaction_sets=%s", request_id, len(payload.interactions))
    G = nx.Graph()
    
    # Build Graph
    for char_list in payload.interactions:
        # Add nodes
        for char in char_list:
            if not G.has_node(char): G.add_node(char)
            
        # Add edges (clique expansion)
        for i in range(len(char_list)):
            for j in range(i + 1, len(char_list)):
                u, v = char_list[i], char_list[j]
                if G.has_edge(u, v):
                    G[u][v]['weight'] += 1
                else:
                    G.add_edge(u, v, weight=1)
                    
    # Calculate Metrics
    try:
        deg = nx.degree_centrality(G)
        bet = nx.betweenness_centrality(G)
    except Exception:
        logger.exception("[AnalyzeNetwork][%s] metric computation failed", request_id)
        deg = {}
        bet = {}
        
    # Format for frontend
    results = {}
    for node in G.nodes():
        results[node] = {
            "degreeCentrality": deg.get(node, 0),
            "betweenness": bet.get(node, 0)
        }
        
    logger.info("[AnalyzeNetwork][%s] nodes=%s", request_id, len(results))
    return results

@app.get("/health")
def health():
    return {
        "status": "ready",
        "device": device,
        "translationReady": translation_ready,
        "translationBackend": translation_backend,
        "supportedLanguages": sorted(SUPPORTED_TRANSLATION_LANGUAGES),
    }