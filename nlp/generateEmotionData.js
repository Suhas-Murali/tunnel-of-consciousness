import { HfInference } from '@huggingface/inference';

const hf = new HfInference('YOUR_HUGGING_FACE_TOKEN'); // Replace with your actual token
const model = 'j-hartmann/emotion-english-distilroberta-base';

// Simple color palette
const palette = [
  '#f54242', '#4287f5', '#42f554', '#f5e142', '#a142f5', '#f57e42', '#42f5e6', '#e642f5', '#f542a7', '#42f5b9', '#b9f542', '#f5b942', '#42b9f5', '#b942f5', '#f54242'
];

// List of English pronouns and common non-names to exclude
const pronounsAndNonNames = [
  'he', 'him', 'his', 'she', 'her', 'they', 'their', 'them', 'you', 'your', 'i', 'me', 'my', 'mine', 'we', 'us', 'our', 'ours',
  'it', 'its', 'this', 'that', 'these', 'those', 'who', 'whom', 'whose', 'which', 'what', 'when', 'where', 'why', 'how',
  'the', 'a', 'an', 'and', 'but', 'or', 'nor', 'for', 'so', 'yet', 'down', 'later', 'then', 'next', 'in', 'on', 'at', 'by', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'off', 'over', 'under', 'again', 'further', 'once', 'here', 'there', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'don', 'should', 'now', 'their'
];

const pronounSet = new Set(pronounsAndNonNames.map(w => w.toLowerCase()));

function splitIntoSentences(text) {
  return text.match(/[^.!?]+[.!?]+/g) || [];
}

function extractCharacters(sentences) {
  const names = new Set();
  for (let s of sentences) {
    const matches = s.match(/\b[A-Z][a-z]+\b/g);
    if (matches) matches.forEach(name => {
      if (!pronounSet.has(name.toLowerCase())) {
        names.add(name);
      }
    });
  }
  return Array.from(names);
}

export async function generateEmotionData(text) {
  const sentences = splitIntoSentences(text);
  const realCharacters = extractCharacters(sentences);
  const charData = {};
  realCharacters.forEach((c, i) => {
    charData[c] = {
      color: palette[i % palette.length],
      appearances: [],
      emotionTimeline: []
    };
  });

  // Track last mentioned real character for pronoun resolution
  let lastRealCharacter = null;
  let sceneId = 1;

  for (let i = 0; i < sentences.length; i++) {
    const input = sentences[i];
    let result;
    try {
      result = await hf.textClassification({ model, inputs: input });
    } catch (err) {
      console.error(`Error during inference for: "${input}"`, err);
      continue;
    }
    if (!Array.isArray(result) || !result[0]?.label) {
      console.warn("Unexpected result format from Hugging Face:", result);
      continue;
    }
    const emotion = result[0].label.toLowerCase();
    const score = result[0].score;
    // Find all real character mentions
    let found = [];
    realCharacters.forEach(char => {
      if (input.includes(char)) found.push(char);
    });
    // If a real character is mentioned, update lastRealCharacter
    if (found.length > 0) {
      lastRealCharacter = found[found.length - 1];
    }
    // Find pronouns in the sentence
    let pronounFound = false;
    Object.keys(pronounSet).forEach(pronoun => {
      const regex = new RegExp(`\\b${pronoun}\\b`, 'i');
      if (regex.test(input)) {
        pronounFound = true;
      }
    });
    // If a pronoun is found and we have a last real character, add the data to that character
    if (pronounFound && lastRealCharacter && !found.includes(lastRealCharacter)) {
      found.push(lastRealCharacter);
    }
    // Only add appearances to real characters
    found.forEach(char => {
      if (!charData[char]) return; // Only real characters
      charData[char].appearances.push({
        scene: sceneId,
        position: i / sentences.length,
        emotion,
        sentiment: score, // Use score as sentiment for now
        linkedCharacters: [], // Could extract from text
        text: input.trim()
      });
      charData[char].emotionTimeline.push({
        position: i / sentences.length,
        emotion
      });
    });
  }

  // Remove characters with no appearances
  Object.keys(charData).forEach(char => {
    if (charData[char].appearances.length === 0) {
      delete charData[char];
    }
  });

  // Minimal scenes stub
  const scenes = [
    {
      id: 1,
      title: 'Start',
      startPosition: 0.0,
      endPosition: 1.0,
      characters: Object.keys(charData),
      dominantEmotion: null,
      text: ''
    }
  ];

  return {
    characters: charData,
    scenes
  };
}
