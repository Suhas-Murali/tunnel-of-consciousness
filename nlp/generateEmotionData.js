// Modern NER + Emotion pipeline using HuggingFace API
const NER_MODEL = 'dbmdz/bert-large-cased-finetuned-conll03-english';
// Use GoEmotions model for richer emotion detection
const EMOTION_MODEL = 'SamLowe/roberta-base-go_emotions';
const API_TOKEN = 'YOUR_API_TOKEN';

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

export async function generateEmotionData(text) {
  // Remove demo story override: always use model
  // Split text into sentences
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 2 && !/^[\s\p{P}]*$/u.test(s));
  if (sentences.length === 0) {
    return { characters: {}, scenes: [] };
  }

  // Caches
  const nerCache = new Map();
  const emotionCache = new Map();

  // NER: Detect characters and their mentions
  const characters = new Set();
  const characterMentions = new Map();
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    let ner;
    if (nerCache.has(sentence)) {
      ner = nerCache.get(sentence);
    } else {
      try {
        ner = await callHuggingFace(NER_MODEL, sentence);
        nerCache.set(sentence, ner);
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
            if (fullName) {
              characters.add(fullName);
              if (!characterMentions.has(fullName)) characterMentions.set(fullName, new Set());
              characterMentions.get(fullName).add(i);
            }
          }
          currentName = [word];
        }
        lastEnd = entity.end;
      }
    }
    if (currentName.length > 0) {
      const fullName = normalizeCharacterName(currentName.join(' '));
      if (fullName) {
        characters.add(fullName);
        if (!characterMentions.has(fullName)) characterMentions.set(fullName, new Set());
        characterMentions.get(fullName).add(i);
      }
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
        // If the result is a list of lists (as in return_all_scores), flatten
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
    { label: 'Start', t: 0.0 },
    { label: 'End', t: 1.0 }
  ];

  return {
    characters: charData,
    scenes
  };
}
