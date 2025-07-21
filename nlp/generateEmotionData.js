// Modern NER + Emotion pipeline using HuggingFace API
const NER_MODEL = 'dbmdz/bert-large-cased-finetuned-conll03-english';
const EMOTION_MODEL = 'j-hartmann/emotion-english-distilroberta-base';
const API_TOKEN = import.meta.env.VITE_HUGGINGFACE_API_TOKEN;

async function callHuggingFace(model, inputs) {
  const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ inputs })
  });
  if (!response.ok) {
    throw new Error(`API call failed: ${response.statusText}`);
  }
  return response.json();
}

function normalizeCharacterName(name) {
  name = name.replace(/\s+/g, ' ').trim();
  name = name.replace(/^[\p{P}]+|[\p{P}]+$/gu, '');
  name = name.split(' ').map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(' ');
  return name;
}

// Simple color palette
const palette = [
  '#f54242', '#4287f5', '#42f554', '#f5e142', '#a142f5', '#f57e42', '#42f5e6', '#e642f5', '#f542a7', '#42f5b9', '#b9f542', '#f5b942', '#42b9f5', '#b942f5', '#f54242'
];

export async function generateEmotionData(text, options = {}) {
  const { sceneHeading = '', allCharacterNames = [] } = options;
  // Split text into sentences
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 2 && !/^[\s\p{P}]*$/u.test(s));
  if (sentences.length === 0) {
    return { characters: {}, scenes: [] };
  }

  // Caches
  const nerCache = new Map();
  const emotionCache = new Map();

  // --- Script Character Name Extraction ---
  // Build a map from sentence index to detected script character name(s)
  const scriptCharMap = {};
  if (allCharacterNames && allCharacterNames.length > 0) {
    for (let i = 0; i < sentences.length; i++) {
      for (const name of allCharacterNames) {
        // Match as a whole word, case-insensitive
        const regex = new RegExp(`\\b${name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
        if (regex.test(sentences[i])) {
          if (!scriptCharMap[i]) scriptCharMap[i] = [];
          scriptCharMap[i].push(name);
        }
      }
    }
  }

  // --- Character Detection ---
  // Use script-extracted names as primary, fallback to NER for pronouns/unknowns
  const characters = new Set();
  const characterMentions = new Map();
  for (let i = 0; i < sentences.length; i++) {
    let usedNames = [];
    if (scriptCharMap[i] && scriptCharMap[i].length > 0) {
      usedNames = scriptCharMap[i];
    } else {
      // Use NER, but filter out short/invalid names
      let ner;
      if (nerCache.has(sentences[i])) {
        ner = nerCache.get(sentences[i]);
      } else {
        try {
          ner = await callHuggingFace(NER_MODEL, sentences[i]);
          nerCache.set(sentences[i], ner);
        } catch (error) {
          continue;
        }
      }
      let currentName = [];
      let lastEnd = -1;
      for (const entity of ner) {
        if (entity.entity_group === 'PER') {
          const word = entity.word.trim();
          if (!word || /^[\s\p{P}]*$/u.test(word)) continue;
          if (entity.start === lastEnd + 1) {
            currentName.push(word);
          } else {
            if (currentName.length > 0) {
              const fullName = normalizeCharacterName(currentName.join(' '));
              if (fullName.length > 2) usedNames.push(fullName);
            }
            currentName = [word];
          }
          lastEnd = entity.end;
        }
      }
      if (currentName.length > 0) {
        const fullName = normalizeCharacterName(currentName.join(' '));
        if (fullName.length > 2) usedNames.push(fullName);
      }
    }
    // Register all used names for this sentence
    for (const name of usedNames) {
      characters.add(name);
      if (!characterMentions.has(name)) characterMentions.set(name, new Set());
      characterMentions.get(name).add(i);
    }
  }

  // If no characters found, return empty
  if (characters.size === 0) {
    return { characters: {}, scenes: [] };
  }

  // Build emotion data for each character
  const charData = {};
  Array.from(characters).forEach((c, i) => {
    charData[c] = {
      color: palette[i % palette.length],
      appearances: [],
      emotionTimeline: []
    };
  });

  for (const character of characters) {
    const mentionIndices = Array.from(characterMentions.get(character));
    for (const idx of mentionIndices) {
      const sentence = sentences[idx];
      let emotionResult;
      if (emotionCache.has(sentence)) {
        emotionResult = emotionCache.get(sentence);
      } else {
        try {
          emotionResult = await callHuggingFace(EMOTION_MODEL, sentence);
          emotionCache.set(sentence, emotionResult);
        } catch (error) {
          continue;
        }
      }
      // Use the top emotion (highest score)
      let top = { label: 'neutral', score: 0 };
      if (Array.isArray(emotionResult) && emotionResult.length > 0) {
        const flat = Array.isArray(emotionResult[0]) ? emotionResult[0] : emotionResult;
        top = flat.reduce((a, b) => (b.score > a.score ? b : a), flat[0]);
      }
      const emotion = (top.label || 'neutral').toLowerCase();
      const score = top.score || 0.5;
      charData[character].appearances.push({
        scene: 1,
        position: idx / sentences.length,
        emotion,
        sentiment: score,
        linkedCharacters: [],
        text: sentence
      });
      charData[character].emotionTimeline.push({
        position: idx / sentences.length,
        emotion
      });
    }
  }

  // Remove characters with no appearances
  Object.keys(charData).forEach(char => {
    if (charData[char].appearances.length === 0) {
      delete charData[char];
    }
  });

  // Minimal scenes stub
  const scenes = [
    { label: sceneHeading || 'Start', t: 0.0 },
    { label: 'End', t: 1.0 }
  ];
  
  return {
    characters: charData,
    scenes
  };
}
