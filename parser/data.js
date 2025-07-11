// Mock data for visualization (replace with real data later)
export const mockData = {
    characters: {
      Alice: {
        color: '#f54242',
        appearances: [
          { scene: 1, position: 0.05, emotion: 'joy', sentiment: 0.7, linkedCharacters: ['Bob'], text: 'Alice entered the room smiling.' },
          { scene: 2, position: 0.2, emotion: 'calm', sentiment: 0.5, linkedCharacters: [], text: 'Alice sits quietly.' },
          { scene: 3, position: 0.4, emotion: 'fearful', sentiment: 0.2, linkedCharacters: ['Bob'], text: 'Alice hears a noise.' },
          { scene: 4, position: 0.6, emotion: 'angry', sentiment: 0.9, linkedCharacters: [], text: 'Alice shouts.' },
          { scene: 5, position: 0.8, emotion: 'peaceful', sentiment: 0.8, linkedCharacters: [], text: 'Alice finds peace.' }
        ],
        emotionTimeline: [
          { position: 0.05, emotion: 'joy' },
          { position: 0.2, emotion: 'calm' },
          { position: 0.4, emotion: 'fearful' },
          { position: 0.6, emotion: 'angry' },
          { position: 0.8, emotion: 'peaceful' }
        ]
      },
      Bob: {
        color: '#4287f5',
        appearances: [
          { scene: 1, position: 0.08, emotion: 'calm', sentiment: 0.5, linkedCharacters: ['Alice'], text: 'Bob was already there.' },
          { scene: 2, position: 0.3, emotion: 'surprised', sentiment: 0.6, linkedCharacters: [], text: 'Bob is startled.' },
          { scene: 3, position: 0.5, emotion: 'sad', sentiment: 0.3, linkedCharacters: ['Alice'], text: 'Bob feels left out.' },
          { scene: 4, position: 0.7, emotion: 'joy', sentiment: 0.8, linkedCharacters: [], text: 'Bob laughs.' }
        ],
        emotionTimeline: [
          { position: 0.08, emotion: 'calm' },
          { position: 0.3, emotion: 'surprised' },
          { position: 0.5, emotion: 'sad' },
          { position: 0.7, emotion: 'joy' }
        ]
      }
    },
    scenes: [
      {
        id: 1,
        title: 'INT. KITCHEN - MORNING',
        startPosition: 0.0,
        endPosition: 0.1,
        characters: ['Alice', 'Bob'],
        dominantEmotion: 'calm',
        text: 'INT. KITCHEN - MORNING\nAlice entered the room smiling.'
      }
    ],
    storyArcs: [
      {
        arcName: 'Main Plot',
        sentimentArc: [
          { position: 0.0, sentiment: 0.2 },
          { position: 0.1, sentiment: 0.6 }
        ],
        climaxPositions: [0.5],
        resolutionPosition: 0.95
      }
    ],
    truthCore: {
      currentProximity: 0.4,
      emotionalBlend: {
        joy: 0.3,
        anger: 0.1,
        sadness: 0.6
      }
    },
    positionIndex: [
      {
        position: 0.05,
        textIndex: 0,
        sentence: 'Alice entered the room smiling.'
      }
    ]
  };