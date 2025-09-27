import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import {  FaSave, FaFolderOpen, FaPlay, FaArrowLeft, FaCube, FaBorderAll, FaColumns } from "react-icons/fa";

import TunnelScene, { SceneTimelineBar } from "../visualizer/TunnelScene";
import EditorArea from "../editor/editor.jsx";
import {
  getProfile,
  getScriptData,
  generateEmotionData,
  logout,
  parseScript,
} from "../api";

function ScriptPage() {
  const fileInputRef = useRef();

  const { name } = useParams();
  const navigate = useNavigate();

  const [nameField, setName] = useState(name || 'tunnel-data');
  const [story, setStory] = useState("");
  const [data, setData] = useState(null);
  const [user, setUser] = useState(null);
  const [timeline, setTimeline] = useState(0);
  const [viewMode, setViewMode] = useState("2d-front");
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // State for resizable panes
  const [leftWidth, setLeftWidth] = useState(52);
  const [isDragging, setIsDragging] = useState(false);

  // Initial data loading and authentication
  useEffect(() => {
    const initializePage = async () => {
      if (localStorage.getItem("isLoggedIn") !== "true") {
        navigate("/auth/login");
        return;
      }

      try {
        const [profileRes, scriptRes] = await Promise.all([
          getProfile(),
          getScriptData(name),
        ]);

        setUser(profileRes.data.user);

        if (scriptRes.data && scriptRes.data.script) {
          setStory(scriptRes.data.script.script); // Set editor content
          setData(scriptRes.data.script); // Set visualization data
        } else {
          // If script doesn't exist, we can still allow the user to create it
          setStory(`TITLE: ${name}\n\n[SCENE START]\n\n`);
        }
      } catch (error) {
        console.error("Failed to load script data:", error);
        // If auth fails, token might be invalid
        if (
          error.response &&
          (error.response.status === 401 || error.response.status === 403)
        ) {
          handleLogout(); // Use the logout function to clear state
        }
        // Handle script not found specifically, maybe show a message
      } finally {
        setIsLoading(false);
      }
    };

    initializePage();
  }, [name, navigate]);

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      // Per your request, calling parseScript first.
      const parsed = await parseScript(story);

      // Then calling the generate function which saves and returns the full analysis
      const response = await generateEmotionData(name, {
        script: story,
        ...parsed.data.parsed,
      });
      setData(response.data.script); // Update the visualization with the new data
    } catch (err) {
      console.error("Analysis failed:", err);
      // Optionally show an error to the user
    }
    setIsAnalyzing(false);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Server logout failed, logging out client-side.", error);
    } finally {
      localStorage.removeItem("isLoggedIn");
      navigate("/auth/login");
    }
  };

  // Drag handlers for resizer
  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    document.body.style.cursor = "col-resize";
  };
  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e) => {
      const totalWidth = window.innerWidth;
      let newLeft = (e.clientX / totalWidth) * 100;
      newLeft = Math.max(20, Math.min(80, newLeft)); // clamp
      setLeftWidth(newLeft);
    };
    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = "";
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const viewButtons = [
    { mode: "3d", label: "3D", icon: <FaCube /> },
    { mode: "2d-front", label: "Front", icon: <FaBorderAll /> },
    { mode: "2d-side", label: "Side", icon: <FaColumns /> },
  ];

  // Save to file handler
  const handleSaveToFile = () => {
    if (!data) return;
    const toSave = { ...data, script: story, name: nameField };
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-gray-200">
        Loading Script...
      </div>
    );
  }

  return (
    <div className="flex flex-col w-screen h-screen bg-gray-900 text-white">
      <header className="flex items-center justify-between p-4 bg-gray-800 shadow-md flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="text-xl hover:text-blue-400 focus:outline-none"
            aria-label="Go back"
          >
            <FaArrowLeft />
          </button>
          <h1 className="text-2xl">
            <Link to="/dashboard" className="no-underline text-white font-bold">
              TOC
            </Link>
          </h1>
        </div>
         {/* xl and up: single row, below xl: two rows */}
                <div className="hidden 2xl:flex flex-row gap-4 justify-start items-center">
                  <input
                    type="text"
                    value={nameField}
                    onChange={e => setName(e.target.value)}
                    placeholder="File name..."
                    className="px-3 py-2 rounded-lg bg-neutral-900 text-white border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base font-mono"
                    //style={{ background: scheme['--editor-bg'], color: scheme['--editor-fg'], width: 180 }}
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
                    className="px-4 py-2 font-bold rounded-lg bg-neutral-700 text-white hover:bg-neutral-600 transition-colors shadow border border-neutral-600 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 ml-auto"
                    onClick={handleRunAnalysis}
                    disabled={isAnalyzing}
                  >
                    <FaPlay /> {isAnalyzing ? 'Analyzing...' : 'Run Analysis'}
                  </button>
                </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-300">{user?.username}</span>
          <button
            onClick={handleLogout}
            className="py-2 px-4 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Logout
          </button>
        </div>
      </header>
      <div className="flex flex-row flex-grow min-h-0">
        <div
          className="relative flex-shrink-0 min-w-0 h-full"
          style={{ width: `${leftWidth}%` }}
        >
          <SceneTimelineBar
            data={data}
            timeline={timeline}
            onSceneSelect={setTimeline}
          />
          <div className="absolute bottom-4 left-4 z-20 flex gap-2">
            {viewButtons
              .filter((b) => b.mode !== viewMode)
              .map((b) => (
                <button
                  key={b.mode}
                  onClick={() => setViewMode(b.mode)}
                  className="bg-gray-800 bg-opacity-80 text-white border border-gray-600 rounded-lg px-4 py-2 font-bold text-sm cursor-pointer shadow-lg flex items-center gap-2 hover:bg-gray-700"
                >
                  {b.icon} {b.label}
                </button>
              ))}
          </div>
          <Canvas className="w-full h-full bg-gray-900">
            <TunnelScene
              data={data}
              colorScheme={{ sceneBg: "#111827" }} // bg-gray-900
              viewMode={viewMode}
              timeline={timeline}
              onSceneSelect={setTimeline}
            />
          </Canvas>
        </div>
        <div
          className="w-2 cursor-col-resize z-50 transition-colors duration-100 ease-in-out hover:bg-blue-600"
          style={{ background: isDragging ? "#2563eb" : "#1f2937" }} // blue-600 and gray-800
          onMouseDown={handleMouseDown}
        />
        <div
          style={{ width: `${100 - leftWidth}%` }}
          className="min-w-0 h-full"
        >
          <EditorArea
            story={story}
            setStory={setStory}
            timeline={timeline}
            setTimeline={setTimeline}
            isAnalyzing={isAnalyzing}
            handleRunAnalysis={handleRunAnalysis}
            data={data}
            setData={setData}
            // Pass a simplified dark theme object for the editor
            scheme={{
              "--editor-bg": "#1f2937", // bg-gray-800
              "--editor-text": "#d1d5db", // text-gray-300
              "--editor-line-numbers": "#4b5563", // text-gray-600
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default ScriptPage;
