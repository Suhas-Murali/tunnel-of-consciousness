import React, { useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import TunnelScene from './visualizer/TunnelScene';
import { colorSchemes } from './editor/themes';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import EditorArea from './editor/editor.jsx';
import { generateEmotionData } from './nlp/generateEmotionData.js';
import './style.css';

const colorSchemeKeys = Object.keys(colorSchemes);

function MainApp() {
  const [colorScheme, setColorScheme] = useState('monokai');
  const [story, setStory] = useState('');
  const [timeline, setTimeline] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [data, setData] = useState(null);
  const [viewMode, setViewMode] = useState('3d'); // '3d', '2d-front', '2d-side'

  // Memoize the current scheme object
  const scheme = useMemo(() => colorSchemes[colorScheme], [colorScheme]);

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const result = await generateEmotionData(story);
      setData(result);
    } catch (err) {
      // Optionally handle error
      console.error(err);
      setData(null);
    }
    setIsAnalyzing(false);
  };

  // View mode buttons
  const viewButtons = [
    { mode: '3d', label: '3D View' },
    { mode: '2d-front', label: '2D Front' },
    { mode: '2d-side', label: '2D Side' },
  ];

  return (
    <div className="flex flex-row w-screen h-screen" style={{ background: scheme['--scene-bg'] }}>
      {/* 3D Scene Area (60%) */}
      <div
        className="relative flex-shrink-0 min-w-0 h-full"
        style={{ flexBasis: '60%', background: scheme['--scene-bg'] }}
      >
        {/* View mode buttons */}
        <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 20, display: 'flex', gap: 8 }}>
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
              }}
            >
              {b.label}
            </button>
          ))}
        </div>
        <select
          className="hidden absolute top-4 right-4 z-10 bg-neutral-800 text-white rounded-lg px-4 py-2 shadow-lg border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          title="Color Scheme"
          value={colorScheme}
          onChange={e => setColorScheme(e.target.value)}
        >
          {colorSchemeKeys.map(schemeKey => (
            <option key={schemeKey} value={schemeKey}>{schemeKey.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
          ))}
        </select>
        <Canvas style={{ width: '100%', height: '100%', background: scheme['--scene-bg'] }}>
          <TunnelScene data={data} colorScheme={{ sceneBg: scheme['--scene-bg'] }} viewMode={viewMode} />
        </Canvas>
      </div>
      {/* Editor Area (40%) */}
      <EditorArea
        story={story}
        setStory={setStory}
        timeline={timeline}
        setTimeline={setTimeline}
        isAnalyzing={isAnalyzing}
        handleRunAnalysis={handleRunAnalysis}
        scheme={scheme}
      />
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