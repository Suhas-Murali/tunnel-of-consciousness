import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import pipeline

app = FastAPI(title="NER & Emotion Microservice")

# --- CONFIGURATION ---
NER_MODEL_ID = "dbmdz/bert-large-cased-finetuned-conll03-english"#"dslim/bert-base-NER"#
EMOTION_MODEL_ID = "j-hartmann/emotion-english-distilroberta-base"

# Auto-detect hardware
device = 0 if torch.cuda.is_available() else -1
device_name = "GPU" if device == 0 else "CPU"

print(f"Starting server on {device_name}...")

# --- LOAD MODELS (Eager Loading) ---
# We load both at startup to ensure endpoints respond instantly.
# WARNING: 'bert-large' is heavy (~1.3GB). Ensure you have ~4GB+ RAM available.

print("Loading NER model...")
try:
    # aggregation_strategy="simple" merges sub-tokens (e.g., "Hu" + "##gging" -> "Hugging")
    ner_pipeline = pipeline(
        "token-classification", 
        model=NER_MODEL_ID, 
        aggregation_strategy="simple", 
        device=device
    )
except Exception as e:
    print(f"Error loading NER model: {e}")
    ner_pipeline = None

print("Loading Emotion model...")
try:
    # return_all_scores=True gives probabilities for ALL emotions, not just the top one
    emotion_pipeline = pipeline(
        "text-classification", 
        model=EMOTION_MODEL_ID, 
        return_all_scores=True, 
        device=device
    )
except Exception as e:
    print(f"Error loading Emotion model: {e}")
    emotion_pipeline = None

print("Models loaded!")

# --- SCHEMA ---
class TextRequest(BaseModel):
    text: str

# --- ENDPOINTS ---

@app.post("/ner")
async def get_ner(request: TextRequest):
    if not ner_pipeline:
        raise HTTPException(500, "NER model not loaded")
    
    # Run inference
    results = ner_pipeline(request.text)
    
    # Make results JSON serializable (convert float32 to float)
    for entity in results:
        entity["score"] = float(entity["score"])
        
    return {"entities": results}

@app.post("/emotion")
async def get_emotion(request: TextRequest):
    if not emotion_pipeline:
        raise HTTPException(500, "Emotion model not loaded")
    
    # Run inference
    # results comes back as a list of lists [[{'label': 'joy', 'score': 0.9}, ...]]
    results = emotion_pipeline(request.text)
    
    # Sort by score descending for easier consumption on client
    sorted_emotions = sorted(results[0], key=lambda x: x['score'], reverse=True)
    
    return {"emotions": sorted_emotions}