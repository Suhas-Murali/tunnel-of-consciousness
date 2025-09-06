import argparse
import os
import json
import re
from collections import defaultdict
from transformers import pipeline
import torch
import nltk
nltk.download('punkt')
from nltk.tokenize import sent_tokenize

def get_device(device_str=None):
    if device_str:
        return device_str
    return 'cuda' if torch.cuda.is_available() else 'cpu'

def strip_front_matter(text):
    lines = text.splitlines()
    # Known front matter patterns
    ignore_patterns = [
        r'^\s*$',  # blank
        r'^\s*[A-Z0-9 \"\']{1,30}$',  # short all-caps lines (likely title)
        r'^\s*(WRITTEN BY|STORY BY|BY|SCREENPLAY BY|MARCH \d{1,2} \d{4})\s*$',  # credits/date
    ]
    scene_heading_regex = re.compile(r'^\s*(INT\.|EXT\.|EST\.|INT/EXT\.|I/E\.|INT-EXT\.|EXT-INT\.)', re.IGNORECASE)
    all_caps_regex = re.compile(r'^\s*[A-Z0-9 .,!?:\'\-]{2,}$')
    start_idx = 0
    for i, line in enumerate(lines):
        if scene_heading_regex.match(line):
            start_idx = i
            break
        if all_caps_regex.match(line) and not any(re.match(p, line) for p in ignore_patterns):
            start_idx = i
            break
    return '\n'.join(lines[start_idx:]) if start_idx < len(lines) else text

def extract_text_from_pdf(pdf_path: str) -> str:
    import PyPDF2
    text = ""
    with open(pdf_path, 'rb') as f:
        reader = PyPDF2.PdfReader(f)
        for page in reader.pages:
            text += page.extract_text() + "\n"
    return text

def extract_text_from_txt(txt_path: str) -> str:
    with open(txt_path, 'r', encoding='utf-8') as f:
        return f.read()

def normalize_character_name(name):
    name = re.sub(r'\s+', ' ', name).strip()
    name = re.sub(r'^\W+|\W+$', '', name)
    name = ' '.join([part.capitalize() for part in name.split(' ')])
    return name

def analyze_scene(scene_text, scene_heading, all_character_names, device, ner, emotion):
    lines = scene_text.splitlines()
    char_name_regex = re.compile(r'^\s*([A-Z][A-Z0-9\-\' ]{2,})\s*$')
    scene_heading_regex = re.compile(r'^\s*(INT\.|EXT\.|EST\.|INT/EXT\.|I/E\.|INT-EXT\.|EXT-INT\.)', re.IGNORECASE)
    narration_lines = []
    dialog_blocks = []
    current_char = None
    current_dialog = []
    in_dialog = False
    for line in lines:
        if scene_heading_regex.match(line):
            continue
        m = char_name_regex.match(line)
        if m and not scene_heading_regex.match(line):
            if current_char and current_dialog:
                dialog_blocks.append((current_char, current_dialog))
            current_char = m.group(1).strip()
            current_dialog = []
            in_dialog = True
        elif in_dialog and (line.strip() == '' or line.startswith(' ')):
            current_dialog.append(line.strip())
        else:
            if not in_dialog:
                narration_lines.append(line)
            else:
                if current_char and current_dialog:
                    dialog_blocks.append((current_char, current_dialog))
                current_char = None
                current_dialog = []
                in_dialog = False
                narration_lines.append(line)
    if current_char and current_dialog:
        dialog_blocks.append((current_char, current_dialog))
    # --- Narration analysis ---
    narration_text = '\n'.join([l for l in narration_lines if l.strip()])
    narration_emotion = None
    narration_summary = None
    narration_stats = {}
    if narration_text.strip():
        narration_emotion = emotion([narration_text[:512]], batch_size=1, top_k=None)[0]
        narration_emotion = max(narration_emotion, key=lambda x: x['score'])
        # Scene-level summary: fallback to first and last lines if no summarizer
        narration_lines_nonempty = [l for l in narration_lines if l.strip()]
        if len(narration_lines_nonempty) > 2:
            narration_summary = narration_lines_nonempty[0] + ' ... ' + narration_lines_nonempty[-1]
        elif narration_lines_nonempty:
            narration_summary = narration_lines_nonempty[0]
        else:
            narration_summary = ''
        # Narration stats
        narration_stats = {
            'line_count': len(narration_lines_nonempty),
            'avg_emotion_score': float(narration_emotion['score']) if narration_emotion else None
        }
    # --- Dialog analysis ---
    dialog_by_char = defaultdict(lambda: defaultdict(list))
    dialog_emotions = defaultdict(lambda: defaultdict(list))
    dialog_stats_by_char = defaultdict(lambda: defaultdict(dict))
    for char, lines in dialog_blocks:
        emotion_scores = []
        for l in lines:
            if l.strip():
                emo = emotion([l[:512]], batch_size=1, top_k=None)[0]
                emo = max(emo, key=lambda x: x['score'])
                dialog_by_char[char][scene_heading].append({
                    'line': l,
                    'emotion': emo['label'].lower(),
                    'score': emo['score']
                })
                dialog_emotions[char][scene_heading].append(emo['label'].lower())
                emotion_scores.append(emo['score'])
        # Dialog stats for this character in this scene
        if emotion_scores:
            dialog_stats_by_char[char][scene_heading] = {
                'line_count': len(emotion_scores),
                'avg_emotion_score': float(sum(emotion_scores)) / len(emotion_scores)
            }
    # --- Character appearance/emotion timeline (as before) ---
    sentences = sent_tokenize(scene_text)
    max_char_length = 512
    sentences = [s[:max_char_length] for s in sentences if len(s.strip()) > 2]
    script_char_map = {}
    for i, s in enumerate(sentences):
        for name in all_character_names:
            if re.search(r'\b' + re.escape(name) + r'\b', s, re.IGNORECASE):
                script_char_map.setdefault(i, []).append(name)
    characters = set()
    character_mentions = defaultdict(set)
    ner_results = ner(sentences, batch_size=8)
    for i, s in enumerate(sentences):
        used_names = []
        if script_char_map.get(i):
            used_names = script_char_map[i]
        else:
            current_name = []
            last_end = -1
            for ent in ner_results[i]:
                if ent['entity'].endswith('PER'):
                    word = ent['word'].strip()
                    if not word or re.match(r'^[\s\W_]*$', word):
                        continue
                    if ent['start'] == last_end + 1:
                        current_name.append(word)
                    else:
                        if current_name:
                            full_name = normalize_character_name(' '.join(current_name))
                            if len(full_name) > 2:
                                used_names.append(full_name)
                        current_name = [word]
                    last_end = ent['end']
            if current_name:
                full_name = normalize_character_name(' '.join(current_name))
                if len(full_name) > 2:
                    used_names.append(full_name)
        for name in used_names:
            characters.add(name)
            character_mentions[name].add(i)
    if not characters and not dialog_by_char:
        return {"characters": {}, "scenes": [], "narration": narration_text, "narration_emotion": narration_emotion}
    emotion_results = emotion(sentences, batch_size=8, top_k=None)
    palette = [
        '#f54242', '#4287f5', '#42f554', '#f5e142', '#a142f5', '#f57e42', '#42f5e6', '#e642f5', '#f542a7', '#42f5b9', '#b9f542', '#f5b942', '#42b9f5', '#b942f5', '#f54242'
    ]
    char_data = {}
    for idx, char in enumerate(set(list(characters) + list(dialog_by_char.keys()))):
        char_data[char] = {
            "color": palette[idx % len(palette)],
            "appearances": [],
            "emotionTimeline": [],
            "dialog": dialog_by_char[char],
            "dialog_stats": dialog_stats_by_char[char]
        }
    for char in characters:
        for i in character_mentions[char]:
            sent = sentences[i]
            emo_result = emotion_results[i]
            top = max(emo_result, key=lambda x: x['score'])
            char_data[char]["appearances"].append({
                "scene": scene_heading,
                "position": i / len(sentences),
                "emotion": (top['label'] or 'neutral').lower(),
                "sentiment": top['score'] or 0.5,
                "linkedCharacters": [],
                "text": sent
            })
            char_data[char]["emotionTimeline"].append({
                "position": i / len(sentences),
                "emotion": (top['label'] or 'neutral').lower(),
                "scene": scene_heading
            })
    char_data = {k: v for k, v in char_data.items() if v['appearances'] or v['dialog']}
    return {
        "characters": char_data,
        "narration": {
            "text": narration_text,
            "emotion": narration_emotion['label'].lower() if narration_emotion else None,
            "score": narration_emotion['score'] if narration_emotion else None,
            "summary": narration_summary,
            "stats": narration_stats
        }
    }

def analyze_script_scenes(text, device='cpu'):
    # Scene recognition regex (matches App.jsx)
    scene_regex = re.compile(r'^\s*(INT\.|EXT\.|EST\.|INT/EXT\.|I/E\.|INT-EXT\.|EXT-INT\.).*$', re.MULTILINE)
    scenes = []
    scene_headings = []
    last_index = 0
    matches = list(scene_regex.finditer(text))
    for idx, match in enumerate(matches):
        if match.start() > last_index:
            scene_text = text[last_index:match.start()].strip()
            if scene_text:
                scenes.append(scene_text)
        scene_headings.append(match.group(0).strip())
        last_index = match.end()
    # Add last scene
    if last_index < len(text):
        scene_text = text[last_index:].strip()
        if scene_text:
            scenes.append(scene_text)
    if not scenes:
        scenes = [text]
        scene_headings = ["Scene 1"]
    # Extract all-caps character names from the script
    character_name_regex = re.compile(r'^\s*([A-Z][A-Z0-9\-\' ]{2,})(?=\n|,|\(|$)', re.MULTILINE)
    all_character_names = set()
    for m in character_name_regex.finditer(text):
        name = m.group(1).strip()
        if not re.match(r'^\s*(INT\.|EXT\.|EST\.|INT/EXT\.|I/E\.|INT-EXT\.|EXT-INT\.)', name):
            all_character_names.add(name)
    all_character_names = list(all_character_names)
    # Load local pipelines once
    ner = pipeline(
        "ner",
        model="dbmdz/bert-large-cased-finetuned-conll03-english",
        tokenizer="dbmdz/bert-large-cased-finetuned-conll03-english",
        device=0 if device == 'cuda' else -1,
        batch_size=8
    )
    emotion = pipeline(
        "text-classification",
        model="j-hartmann/emotion-english-distilroberta-base",
        tokenizer="j-hartmann/emotion-english-distilroberta-base",
        device=0 if device == 'cuda' else -1,
        batch_size=8,
        top_k=None
    )
    # Analyze each scene
    scene_results = []
    for i, scene_text in enumerate(scenes):
        heading = scene_headings[i] if i < len(scene_headings) else f"Scene {i+1}"
        result = analyze_scene(scene_text, heading, all_character_names, device, ner, emotion)
        scene_results.append(result)
    # Merge all scene results
    merged = {"characters": {}, "scenes": []}
    merged["scenes"] = [
        {"label": scene_headings[i] if i < len(scene_headings) else f"Scene {i+1}", "t": i / max(1, len(scene_results))}
        for i in range(len(scene_results))
    ]
    for result in scene_results:
        for char, data in result["characters"].items():
            if char not in merged["characters"]:
                merged["characters"][char] = {**data, "appearances": [], "emotionTimeline": []}
            merged["characters"][char]["appearances"].extend(data["appearances"])
            merged["characters"][char]["emotionTimeline"].extend(data["emotionTimeline"])
    return merged

def main():
    parser = argparse.ArgumentParser(description="Analyze a script file (.txt or .pdf) and output script-analysis.json.")
    parser.add_argument('script_file', help="Path to the script file (.txt or .pdf)")
    parser.add_argument('-o', '--output', default='script-analysis.json', help="Output JSON file name")
    parser.add_argument('--device', default=None, help="Device to use: 'cpu' or 'cuda'")
    args = parser.parse_args()

    ext = os.path.splitext(args.script_file)[1].lower()
    if ext == '.pdf':
        text = extract_text_from_pdf(args.script_file)
    elif ext == '.txt':
        text = extract_text_from_txt(args.script_file)
    else:
        print("Unsupported file type. Please provide a .txt or .pdf file.")
        return

    text = strip_front_matter(text)
    device = get_device(args.device)
    result = analyze_script_scenes(text, device=device)
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2)
    print(f"Analysis complete. Output written to {args.output}")

if __name__ == "__main__":
    main()
