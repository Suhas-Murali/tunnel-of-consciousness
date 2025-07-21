import React, { useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import TunnelScene, { SceneTimelineBar } from './visualizer/TunnelScene';
import { colorSchemes } from './editor/themes';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import EditorArea from './editor/editor.jsx';
import { generateEmotionData } from './nlp/generateEmotionData.js';
import './style.css';
import { FaCube, FaBorderAll, FaColumns, FaPalette } from 'react-icons/fa';

const colorSchemeKeys = Object.keys(colorSchemes);

function MainApp() {
  const [colorScheme, setColorScheme] = useState('monokai');
  const [story, setStory] = useState('');
  const [timeline, setTimeline] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [data, setData] = useState(null);
  const [viewMode, setViewMode] = useState('3d'); // '3d', '2d-front', '2d-side'
  const [leftWidth, setLeftWidth] = useState(52); // percent
  const [isDragging, setIsDragging] = useState(false);

  // Memoize the current scheme object
  const scheme = useMemo(() => colorSchemes[colorScheme], [colorScheme]);

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      // Improved scene splitting: match scene headings at start of line, case-insensitive
      const sceneRegex = /^\s*(INT\.|EXT\.|EST\.|INT\/EXT\.|I\/E\.|INT-EXT\.|EXT-INT\.)[^\n]*/gim;
      let scenes = [];
      let sceneHeadings = [];
      let lastIndex = 0;
      let match;
      while ((match = sceneRegex.exec(story)) !== null) {
        if (match.index > lastIndex) {
          // Previous scene text
          const sceneText = story.slice(lastIndex, match.index).trim();
          if (sceneText.length > 0) scenes.push(sceneText);
        }
        sceneHeadings.push(match[0].trim());
        lastIndex = match.index + match[0].length; // Move past the heading
      }
      // Add the last scene
      if (lastIndex < story.length) {
        const sceneText = story.slice(lastIndex).trim();
        if (sceneText.length > 0) scenes.push(sceneText);
      }
      // If no scene headings, treat the whole story as one scene
      if (scenes.length === 0) {
        scenes = [story];
        sceneHeadings = ["Scene 1"];
      }
      // Extract all-caps character names from the script
      const characterNameRegex = /^\s*([A-Z][A-Z0-9\-' ]{2,})(?=\n|,|\(|$)/gm;
      const allCharacterNames = new Set();
      let charMatch;
      while ((charMatch = characterNameRegex.exec(story)) !== null) {
        const name = charMatch[1].trim();
        // Exclude scene headings
        if (!/^\s*(INT\.|EXT\.|EST\.|INT\/EXT\.|I\/E\.|INT-EXT\.|EXT-INT\.)/i.test(name)) {
          allCharacterNames.add(name);
        }
      }
      // Analyze each scene individually, passing scene heading and character names
      const sceneResults = [];
      for (let i = 0; i < scenes.length; i++) {
        // Remove the scene heading from the start of the scene text if present
        let sceneText = scenes[i];
        // If the scene text starts with the heading, remove it
        if (sceneHeadings[i] && sceneText.startsWith(sceneHeadings[i])) {
          sceneText = sceneText.slice(sceneHeadings[i].length).trim();
        }
        const result = await generateEmotionData(sceneText, {
          sceneHeading: sceneHeadings[i] || `Scene ${i + 1}`,
          allCharacterNames: Array.from(allCharacterNames)
        });
        // --- Pronoun placeholder logic (unchanged) ---
        const sentences = sceneText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 2 && !/^[\s\p{P}]*$/u.test(s));
        const namedChars = new Set(Object.keys(result.characters).map(c => c.toLowerCase()));
        const pronouns = ['he', 'she', 'they', 'him', 'her', 'them', 'his', 'hers', 'their', 'theirs'];
        const pronounMap = {};
        let personCounter = 1;
        sentences.forEach((sentence, idx) => {
          let hasNamed = false;
          for (const char of namedChars) {
            if (sentence.toLowerCase().includes(char)) {
              hasNamed = true;
              break;
            }
          }
          if (!hasNamed) {
            for (const pronoun of pronouns) {
              const regex = new RegExp(`\\b${pronoun}\\b`, 'i');
              if (regex.test(sentence)) {
                if (!pronounMap[pronoun]) {
                  pronounMap[pronoun] = `Person ${personCounter++}`;
                }
                if (!result.characters[pronounMap[pronoun]]) {
                  result.characters[pronounMap[pronoun]] = {
                    color: '#888',
                    appearances: [],
                    emotionTimeline: []
                  };
                }
                let foundAppearance = false;
                for (const char of Object.keys(result.characters)) {
                  for (const app of result.characters[char].appearances) {
                    if (app.text === sentence) {
                      result.characters[pronounMap[pronoun]].appearances.push({ ...app, text: sentence });
                      result.characters[pronounMap[pronoun]].emotionTimeline.push({ position: app.position, emotion: app.emotion });
                      foundAppearance = true;
                    }
                  }
                }
                if (!foundAppearance) {
                  result.characters[pronounMap[pronoun]].appearances.push({
                    scene: i + 1,
                    position: idx / sentences.length,
                    emotion: 'neutral',
                    sentiment: 0.5,
                    linkedCharacters: [],
                    text: sentence
                  });
                  result.characters[pronounMap[pronoun]].emotionTimeline.push({
                    position: idx / sentences.length,
                    emotion: 'neutral'
                  });
                }
                break;
              }
            }
          }
        });
        Object.values(result.characters).forEach(char => {
          char.appearances.forEach(app => app.scene = i + 1);
          char.emotionTimeline.forEach(tl => tl.scene = i + 1);
        });
        sceneResults.push(result);
      }
      // Merge all scene results into a single data object
      const merged = { characters: {}, scenes: [] };
      merged.scenes = sceneResults.map((r, i) => ({ label: sceneHeadings[i] || `Scene ${i + 1}`, t: i / sceneResults.length }));
      for (const result of sceneResults) {
        for (const [char, data] of Object.entries(result.characters)) {
          if (!merged.characters[char]) {
            merged.characters[char] = { ...data, appearances: [], emotionTimeline: [] };
          }
          merged.characters[char].appearances.push(...data.appearances);
          merged.characters[char].emotionTimeline.push(...data.emotionTimeline);
        }
      }
      console.log(merged);
      setData(merged);
    } catch (err) {
      console.error(err);
      setData(null);
    }
    setIsAnalyzing(false);
  };

  // Resizer drag handlers
  const handleMouseDown = e => {
    setIsDragging(true);
    document.body.style.cursor = 'col-resize';
  };
  React.useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = e => {
      const totalWidth = window.innerWidth;
      let newLeft = (e.clientX / totalWidth) * 100;
      newLeft = Math.max(20, Math.min(80, newLeft)); // clamp between 20% and 80%
      setLeftWidth(newLeft);
    };
    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // View mode buttons with icons
  const viewButtons = [
    { mode: '3d', label: '3D View', icon: <FaCube /> },
    { mode: '2d-front', label: '2D Front', icon: <FaBorderAll /> },
    { mode: '2d-side', label: '2D Side', icon: <FaColumns /> },
  ];

  return (
    <div className="flex flex-row w-screen h-screen" style={{ background: scheme['--scene-bg'] }}>
      {/* 3D Scene Area (Resizable) */}
      <div
        className="relative flex-shrink-0 min-w-0 h-full"
        style={{ flexBasis: `${leftWidth}%`, width: `${leftWidth}%`, background: scheme['--scene-bg'], transition: isDragging ? 'none' : 'flex-basis 0.2s' }}
      >
        <SceneTimelineBar data={data} timeline={timeline} onSceneSelect={setTimeline} />
        {/* View mode buttons */}
        <div style={{ position: 'absolute', bottom: 16, left: 16, zIndex: 20, display: 'flex', gap: 8 }}>
          {viewButtons.filter(b => b.mode !== viewMode).map(b => (
            <button
              key={b.mode}
              onClick={() => setViewMode(b.mode)}
              style={{
                background: '#222',
                color: '#fff',
                border: '1px solid #444',
                borderRadius: 8,
                padding: '6px 16px',
                fontWeight: 'bold',
                fontSize: '1rem',
                cursor: 'pointer',
                opacity: 0.92,
                boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {b.icon} {b.label}
            </button>
          ))}
        </div>
        <div className="hidden absolute top-4 right-4 z-10">
          <label className="flex items-center gap-2 text-white font-bold" htmlFor="color-scheme-select">
            <FaPalette />
            <span className="sr-only">Color Scheme</span>
          </label>
          <select
            id="color-scheme-select"
            className="bg-neutral-800 text-white rounded-lg px-4 py-2 shadow-lg border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Color Scheme"
            value={colorScheme}
            onChange={e => setColorScheme(e.target.value)}
          >
            {colorSchemeKeys.map(schemeKey => (
              <option key={schemeKey} value={schemeKey}>{schemeKey.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
            ))}
          </select>
        </div>
        <Canvas style={{ width: '100%', height: '100%', background: scheme['--scene-bg'] }}>
          <TunnelScene data={data} colorScheme={{ sceneBg: scheme['--scene-bg'] }} viewMode={viewMode} timeline={timeline} onSceneSelect={setTimeline} />
        </Canvas>
      </div>
      {/* Resizer */}
      <div
        style={{ width: 8, cursor: 'col-resize', background: isDragging ? '#3b82f6' : '#222', zIndex: 50 }}
        className="transition-colors duration-100 ease-in-out hover:bg-blue-700"
        onMouseDown={handleMouseDown}
      />
      {/* Editor Area (Resizable) */}
      <div style={{ flexBasis: `${100 - leftWidth}%`, width: `${100 - leftWidth}%`, minWidth: 0, height: '100%' }}>
        <EditorArea
          story={story}
          setStory={setStory}
          timeline={timeline}
          setTimeline={setTimeline}
          isAnalyzing={isAnalyzing}
          handleRunAnalysis={handleRunAnalysis}
          scheme={scheme}
          data={data}
          setData={setData}
        />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<MainApp />} />
      </Routes>
    </BrowserRouter>
  );
} 