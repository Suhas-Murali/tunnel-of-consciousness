import React, { useRef, useState } from 'react';
import { FaSave, FaFolderOpen, FaPlay, FaChevronDown, FaChevronRight, FaUser, FaSync, FaFilter } from 'react-icons/fa';

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

  // Save to file handler
  const handleSaveToFile = () => {
    if (!data) return;
    const toSave = { ...data, script: story };
    const blob = new Blob([JSON.stringify(toSave, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tunnel-data.json';
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

  return (
    <div
      className="flex flex-col min-w-0 h-full relative"
      style={{ flexBasis: '40%', background: scheme['--editor-bg'] }}
    >
      {/* Top buttons for save/load */}
      <div className="flex flex-row gap-4 p-4 justify-start">
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
      </div>
      {/* Characters Explorer Section */}
      <div className="px-4">
        <div className="flex items-center gap-2 mb-2">
          <button
            className="flex items-center gap-2 font-bold text-lg py-2 w-full text-left hover:bg-neutral-700/40 rounded text-white"
            onClick={() => setCharsOpen(o => !o)}
            style={{ color: scheme['--editor-fg'] }}
          >
            {charsOpen ? <FaChevronDown /> : <FaChevronRight />} Characters
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
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-blue-900/40 transition-colors ${selectedChar === char ? 'bg-blue-800/80 font-bold' : ''}`}
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
                  </div>
                  <div className="font-semibold mb-1">Appearances:</div>
                  <div className="flex flex-col gap-2">
                    {selectedCharData.appearances.map((app, idx) => (
                      <div key={idx} className="border border-neutral-700 rounded-lg bg-blue-900/40">
                        <button
                          className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-blue-800/60 rounded-lg transition-colors text-white"
                          style={{ color: scheme['--editor-fg'] }}
                          onClick={() => { toggleAppearance(idx); handleAppearanceClick(app.position); }}
                        >
                          {expandedAppearances[idx] ? <FaChevronDown /> : <FaChevronRight />}
                          <span className="font-mono text-xs text-neutral-300">{(app.position * 100).toFixed(1)}%</span>
                          <span className="capitalize">{app.emotion}</span>
                        </button>
                        {expandedAppearances[idx] && (
                          <div className="px-4 pb-2 text-sm text-neutral-200">
                            <div className="mb-1"><span className="font-semibold">Text:</span> {app.text}</div>
                            <div><span className="font-semibold">Sentiment:</span> {app.sentiment.toFixed(2)}</div>
                          </div>
                        )}
                      </div>
                    ))}
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
        className="overflow-y-scroll flex-1 w-full resize-none border-none outline-none text-lg p-6 placeholder:text-neutral-400 font-mono tracking-wide"
        placeholder="Type or paste your story here..."
        value={story}
        onChange={e => setStory(e.target.value)}
        style={{ minHeight: 0, background: 'transparent', color: scheme['--editor-fg'] }}
      />
      {/* Controls at bottom */}
      <div className="absolute bottom-0 left-0 w-full px-0 pb-6 flex flex-col items-center">
        <div className="flex flex-row gap-4 w-full justify-end px-6">
          <button
            className="px-6 py-2 font-bold rounded-lg bg-neutral-700 text-white hover:bg-neutral-600 transition-colors shadow border border-neutral-600 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
            onClick={handleRunAnalysis}
            disabled={isAnalyzing}
          >
            <FaPlay /> {isAnalyzing ? 'Analyzing...' : 'Run Analysis'}
          </button>
        </div>
        <input
          type="range"
          className="w-3/4 mt-6 accent-blue-500 h-2 rounded-lg appearance-none bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          min={0}
          max={1}
          step={0.001}
          value={timeline}
          onChange={e => setTimeline(Number(e.target.value))}
          disabled={isAnalyzing}
          style={{ position: 'relative' }}
        />
      </div>
    </div>
  );
}