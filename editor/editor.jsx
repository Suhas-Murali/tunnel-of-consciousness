import React, { useRef, useState } from 'react';
import { FaSave, FaFolderOpen, FaPlay, FaChevronDown, FaChevronRight, FaUser, FaSync, FaFilter, FaFilm, FaEye, FaEyeSlash, FaCrosshairs } from 'react-icons/fa';

export default function EditorArea({ story, setStory, timeline, setTimeline, isAnalyzing, handleRunAnalysis, scheme, data, setData }) {
  const fileInputRef = useRef();
  // Collapsible Characters section state
  const [charsOpen, setCharsOpen] = useState(false);
  const [selectedChar, setSelectedChar] = useState(null);
  const [expandedAppearances, setExpandedAppearances] = useState({});
  const [charTimeline, setCharTimeline] = useState(0);
  const [syncTimeline, setSyncTimeline] = useState(false);
  const [charSearch, setCharSearch] = useState('');
  const [emotionFilter, setEmotionFilter] = useState('All');
  const [showFilter, setShowFilter] = useState(false);
  const [name, setName] = useState('tunnel-data');
  // Scenes panel state
  const [scenesOpen, setScenesOpen] = useState(false);
  const [selectedSceneIdx, setSelectedSceneIdx] = useState(null);
  // State for scenes search and filter
  const [sceneSearch, setSceneSearch] = useState("");
  const [sceneCharFilter, setSceneCharFilter] = useState("");
  const [showSceneFilter, setShowSceneFilter] = useState(false);

  // Save to file handler
  const handleSaveToFile = () => {
    if (!data) return;
    const toSave = { ...data, script: story, name };
    const blob = new Blob([JSON.stringify(toSave, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name || 'tunnel-data'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Load from file handler
  const handleLoadFromFile = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const loaded = JSON.parse(evt.target.result);
        if (loaded.script) setStory(loaded.script);
        if (loaded.name) setName(loaded.name);
        setData(loaded);
      } catch (err) {
        alert('Invalid file format.');
      }
    };
    reader.readAsText(file);
  };

  // Handle character selection
  const handleSelectChar = (char) => {
    setSelectedChar(char);
    // Reset appearance expansion and timeline
    setExpandedAppearances({});
    setCharTimeline(0);
  };

  // Handle appearance expand/collapse
  const toggleAppearance = (idx) => {
    setExpandedAppearances(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  // Handle timeline sync
  const handleCharTimelineChange = (val) => {
    setCharTimeline(val);
    if (syncTimeline) setTimeline(val);
  };

  // Handle appearance click (jump to timeline)
  const handleAppearanceClick = (pos) => {
    setCharTimeline(pos);
    if (syncTimeline) setTimeline(pos);
  };

  // Focus and hide handlers for characters
  const handleCharacterFocus = (charName) => {
    if (!data || !data.characters) return;
    const updatedData = { ...data };
    const currentChar = updatedData.characters[charName];
    
    // If this character is already focused (all others are hidden), reset focus
    if (currentChar && !currentChar.hidden && Object.keys(updatedData.characters).every(char => char === charName || updatedData.characters[char].hidden)) {
      // Reset focus - show all characters
      Object.keys(updatedData.characters).forEach(char => {
        updatedData.characters[char].hidden = false;
      });
    } else {
      // Focus on this character - hide all others
      Object.keys(updatedData.characters).forEach(char => {
        updatedData.characters[char].hidden = char !== charName;
      });
    }
    setData(updatedData);
  };

  const handleCharacterHide = (charName) => {
    if (!data || !data.characters) return;
    const updatedData = { ...data };
    // Hide only the specified character
    if (updatedData.characters[charName]) {
      updatedData.characters[charName].hidden = !updatedData.characters[charName].hidden;
    }
    setData(updatedData);
  };

  // Focus and hide handlers for scenes
  const handleSceneFocus = (sceneIdx) => {
    if (!data || !data.scenes) return;
    const updatedData = { ...data };
    const currentScene = updatedData.scenes[sceneIdx];
    
    // If this scene is already focused (all others are hidden), reset focus
    if (currentScene && !currentScene.hidden && updatedData.scenes.every((scene, idx) => idx === sceneIdx || scene.hidden)) {
      // Reset focus - show all scenes
      updatedData.scenes.forEach((scene, idx) => {
        scene.hidden = false;
      });
    } else {
      // Focus on this scene - hide all others
      updatedData.scenes.forEach((scene, idx) => {
        scene.hidden = idx !== sceneIdx;
      });
    }
    setData(updatedData);
  };

  const handleSceneHide = (sceneIdx) => {
    if (!data || !data.scenes) return;
    const updatedData = { ...data };
    // Hide only the specified scene
    if (updatedData.scenes[sceneIdx]) {
      updatedData.scenes[sceneIdx].hidden = !updatedData.scenes[sceneIdx].hidden;
    }
    setData(updatedData);
  };

  // Helper function to check if a character is focused
  const isCharacterFocused = (charName) => {
    if (!data || !data.characters) return false;
    return Object.keys(data.characters).every(char => char === charName || data.characters[char].hidden);
  };

  // Helper function to check if a scene is focused
  const isSceneFocused = (sceneIdx) => {
    if (!data || !data.scenes) return false;
    return data.scenes.every((scene, idx) => idx === sceneIdx || scene.hidden);
  };

  // Prepare character list and selected info
  let charList = data && data.characters ? Object.entries(data.characters) : [];
  // Filter by search
  if (charSearch) {
    charList = charList.filter(([char]) => char.toLowerCase().includes(charSearch.toLowerCase()));
  }
  // Filter by emotion
  if (emotionFilter !== 'All') {
    charList = charList.filter(([, info]) => info.appearances.some(app => app.emotion.toLowerCase() === emotionFilter.toLowerCase()));
  }
  const selectedCharData = selectedChar && data && data.characters ? data.characters[selectedChar] : null;

  // Get all unique emotions for filter dropdown
  const allEmotions = Array.from(new Set(
    (data && data.characters)
      ? Object.values(data.characters).flatMap(c => c.appearances.map(a => a.emotion.charAt(0).toUpperCase() + a.emotion.slice(1).toLowerCase()))
      : []
  ));
  allEmotions.sort();

  // Prepare scenes list and scene-character mapping
  const scenesList = data && data.scenes ? data.scenes : [];
  // For each scene, get a set of characters that appear in that scene
  const sceneCharacters = (sceneIdx) => {
    if (!data || !data.characters || !data.scenes || !data.scenes[sceneIdx]) return [];
    const chars = [];
    for (const [char, info] of Object.entries(data.characters)) {
      if (info.appearances.some(app => app.scene === sceneIdx + 1)) {
        chars.push(char);
      }
    }
    return chars;
  };

  // Get all unique character names for scene filter dropdown
  const allSceneCharacters = Array.from(new Set(
    (data && data.characters)
      ? Object.keys(data.characters)
      : []
  ));
  allSceneCharacters.sort();

  // Filter scenes by search and character filter
  let filteredScenesList = scenesList;
  if (sceneSearch) {
    filteredScenesList = filteredScenesList.filter((scene, idx) => {
      const label = scene.label || `Scene ${idx + 1}`;
      return label.toLowerCase().includes(sceneSearch.toLowerCase()) || `scene ${idx + 1}`.includes(sceneSearch.toLowerCase());
    });
  }
  if (sceneCharFilter) {
    filteredScenesList = filteredScenesList.filter((scene, idx) => {
      // Check if the character is present in this scene
      return sceneCharacters(idx).includes(sceneCharFilter);
    });
  }

  // Create filtered list with original indices preserved
  let filteredScenesWithIndices = [];
  scenesList.forEach((scene, originalIdx) => {
    const label = scene.label || `Scene ${originalIdx + 1}`;
    const sceneNum = `scene ${originalIdx + 1}`;
    
    // Check search filter
    const matchesSearch = !sceneSearch || 
      label.toLowerCase().includes(sceneSearch.toLowerCase()) || 
      sceneNum.includes(sceneSearch.toLowerCase());
    
    // Check character filter
    const matchesCharFilter = !sceneCharFilter || 
      sceneCharacters(originalIdx).includes(sceneCharFilter);
    
    if (matchesSearch && matchesCharFilter) {
      filteredScenesWithIndices.push({ scene, originalIdx });
    }
  });

  // Handler for selecting a character from the scene panel
  const handleSceneCharClick = (char) => {
    if (charsOpen) {
      setSelectedChar(char);
    }
  };

  return (
    <div
      className="flex flex-col min-w-0 h-full relative overflow-y-auto"
      style={{ flexBasis: '40%', background: scheme['--editor-bg'], maxHeight: '100vh' }}
    >
      {/* Top section: Name, Save, Load, Run Analysis */}
      <div className="flex flex-row gap-4 p-4 justify-start items-center">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="File name..."
          className="px-3 py-2 rounded-lg bg-neutral-900 text-white border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base font-mono"
          style={{ background: scheme['--editor-bg'], color: scheme['--editor-fg'], width: 180 }}
        />
        <button
          className="px-4 py-2 font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors shadow border border-blue-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
          onClick={handleSaveToFile}
          disabled={isAnalyzing || !data}
        >
          <FaSave /> Save to File
        </button>
        <button
          className="px-4 py-2 font-bold rounded-lg bg-green-600 text-white hover:bg-green-500 transition-colors shadow border border-green-700 flex items-center gap-2"
          onClick={() => fileInputRef.current && fileInputRef.current.click()}
        >
          <FaFolderOpen /> Load from File
        </button>
        <input
          type="file"
          accept="application/json"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleLoadFromFile}
        />
        <button
          className="px-4 py-2 font-bold rounded-lg bg-neutral-700 text-white hover:bg-neutral-600 transition-colors shadow border border-neutral-600 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
          onClick={handleRunAnalysis}
          disabled={isAnalyzing}
        >
          <FaPlay /> {isAnalyzing ? 'Analyzing...' : 'Run Analysis'}
        </button>
      </div>
      {/* Timeline slider with custom styling and scene checkpoints */}
      <div style={{ position: 'relative', width: '75%', margin: '0 auto', marginTop: 8, marginBottom: 16, height: 32 }}>
        {/* Filled portion (darker) */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            height: 8,
            width: `${timeline * 100}%`,
            background: scheme['--timeline-fill'] || '#111',
            borderRadius: 8,
            zIndex: 1,
            pointerEvents: 'none',
            transition: 'width 0.1s',
          }}
        />
        {/* Slider input */}
        <input
          type="range"
          className="w-full h-2 rounded-lg appearance-none bg-neutral-700"
          min={0}
          max={1}
          step={0.001}
          value={timeline}
          onChange={e => setTimeline(Number(e.target.value))}
          disabled={isAnalyzing}
          style={{
            position: 'relative',
            zIndex: 2,
            outline: 'none',
            boxShadow: 'none',
            border: 'none',
          }}
          // Remove blue focus ring
          onFocus={e => e.target.blur()}
        />
        {/* Scene checkpoints */}
        {data && data.scenes && data.scenes.length > 1 && data.scenes.map((scene, i) => {
          // Add markers for the beginning of each scene starting from the 2nd scene
          if (i === 0) return null;
          const left = `${scene.t * 100}%`;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 10,
                height: 10,
                background: scheme['--timeline-checkpoint'] || '#f5e142',
                borderRadius: '50%',
                border: '2px solid #222',
                zIndex: 3,
                boxShadow: '0 0 4px #000',
                pointerEvents: 'none',
              }}
              title={scene.label}
            />
          );
        })}
      </div>
      {/* Scenes Explorer Section */}
      <div className="px-4">
        <div className="flex items-center gap-2 mb-2">
          <button
            className="flex items-center gap-2 font-bold text-lg py-2 w-full text-left hover:bg-neutral-700/40 rounded text-white"
            onClick={() => setScenesOpen(o => !o)}
            style={{ color: scheme['--editor-fg'] }}
          >
            {scenesOpen ? <FaChevronDown /> : <FaChevronRight />} <FaFilm /> Scenes
          </button>
        </div>
        {scenesOpen && (
          <div className="flex flex-row gap-4 border border-neutral-700 rounded-xl p-4 mt-1 shadow-md custom-scrollbar"
            style={{ background: scheme['--editor-bg'], color: scheme['--editor-fg'] }}
          >
            {/* Left: Scene List */}
            <div className="flex flex-col gap-2 min-w-[120px] w-1/4 pr-2">
              {/* Search and filter with funnel icon */}
              <div className="mb-2 flex flex-col gap-2">
                <div className="flex items-center gap-2 relative">
                  <div className="flex flex-row items-center gap-1 w-full">
                    <input
                      type="text"
                      value={sceneSearch}
                      onChange={e => setSceneSearch(e.target.value)}
                      placeholder="Search scenes..."
                      className="px-2 py-1 rounded bg-neutral-900 text-white border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                      style={{ background: scheme['--editor-bg'], color: scheme['--editor-fg'], width: '70%' }}
                    />
                    <div className="relative" style={{ width: '30%' }}>
                      <button
                        className={`p-2 rounded hover:bg-purple-900/40 transition-colors ${showSceneFilter ? 'bg-purple-800/80' : ''}`}
                        onClick={() => setShowSceneFilter(f => !f)}
                        title="Filter by character"
                        type="button"
                        style={{ minWidth: 36, minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <FaFilter />
                      </button>
                      {/* Filter dropdown popover, positioned below the icon */}
                      {showSceneFilter && (
                        <div className="absolute left-0 mt-2 z-10 bg-neutral-900 border border-neutral-700 rounded shadow-lg p-2 min-w-[120px]" style={{ background: scheme['--editor-bg'], color: scheme['--editor-fg'], top: '100%' }}>
                          <input
                            type="text"
                            value={sceneCharFilter}
                            onChange={e => setSceneCharFilter(e.target.value)}
                            placeholder="Filter by character..."
                            className="w-full px-2 py-1 rounded bg-neutral-900 text-white border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                            list="scene-char-autofill"
                            style={{ background: scheme['--editor-bg'], color: scheme['--editor-fg'] }}
                          />
                          <datalist id="scene-char-autofill">
                            {allSceneCharacters.map(char => (
                              <option key={char} value={char} />
                            ))}
                          </datalist>
                          <button
                            className="mt-2 w-full px-2 py-1 rounded bg-purple-800 text-white hover:bg-purple-700 transition-colors text-sm"
                            onClick={() => setSceneCharFilter("")}
                          >
                            Clear Filter
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {filteredScenesWithIndices.length === 0 && <div className="text-neutral-400 italic">No scenes found</div>}
              {filteredScenesWithIndices.map(({ scene, originalIdx }) => (
                <button
                  key={scene.label || originalIdx}
                  className={`flex items-center px-2 py-2 rounded-lg hover:bg-purple-900/40 transition-colors ${selectedSceneIdx === originalIdx ? 'bg-purple-800/80 font-bold' : ''} ${scene.hidden ? 'opacity-50' : ''}`}
                  onClick={() => {
                    setSelectedSceneIdx(originalIdx);
                    if (scene.t !== undefined) setTimeline(scene.t);
                  }}
                  style={{ color: scheme['--editor-fg'], width: '100%', minWidth: 90, textAlign: 'left' }}
                >
                  <span style={{ fontWeight: 'bold', fontSize: '1.05em' }}>{`Scene ${originalIdx + 1}`}</span>
                </button>
              ))}
            </div>
            {/* Right: Scene Label and Characters in Scene */}
            <div className="flex-1 min-w-0 text-white" style={{ color: scheme['--editor-fg'] }}>
              {selectedSceneIdx !== null && scenesList[selectedSceneIdx] ? (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{scenesList[selectedSceneIdx].label || `Scene ${selectedSceneIdx + 1}`}</span>
                    <div className="flex gap-1">
                      <button
                        className="p-1 rounded hover:bg-purple-700/60 transition-colors"
                        onClick={() => handleSceneFocus(selectedSceneIdx)}
                        title={isSceneFocused(selectedSceneIdx) ? "Reset focus (show all scenes)" : "Focus on this scene"}
                        style={{ color: scheme['--editor-fg'] }}
                      >
                        <FaCrosshairs size={12} />
                      </button>
                      <button
                        className="p-1 rounded hover:bg-purple-700/60 transition-colors"
                        onClick={() => handleSceneHide(selectedSceneIdx)}
                        title={scenesList[selectedSceneIdx].hidden ? "Show this scene" : "Hide this scene"}
                        style={{ color: scheme['--editor-fg'] }}
                      >
                        {scenesList[selectedSceneIdx].hidden ? <FaEye size={12} /> : <FaEyeSlash size={12} />}
                      </button>
                    </div>
                  </div>
                  <div className="font-semibold mb-1">Characters in this scene:</div>
                  <div className="flex flex-col gap-2">
                    {sceneCharacters(selectedSceneIdx).length === 0 && <div className="text-neutral-400 italic">No characters found in this scene</div>}
                    {sceneCharacters(selectedSceneIdx).map(char => (
                      <button
                        key={char}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-blue-900/40 transition-colors"
                        onClick={() => {
                          handleSceneCharClick(char);
                          // Navigate to the first appearance of this character in the selected scene
                          const appearances = data.characters[char]?.appearances || [];
                          const sceneNum = selectedSceneIdx + 1;
                          const firstInScene = appearances.find(app => app.scene === sceneNum);
                          if (firstInScene && typeof firstInScene.position === 'number') {
                            setTimeline(firstInScene.position);
                          }
                        }}
                        style={{ borderLeft: `6px solid ${data.characters[char]?.color || '#888'}`, color: scheme['--editor-fg'] }}
                      >
                        <span>{char}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-neutral-400 italic">Select a scene to view characters</div>
              )}
            </div>
          </div>
        )}
      </div>
      {/* Characters Explorer Section */}
      <div className="px-4">
        <div className="flex items-center gap-2 mb-2">
          <button
            className="flex items-center gap-2 font-bold text-lg py-2 w-full text-left hover:bg-neutral-700/40 rounded text-white"
            onClick={() => setCharsOpen(o => !o)}
            style={{ color: scheme['--editor-fg'] }}
          >
            {charsOpen ? <FaChevronDown /> : <FaChevronRight />} <FaUser /> Characters
          </button>
        </div>
        {charsOpen && (
          <div className="flex flex-row gap-4 border border-neutral-700 rounded-xl p-4 mt-1 shadow-md custom-scrollbar"
            style={{ background: scheme['--editor-bg'], color: scheme['--editor-fg'] }}
          >
            {/* Left: Character List */}
            <div className="flex flex-col gap-2 min-w-[140px] w-1/3 pr-2">
              {/* Search and filter with funnel icon */}
              <div className="mb-2 flex flex-col gap-2">
                <div className="flex items-center gap-2 relative">
                  <div className="flex flex-row items-center gap-1 w-full">
                    <input
                      type="text"
                      value={charSearch}
                      onChange={e => setCharSearch(e.target.value)}
                      placeholder="Search..."
                      className="px-2 py-1 rounded bg-neutral-900 text-white border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      style={{ background: scheme['--editor-bg'], color: scheme['--editor-fg'], width: '70%' }}
                    />
                    <div className="relative" style={{ width: '30%' }}>
                      <button
                        className={`p-2 rounded hover:bg-blue-900/40 transition-colors ${showFilter ? 'bg-blue-800/80' : ''}`}
                        onClick={() => setShowFilter(f => !f)}
                        title="Filter by emotion"
                        type="button"
                        style={{ minWidth: 36, minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <FaFilter />
                      </button>
                      {/* Filter dropdown popover, positioned below the icon */}
                      {showFilter && (
                        <div className="absolute left-0 mt-2 z-10 bg-neutral-900 border border-neutral-700 rounded shadow-lg p-2 min-w-[120px]" style={{ background: scheme['--editor-bg'], color: scheme['--editor-fg'], top: '100%' }}>
                          <select
                            value={emotionFilter}
                            onChange={e => setEmotionFilter(e.target.value)}
                            className="w-full px-2 py-1 rounded bg-neutral-900 text-white border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            style={{ background: scheme['--editor-bg'], color: scheme['--editor-fg'] }}
                          >
                            <option value="All">All Emotions</option>
                            {allEmotions.map(emotion => (
                              <option key={emotion} value={emotion}>{emotion}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {charList.length === 0 && <div className="text-neutral-400 italic">No characters found</div>}
              {charList.map(([char, info]) => (
                <button
                  key={char}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-blue-900/40 transition-colors ${selectedChar === char ? 'bg-blue-800/80 font-bold' : ''} ${info.hidden ? 'opacity-50' : ''}`}
                  onClick={() => handleSelectChar(char)}
                  style={{ borderLeft: `6px solid ${info.color}`, color: scheme['--editor-fg'] }}
                >
                  <FaUser style={{ color: info.color }} />
                  <span>{char}</span>
                </button>
              ))}
            </div>
            {/* Right: Character Info */}
            <div className="flex-1 min-w-0 text-white" style={{ color: scheme['--editor-fg'] }}>
              {selectedCharData ? (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FaUser style={{ color: selectedCharData.color }} />
                    <span className="font-bold text-lg">{selectedChar}</span>
                    <div className="flex gap-1">
                      <button
                        className="p-1 rounded hover:bg-blue-700/60 transition-colors"
                        onClick={() => handleCharacterFocus(selectedChar)}
                        title={isCharacterFocused(selectedChar) ? "Reset focus (show all characters)" : "Focus on this character"}
                        style={{ color: scheme['--editor-fg'] }}
                      >
                        <FaCrosshairs size={12} />
                      </button>
                      <button
                        className="p-1 rounded hover:bg-blue-700/60 transition-colors"
                        onClick={() => handleCharacterHide(selectedChar)}
                        title={selectedCharData.hidden ? "Show this character" : "Hide this character"}
                        style={{ color: scheme['--editor-fg'] }}
                      >
                        {selectedCharData.hidden ? <FaEye size={12} /> : <FaEyeSlash size={12} />}
                      </button>
                    </div>
                  </div>
                  <div className="font-semibold mb-1">Appearances:</div>
                  <div className="flex flex-col gap-2">
                    {/* Group appearances by scene */}
                    {(() => {
                      if (!selectedCharData.appearances || selectedCharData.appearances.length === 0) {
                        return <div className="text-neutral-400 italic">No appearances found</div>;
                      }
                      // Group by scene
                      const grouped = {};
                      selectedCharData.appearances.forEach((app, idx) => {
                        if (!grouped[app.scene]) grouped[app.scene] = [];
                        grouped[app.scene].push({ ...app, _idx: idx });
                      });
                      // Sort scenes numerically
                      const sceneNumbers = Object.keys(grouped).map(Number).sort((a, b) => a - b);
                      return sceneNumbers.map(sceneNum => (
                        <div key={sceneNum} className="mb-2">
                          <div className="font-semibold text-purple-300 mb-1">
                            {data && data.scenes && data.scenes[sceneNum - 1] && data.scenes[sceneNum - 1].label
                              ? data.scenes[sceneNum - 1].label
                              : `Scene ${sceneNum}`}
                          </div>
                          <div className="flex flex-col gap-2">
                            {grouped[sceneNum].map(app => (
                              <div key={app._idx} className="border border-neutral-700 rounded-lg bg-blue-900/40">
                                <button
                                  className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-blue-800/60 rounded-lg transition-colors text-white"
                                  style={{ color: scheme['--editor-fg'] }}
                                  onClick={() => { toggleAppearance(app._idx); handleAppearanceClick(app.position); }}
                                >
                                  {expandedAppearances[app._idx] ? <FaChevronDown /> : <FaChevronRight />}
                                  <span className="font-mono text-xs text-neutral-300">{(app.position * 100).toFixed(1)}%</span>
                                  <span className="capitalize">{app.emotion}</span>
                                </button>
                                {expandedAppearances[app._idx] && (
                                  <div className="px-4 pb-2 text-sm text-neutral-200">
                                    <div className="mb-1"><span className="font-semibold">Text:</span> {app.text}</div>
                                    <div><span className="font-semibold">Sentiment:</span> {app.sentiment.toFixed(2)}</div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              ) : (
                <div className="text-neutral-400 italic">Select a character to view details</div>
              )}
            </div>
          </div>
        )}
      </div>
      <textarea
        className="overflow-y-scroll flex-1 w-full resize-none border-none outline-none text-lg p-6 mt-4 placeholder:text-neutral-400 font-mono tracking-wide"
        placeholder="Type or paste your story here..."
        value={story}
        onChange={e => setStory(e.target.value)}
        style={{ minHeight: '70vh', background: 'transparent', color: scheme['--editor-fg'] }}
      />
      
    </div>
  );
}