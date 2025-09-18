function cleanText(text) {
  return text.trim().replace(/\s+/g, " ");
}

function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((t) => cleanText(t))
    .filter(Boolean);
}

function parseScriptLinesAndScenes(lines) {
  const result = [];
  const scenes = [];
  let currentType = null;
  let sceneStart = null;
  let buffer = [];
  let bufferType = null;
  let sceneHeadingBuffer = [];
  let inSceneHeading = false;
  let inDialogBlock = false;

  const sceneStartRegex =
    /^(INT\.|EXT\.|EST\.|INT\/EXT\.|I\/E\.|INT-EXT\.|EXT-INT\.)/i;
  const sceneEndRegex = /(\.|--|:)$/;

  function flushBuffer() {
    if (buffer.length > 0) {
      const textBlock = cleanText(buffer.join(" "));
      if (
        bufferType === "content:dialog" ||
        bufferType === "content:narration"
      ) {
        const sentences = splitSentences(textBlock);
        for (const s of sentences) {
          result.push({ type: bufferType, text: s });
        }
      }
      buffer = [];
      bufferType = null;
    }
  }

  lines.forEach((raw, i) => {
    const text = cleanText(raw);
    if (text === "") {
      if (inSceneHeading && sceneHeadingBuffer.length > 0) {
        const sceneHeading = cleanText(sceneHeadingBuffer.join(" "));
        flushBuffer();
        if (sceneStart !== null) {
          scenes.push({ start: sceneStart, end: result.length - 1 });
        }
        sceneStart = result.length;
        result.push({ type: "directive:scene-name", text: sceneHeading });
        currentType = "directive:scene-name";
        sceneHeadingBuffer = [];
        inSceneHeading = false;
      }
      inDialogBlock = false;
      return;
    }

    // Scene modifier (CUT TO:, 1.)
    if (
      (/^[A-Z0-9 \-]+:$/.test(text) && text === text.toUpperCase()) ||
      /^\d+\.$/.test(text)
    ) {
      flushBuffer();
      result.push({ type: "directive:scene-modifier", text });
      currentType = "directive:scene-modifier";
      inDialogBlock = false;
      return;
    }

    if (inSceneHeading) {
      sceneHeadingBuffer.push(text);
      if (sceneEndRegex.test(text)) {
        const sceneHeading = cleanText(sceneHeadingBuffer.join(" "));
        flushBuffer();
        if (sceneStart !== null) {
          scenes.push({ start: sceneStart, end: result.length - 1 });
        }
        sceneStart = result.length;
        result.push({ type: "directive:scene-name", text: sceneHeading });
        currentType = "directive:scene-name";
        sceneHeadingBuffer = [];
        inSceneHeading = false;
      }
      return;
    }

    if (sceneStartRegex.test(text)) {
      sceneHeadingBuffer = [text];
      inSceneHeading = true;
      if (sceneEndRegex.test(text)) {
        const sceneHeading = cleanText(sceneHeadingBuffer.join(" "));
        flushBuffer();
        if (sceneStart !== null) {
          scenes.push({ start: sceneStart, end: result.length - 1 });
        }
        sceneStart = result.length;
        result.push({ type: "directive:scene-name", text: sceneHeading });
        currentType = "directive:scene-name";
        sceneHeadingBuffer = [];
        inSceneHeading = false;
      }
      return;
    }

    if (/^[A-Z0-9 \-]+\.$/.test(text) && text === text.toUpperCase()) {
      flushBuffer();
      if (sceneStart !== null) {
        scenes.push({ start: sceneStart, end: result.length - 1 });
      }
      sceneStart = result.length;
      result.push({ type: "directive:scene-name", text });
      currentType = "directive:scene-name";
      inDialogBlock = false;
      return;
    }

    // Character name (ALL CAPS), only if not in dialog block
    if (
      !inDialogBlock &&
      /^[A-Z0-9 '\-]+$/.test(text) &&
      text === text.toUpperCase()
    ) {
      flushBuffer();
      result.push({ type: "directive:character-name", text });
      currentType = "directive:character-name";
      inDialogBlock = true;
      return;
    }

    // Dialog support line (brackets)
    if (inDialogBlock && /^\(.*\)$/.test(text)) {
      flushBuffer();
      result.push({ type: "content:support", text });
      return;
    }

    // Dialog block continuation
    if (inDialogBlock) {
      if (bufferType !== "content:dialog") flushBuffer();
      buffer.push(text);
      bufferType = "content:dialog";
      return;
    }

    // Narration or support outside dialog
    if (bufferType !== "content:narration") flushBuffer();
    if (/^\(.*\)$/.test(text)) {
      result.push({ type: "content:support", text });
    } else {
      buffer.push(text);
      bufferType = "content:narration";
    }
  });

  // End of file processing
  if (inSceneHeading && sceneHeadingBuffer.length > 0) {
    const sceneHeading = cleanText(sceneHeadingBuffer.join(" "));
    flushBuffer();
    if (sceneStart !== null) {
      scenes.push({ start: sceneStart, end: result.length - 1 });
    }
    sceneStart = result.length;
    result.push({ type: "directive:scene-name", text: sceneHeading });
  }

  flushBuffer();
  if (sceneStart !== null) {
    scenes.push({ start: sceneStart, end: result.length - 1 });
  }

  return { Lines: result, Scenes: scenes };
}

export default function parseScript(text) {
  const rawText = text;
  const lines = rawText.split(/\r?\n/);
  const parsed = parseScriptLinesAndScenes(lines);

  return parsed;
}
