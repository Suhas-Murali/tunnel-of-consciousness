import React from 'react';

export default function EditorArea({ story, setStory, timeline, setTimeline, isAnalyzing, handleRunAnalysis, scheme }) {
  return (
    <div
      className="flex flex-col min-w-0 h-full relative"
      style={{ flexBasis: '40%', background: scheme['--editor-bg'] }}
    >
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
            className="px-6 py-2 font-bold rounded-lg bg-neutral-700 text-white hover:bg-neutral-600 transition-colors shadow border border-neutral-600 disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={handleRunAnalysis}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? 'Analyzing...' : 'Run Analysis'}
          </button>
        </div>
        <input
          type="range"
          className="hidden w-3/4 mt-6 accent-blue-500 h-2 rounded-lg appearance-none bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
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