import React, { useRef, useState, useEffect } from "react";
import { theme, Tooltip, Typography } from "antd";
import { CaretDownOutlined } from "@ant-design/icons";

const { Text } = Typography;

// ==========================================
// HELPER: Format Seconds to MM:SS
// ==========================================
const formatTime = (seconds) => {
  if (!seconds && seconds !== 0) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
};

// ==========================================
// TIMELINE COMPONENT
// ==========================================

export const Timeline = ({ provider }) => {
  const { token } = theme.useToken();
  const containerRef = useRef(null);

  // Data State
  const [scenes, setScenes] = useState([]);
  const [totalDuration, setTotalDuration] = useState(1); // Avoid div by 0

  // UI State
  const [progress, setProgress] = useState(0); // 0 to 100
  const [isDragging, setIsDragging] = useState(false);

  // --- 1. SUBSCRIBE TO YJS DATA ---
  useEffect(() => {
    if (!provider) return;
    const map = provider.document.getMap("script_analysis");

    const updateHandler = () => {
      const sceneData = map.get("scenes") || [];

      // Calculate start/end times for each scene for rendering
      let accumulatedTime = 0;
      const processed = sceneData.map((s) => {
        const start = accumulatedTime;
        const duration = s.durationSecs || 10; // Fallback 10s
        accumulatedTime += duration;
        return { ...s, startTime: start, endTime: start + duration };
      });

      setScenes(processed);
      setTotalDuration(Math.max(accumulatedTime, 1)); // Ensure at least 1s
    };

    updateHandler(); // Initial load
    map.observe(updateHandler);
    return () => map.unobserve(updateHandler);
  }, [provider]);

  // --- 2. INTERACTION HANDLERS ---
  const handleSeek = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    let newProgress = (x / width) * 100;
    newProgress = Math.max(0, Math.min(100, newProgress));
    setProgress(newProgress);
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    handleSeek(e);
  };

  useEffect(() => {
    const handleWindowMouseMove = (e) => {
      if (isDragging) handleSeek(e);
    };
    const handleWindowMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener("mousemove", handleWindowMouseMove);
      window.addEventListener("mouseup", handleWindowMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, [isDragging]);

  const currentTime = (progress / 100) * totalDuration;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "0 20px",
        background: token.colorBgContainer,
        userSelect: "none",
      }}
    >
      {/* Time Indicator Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 8,
          alignItems: "flex-end",
        }}
      >
        <Text strong style={{ fontSize: 12 }}>
          TIMELINE
        </Text>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 12,
            background: token.colorFillTertiary,
            padding: "2px 8px",
            borderRadius: 4,
          }}
        >
          <span style={{ color: token.colorPrimary }}>
            {formatTime(currentTime)}
          </span>
          <span style={{ color: token.colorTextQuaternary }}> / </span>
          <span>{formatTime(totalDuration)}</span>
        </div>
      </div>

      {/* Timeline Track Area */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        style={{
          position: "relative",
          height: 24, // Vertically thinner
          background: token.colorFillTertiary,
          borderRadius: 4,
          cursor: "pointer",
          overflow: "hidden",
        }}
      >
        {/* Scenes Segments */}
        {scenes.map((scene) => {
          const widthPerc =
            ((scene.endTime - scene.startTime) / totalDuration) * 100;
          const leftPerc = (scene.startTime / totalDuration) * 100;

          return (
            <Tooltip
              key={scene.id}
              title={
                <div style={{ textAlign: "center" }}>
                  <div>{scene.name}</div>
                  <div style={{ fontSize: 10, opacity: 0.7 }}>
                    {formatTime(scene.startTime)} - {formatTime(scene.endTime)}
                  </div>
                </div>
              }
            >
              <div
                style={{
                  position: "absolute",
                  left: `${leftPerc}%`,
                  width: `${widthPerc}%`,
                  top: 0,
                  bottom: 0,
                  backgroundColor: scene.color,
                  opacity: 0.4,
                  borderRight: `1px solid ${token.colorBgContainer}`,
                  transition: "opacity 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = 0.8)}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = 0.4)}
              />
            </Tooltip>
          );
        })}

        {/* Ruler Ticks (Every 10%) */}
        {Array.from({ length: 11 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${i * 10}%`,
              bottom: 0,
              height: 6,
              width: 1,
              background: token.colorTextQuaternary,
              opacity: 0.5,
            }}
          />
        ))}

        {/* Scrubber Head & Line */}
        <div
          style={{
            position: "absolute",
            left: `${progress}%`,
            top: 0,
            bottom: 0,
            width: 2,
            background: token.colorPrimary,
            zIndex: 10,
            transform: "translateX(-50%)",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -8,
              left: "50%",
              transform: "translateX(-50%)",
              color: token.colorPrimary,
              fontSize: 14,
              filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.2))",
            }}
          >
            <CaretDownOutlined />
          </div>
        </div>
      </div>
    </div>
  );
};
