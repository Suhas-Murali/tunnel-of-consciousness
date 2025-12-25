import { useRef, useState, useEffect, useContext } from "react";
import { Tooltip, Typography } from "antd";
import { CaretDownOutlined } from "@ant-design/icons";
import { ScriptStateContext } from "../contexts";

const { Text } = Typography;

const formatTime = (seconds) => {
  if (!seconds && seconds !== 0) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
};

export const Timeline = ({ provider, token }) => {
  const { currentTime, setCurrentTime } = useContext(ScriptStateContext);

  const containerRef = useRef(null);
  const [scenes, setScenes] = useState([]);
  const [totalDuration, setTotalDuration] = useState(1);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!provider) return;
    const map = provider.document.getMap("script_analysis");
    const updateHandler = () => {
      const sceneData = map.get("scenes") || [];
      let accumulatedTime = 0;
      const processed = sceneData.map((s) => {
        const start = accumulatedTime;
        const duration = s.durationSecs || 10;
        accumulatedTime += duration;
        return { ...s, startTime: start, endTime: start + duration };
      });
      setScenes(processed);
      setTotalDuration(Math.max(accumulatedTime, 1));
    };
    updateHandler();
    map.observe(updateHandler);
    return () => map.unobserve(updateHandler);
  }, [provider]);

  const calculateTimeFromEvent = (e) => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    let percentage = x / width;
    percentage = Math.max(0, Math.min(1, percentage));
    return percentage * totalDuration;
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    const newTime = calculateTimeFromEvent(e);
    setCurrentTime(newTime); // Use Context Setter
  };

  useEffect(() => {
    const handleWindowMouseMove = (e) => {
      if (isDragging) {
        const newTime = calculateTimeFromEvent(e);
        setCurrentTime(newTime);
      }
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
  }, [isDragging, totalDuration, setCurrentTime]);

  const progressPercent = (currentTime / totalDuration) * 100;

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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 8,
          alignItems: "flex-end",
        }}
      >
        <Text strong style={{ fontSize: 12 }}>
          Breakdown
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
          <span style={{ color: token.colorTextSecondary }}>
            {formatTime(totalDuration)}
          </span>
        </div>
      </div>

      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        style={{
          position: "relative",
          height: 20,
          background: token.colorFillTertiary,
          borderRadius: 4,
          cursor: "pointer",
          overflow: "hidden",
        }}
      >
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
        {Array.from({ length: 11 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${i * 10}%`,
              bottom: 0,
              height: 8,
              width: 2,
              background: token.colorTextQuaternary,
              opacity: 0.5,
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            left: `${progressPercent}%`,
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
