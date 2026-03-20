import argparse
import os
import json
import re


def clean_text(text):
    return re.sub(r"\s+", " ", text.strip())


SCENE_START_RE = re.compile(
    r"^(INT\.?|EXT\.?|EST\.?|INT/EXT\.?|I/E\.?|INT-EXT\.?|EXT-INT\.?)\b",
    re.IGNORECASE,
)
PARENTHETICAL_RE = re.compile(r"^\(.*\)$")
CHARACTER_RE = re.compile(r"^[A-Z0-9][A-Z0-9 '\-\.\(\)/]*$")
TRANSITION_RE = re.compile(
    r"^(FADE IN:|FADE OUT:|FADE TO:|CUT TO:|DISSOLVE TO:|SMASH CUT TO:|MATCH CUT TO:|JUMP CUT TO:|"
    r"WIPE TO:|IRIS IN:|IRIS OUT:|BACK TO:|INTERCUT WITH:|CUT BACK TO:|THE END)$",
    re.IGNORECASE,
)


def is_all_caps(text):
    letters = [ch for ch in text if ch.isalpha()]
    return bool(letters) and text == text.upper()


def is_scene_heading(text):
    return bool(SCENE_START_RE.match(text))


def is_transition(text):
    if TRANSITION_RE.match(text):
        return True
    return is_all_caps(text) and text.endswith("TO:")


def next_non_empty_line(sanitized_lines, start_index):
    for idx in range(start_index, len(sanitized_lines)):
        if sanitized_lines[idx]:
            return sanitized_lines[idx]
    return None


def is_character_line(text, next_text):
    if not text or next_text is None:
        return False
    if not is_all_caps(text):
        return False
    if is_scene_heading(text) or is_transition(text):
        return False
    if text.endswith((".", ":", "!", "?")):
        return False
    if len(text) > 50 or len(text.split()) > 6:
        return False
    if not CHARACTER_RE.match(text):
        return False
    if is_scene_heading(next_text) or is_transition(next_text):
        return False
    return True


def parse_script_lines(lines):
    blocks = []
    action_buffer = []
    dialogue_buffer = []
    expecting_dialogue = False
    last_emitted_type = None

    sanitized_lines = [clean_text(line.rstrip("\n\r")) for line in lines]

    def emit_block(script_type, text):
        nonlocal last_emitted_type
        cleaned = clean_text(text)
        if not cleaned:
            return
        blocks.append({"scriptType": script_type, "text": cleaned})
        last_emitted_type = script_type

    def flush_action():
        nonlocal action_buffer
        if action_buffer:
            emit_block("action", " ".join(action_buffer))
            action_buffer = []

    def flush_dialogue():
        nonlocal dialogue_buffer
        if dialogue_buffer:
            emit_block("dialogue", " ".join(dialogue_buffer))
            dialogue_buffer = []

    for index, text in enumerate(sanitized_lines):
        next_text = next_non_empty_line(sanitized_lines, index + 1)

        if not text:
            flush_dialogue()
            flush_action()
            expecting_dialogue = False
            continue

        if is_scene_heading(text):
            flush_dialogue()
            flush_action()
            emit_block("scene", text)
            expecting_dialogue = False
            continue

        if is_transition(text):
            flush_dialogue()
            flush_action()
            emit_block("transition", text)
            expecting_dialogue = False
            continue

        if is_character_line(text, next_text):
            flush_dialogue()
            flush_action()
            emit_block("character", text)
            expecting_dialogue = True
            continue

        if PARENTHETICAL_RE.match(text):
            if expecting_dialogue or last_emitted_type in {
                "character",
                "dialogue",
                "parenthetical",
            }:
                flush_dialogue()
                emit_block("parenthetical", text)
                expecting_dialogue = True
            else:
                flush_dialogue()
                action_buffer.append(text)
                expecting_dialogue = False
            continue

        if expecting_dialogue:
            dialogue_buffer.append(text)
            continue

        flush_dialogue()
        action_buffer.append(text)
        expecting_dialogue = False

    flush_dialogue()
    flush_action()

    return blocks


def main():
    parser = argparse.ArgumentParser(
        description=(
            "Parse a screenplay .txt file into ScriptEditor-compatible JSON blocks."
        )
    )
    parser.add_argument("script_file", help="Path to the screenplay text file (.txt)")
    parser.add_argument(
        "-o",
        "--output",
        default=None,
        help=(
            "Optional output file path. Defaults to the same folder and same basename "
            "as the input with a .json extension."
        ),
    )
    args = parser.parse_args()

    if not os.path.exists(args.script_file):
        print(f"File not found: {args.script_file}")
        return

    with open(args.script_file, "r", encoding="utf-8") as f:
        lines = f.readlines()

    blocks = parse_script_lines(lines)
    payload = {
        "version": 1,
        "format": "toc-script-v1",
        "blocks": blocks,
    }

    if args.output:
        output_path = args.output
    else:
        input_dir = os.path.dirname(os.path.abspath(args.script_file))
        base_name = os.path.splitext(os.path.basename(args.script_file))[0]
        output_path = os.path.join(input_dir, f"{base_name}.json")

    output_dir = os.path.dirname(os.path.abspath(output_path))
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    print(f"Parsing complete. Output written to {output_path}")

if __name__ == "__main__":
    main()
