import torch
import re
import networkx as nx
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Set, Any
from transformers import pipeline
from collections import defaultdict
from fastapi.middleware.cors import CORSMiddleware

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

device = 0 if torch.cuda.is_available() else -1
print(f"Starting on {'GPU' if device == 0 else 'CPU'}...")

models = {}

# Load models on startup
@app.on_event("startup")
async def load_models():
    # Load lighter models first
    models["sentiment"] = pipeline("text-classification", model=SENTIMENT_MODEL, device=device)
    models["emotion"] = pipeline("text-classification", model=EMOTION_MODEL, return_all_scores=True, device=device)
    # Summarizer is heaviest, load last
    models["summarizer"] = pipeline("summarization", model=SUMMARIZATION_MODEL, device=device)
    print("Models Loaded")

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

# --- ENDPOINT 1: PARSING (Fast, CPU only) ---
# Used when loading a file to get the basic structure
@app.post("/parse")
async def parse_structure(payload: TextPayload):
    """
    Fast Regex parse. Returns scenes and characters structures 
    WITHOUT running heavy AI models.
    """
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
        
    return {"scenes": results}

# --- ENDPOINT 2: SCENE ANALYSIS (Medium cost) ---
# Call this when a user finishes editing a specific scene, or lazy-load it
@app.post("/analyze_scene")
async def analyze_scene(payload: SceneData):
    """
    Generates Summary, Sentiment, and Pacing for ONE scene.
    """
    text = payload.text[:1024] # Limit length
    
    # 1. Summary
    try:
        if len(text) > 100:
            sum_res = models["summarizer"](text, max_length=60, min_length=5, do_sample=False)
            synopsis = sum_res[0]['summary_text']
        else:
            synopsis = text
    except:
        synopsis = "Analysis failed."

    # 2. Sentiment / Pacing
    # We use sentiment to detect "Intensity" or Vibe
    try:
        sent_res = models["sentiment"](text[:512])[0]
        score = sent_res['score'] if sent_res['label'] == 'POSITIVE' else -sent_res['score']
    except:
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
async def analyze_emotion(payload: TextPayload):
    """
    Returns the dominant emotion and vector for a block of text.
    """
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
        raise HTTPException(500, str(e))

# --- ENDPOINT 4: NETWORK METRICS (Cheap) ---
# Call this whenever the character lists in scenes change
@app.post("/analyze_network")
async def analyze_network(payload: NetworkPayload):
    """
    Calculates Influence (Centrality) based on who appears in scenes together.
    """
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
    except:
        deg = {}
        bet = {}
        
    # Format for frontend
    results = {}
    for node in G.nodes():
        results[node] = {
            "degreeCentrality": deg.get(node, 0),
            "betweenness": bet.get(node, 0)
        }
        
    return results

@app.get("/health")
def health():
    return {"status": "ready", "device": device}