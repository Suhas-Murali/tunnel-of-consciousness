import React, { useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import TunnelScene, { SceneTimelineBar } from './visualizer/TunnelScene';
import { colorSchemes } from './editor/themes';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import EditorArea from './editor/editor.jsx';
import { generateEmotionData } from './nlp/generateEmotionData.js';
import parseScript from './nlp/parseScript.js';
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
      const parsedScript = parseScript(story);
      console.log(parsedScript);
      const merged = await generateEmotionData(parsedScript);
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