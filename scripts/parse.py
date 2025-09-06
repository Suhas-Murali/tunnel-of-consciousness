import argparse
import os
import json
import re

def clean_text(text):
    return re.sub(r'\s+', ' ', text.strip())

def split_sentences(text):
    sentences = re.split(r'(?<=[.!?])\s+', text)
    return [clean_text(s) for s in sentences if s.strip()]

def parse_script_lines_and_scenes(lines):
    result = []
    scenes = []
    current_type = None
    scene_start = None
    buffer = []
    buffer_type = None
    scene_heading_buffer = []
    in_scene_heading = False
    in_dialog_block = False  # New flag to control dialog continuation

    def flush_buffer():
        nonlocal buffer, buffer_type
        if buffer:
            text_block = clean_text(' '.join(buffer))
            if buffer_type == 'content:dialog' or buffer_type == 'content:narration':
                for sent in split_sentences(text_block):
                    result.append({"type": buffer_type, "text": sent})
            buffer = []
            buffer_type = None

    scene_start_regex = re.compile(r'^(INT\.|EXT\.|EST\.|INT/EXT\.|I/E\.|INT-EXT\.|EXT-INT\.)', re.IGNORECASE)
    scene_end_regex = re.compile(r'.*(\.|--|:)$')

    for i, line in enumerate(lines):
        raw = line.rstrip('\n')
        text = clean_text(raw)

        if not text:
            if in_scene_heading and scene_heading_buffer:
                scene_heading = clean_text(' '.join(scene_heading_buffer))
                flush_buffer()
                if scene_start is not None:
                    scenes.append({'start': scene_start, 'end': len(result) - 1})
                scene_start = len(result)
                result.append({"type": "directive:scene-name", "text": scene_heading})
                current_type = "directive:scene-name"
                scene_heading_buffer = []
                in_scene_heading = False
            in_dialog_block = False  # End of dialog block
            continue

        # Scene-helper: ALL CAPS ending with colon or just number
        if (re.match(r'^[A-Z0-9 \-]+:$', text) and text == text.upper()) or re.match(r'^\d+\.$', text):
            flush_buffer()
            result.append({"type": "directive:scene-modifier", "text": text})
            current_type = "directive:scene-modifier"
            in_dialog_block = False
            continue

        # Multi-line scene heading
        if in_scene_heading:
            scene_heading_buffer.append(text)
            if scene_end_regex.match(text):
                scene_heading = clean_text(' '.join(scene_heading_buffer))
                flush_buffer()
                if scene_start is not None:
                    scenes.append({'start': scene_start, 'end': len(result) - 1})
                scene_start = len(result)
                result.append({"type": "directive:scene-name", "text": scene_heading})
                current_type = "directive:scene-name"
                scene_heading_buffer = []
                in_scene_heading = False
            continue

        if scene_start_regex.match(text):
            scene_heading_buffer = [text]
            in_scene_heading = True
            if scene_end_regex.match(text):
                scene_heading = clean_text(' '.join(scene_heading_buffer))
                flush_buffer()
                if scene_start is not None:
                    scenes.append({'start': scene_start, 'end': len(result) - 1})
                scene_start = len(result)
                result.append({"type": "directive:scene-name", "text": scene_heading})
                current_type = "directive:scene-name"
                scene_heading_buffer = []
                in_scene_heading = False
            continue

        # NEW: Single-word ALL CAPS with period (e.g., SPACE.)
        if re.match(r'^[A-Z0-9 \-]+\.$', text) and text == text.upper():
            flush_buffer()
            if scene_start is not None:
                scenes.append({'start': scene_start, 'end': len(result) - 1})
            scene_start = len(result)
            result.append({"type": "directive:scene-name", "text": text})
            current_type = "directive:scene-name"
            in_dialog_block = False
            continue

        # Name: ALL CAPS, no period — but avoid this if we're in dialog mode
        if not in_dialog_block and re.match(r'^[A-Z0-9 \'\-]+$', text) and text == text.upper():
            flush_buffer()
            result.append({"type": "directive:character-name", "text": text})
            current_type = "directive:character-name"
            in_dialog_block = True
            continue

        # Support line: inside brackets
        if in_dialog_block and re.match(r'^\(.*\)$', text):
            flush_buffer()
            result.append({"type": "content:support", "text": text})
            continue

        # Dialog continuation (if in dialog)
        if in_dialog_block:
            if buffer_type not in (None, 'content:dialog'):
                flush_buffer()
            buffer.append(text)
            buffer_type = 'content:dialog'
            continue

        # Narration: default if nothing else
        if buffer_type not in (None, 'content:narration'):
            flush_buffer()
        if re.match(r'^\(.*\)$', text):
            result.append({"type": "content:support", "text": text})
        else:
            buffer.append(text)
            buffer_type = 'content:narration'

    # Handle remaining buffers
    if in_scene_heading and scene_heading_buffer:
        scene_heading = clean_text(' '.join(scene_heading_buffer))
        flush_buffer()
        if scene_start is not None:
            scenes.append({'start': scene_start, 'end': len(result) - 1})
        scene_start = len(result)
        result.append({"type": "directive:scene-name", "text": scene_heading})

    flush_buffer()
    if scene_start is not None:
        scenes.append({'start': scene_start, 'end': len(result) - 1})

    return result, scenes

def main():
    parser = argparse.ArgumentParser(description="Parse a movie script .txt file into structured JSON format.")
    parser.add_argument('script_file', help="Path to the script file (.txt)")
    parser.add_argument('-o', '--output', default='parsed-script.json', help="Output JSON file name")
    args = parser.parse_args()

    if not os.path.exists(args.script_file):
        print(f"File not found: {args.script_file}")
        return

    with open(args.script_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    parsed_lines, scenes = parse_script_lines_and_scenes(lines)
    parsed = {"Lines": parsed_lines, "scenes": scenes}

    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(parsed, f, indent=2)

    print(f"Parsing complete. Output written to {args.output}")

if __name__ == "__main__":
    main()
