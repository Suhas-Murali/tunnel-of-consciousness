import React, { useRef, useMemo, useState, useEffect } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree, extend } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import {
  Button,
  Result,
  Card,
  Tag,
  Typography,
  Space,
} from "antd";
import {
  InfoCircleOutlined,
  EyeOutlined,
  ArrowLeftOutlined,
  EyeInvisibleOutlined,
  ReloadOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons";

const { Text } = Typography;

// ==========================================
// 1. CONFIGURATION & UTILS
// ==========================================


const SECTOR_CONFIG = {
  joy: { angle: 0, color: "#FFD700" },
  trust: { angle: Math.PI * 0.25, color: "#00FF7F" },
  fear: { angle: Math.PI * 0.5, color: "#228B22" },
  surprise: { angle: Math.PI * 0.75, color: "#00BFFF" },
  sadness: { angle: Math.PI, color: "#4169E1" },
  disgust: { angle: Math.PI * 1.25, color: "#9932CC" },
  anger: { angle: Math.PI * 1.5, color: "#FF4500" },
  anticipation: { angle: Math.PI * 1.75, color: "#FF8C00" },
};

const EMOTIONS = Object.keys(SECTOR_CONFIG);

const pseudoRandom = (seed) => {
  let x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
};

// ==========================================
// 2. SHADERS
// ==========================================

const BloomStrandMaterial = shaderMaterial(
  {
    uTime: 0,
    uColor: new THREE.Color(1, 1, 1),
    uCurrentZ: 0,
    uSignificance: 1.0,
  },
  `varying vec2 vUv; varying vec3 vPosition;
   void main() { vUv = uv; vPosition = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  `uniform float uCurrentZ; uniform vec3 uColor; uniform float uSignificance; varying vec3 vPosition;
   void main() {
      float dist = abs(vPosition.z - uCurrentZ);
      float proximity = 1.0 - smoothstep(0.0, 25.0, dist);
      vec3 finalColor = mix(uColor * 0.2, uColor * 10.0 * uSignificance, proximity);
      gl_FragColor = vec4(finalColor, proximity); 
   }`
);
extend({ BloomStrandMaterial });

// ==========================================
// 3. 3D SUB-COMPONENTS
// ==========================================

const generateStrandPoints = (char, length) => {
  const points = [];
  const seed = char.name.length;
  const emotionIdx = Math.floor(pseudoRandom(seed) * EMOTIONS.length);
  const assignedEmotion = char.emotion || EMOTIONS[emotionIdx];
  const sector = SECTOR_CONFIG[assignedEmotion];

  const baseAngle = sector.angle;

  for (let z = 0; z <= length; z += 2) {
    const angleWobble = (pseudoRandom(z + seed) - 0.5) * 0.6;
    const currentAngle = baseAngle + angleWobble;
    const radiusBase = 6;
    const radiusWobble = (pseudoRandom(z * 2 + seed) - 0.5) * 3;
    const x = Math.cos(currentAngle) * (radiusBase + radiusWobble);
    const y = Math.sin(currentAngle) * (radiusBase + radiusWobble);
    points.push(new THREE.Vector3(x, y, z));
  }
  return { points, emotion: assignedEmotion };
};

const Tunnel = ({ length }) => (
  <mesh position={[0, 0, length / 2]}>
    <cylinderGeometry args={[12, 12, length, 32, 1, true]} />
    <meshBasicMaterial
      color="#080808"
      side={THREE.BackSide}
      wireframe
      transparent
      opacity={0.05}
    />
  </mesh>
);

const CharacterStrand = ({ char, length, cameraZ, onHover, onClick }) => {
  const materialRef = useRef();
  const { curve, emotion } = useMemo(() => {
    const { points, emotion } = generateStrandPoints(char, length);
    return { curve: new THREE.CatmullRomCurve3(points), emotion };
  }, [char, length]);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uCurrentZ = cameraZ.current;
      materialRef.current.uTime = state.clock.elapsedTime;
    }
  });

  const color = new THREE.Color(SECTOR_CONFIG[emotion].color);
  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, 128, 0.1, 8, false]} />
        <bloomStrandMaterial
          ref={materialRef}
          uColor={color}
          uSignificance={1.0}
          transparent
          toneMapped={false}
        />
      </mesh>
      <mesh
        visible={false}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
          onHover(true, { ...char, emotion }, e.clientX, e.clientY);
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
          onHover(false, null, 0, 0);
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick(char);
        }}
      >
        <tubeGeometry args={[curve, 64, 0.8, 8, false]} />
        <meshBasicMaterial color="white" />
      </mesh>
    </group>
  );
};

const Rig = ({ length, onEndReached, cameraZ, onPan, resetTrigger }) => {
  const { camera, gl } = useThree();
  const targetZ = useRef(0);
  const currentZ = useRef(0);
  const isDragging = useRef(false);
  const prevMouse = useRef({ x: 0, y: 0 });

  // Handle Camera Reset (Snap to Center)
  useEffect(() => {
    camera.rotation.set(0, 0, 0);
  }, [resetTrigger, camera]);

  // Initial Reset
  useEffect(() => {
    targetZ.current = 0;
    currentZ.current = 0;
    camera.rotation.set(0, 0, 0);
    cameraZ.current = 0;
  }, [length, cameraZ, camera]);

  useEffect(() => {
    const handleWheel = (e) => {
      e.preventDefault();
      targetZ.current = Math.max(
        0,
        Math.min(length, targetZ.current + e.deltaY * 0.05)
      );
    };

    const handleDown = (e) => {
      if (e.button === 2) {
        isDragging.current = true;
        prevMouse.current = { x: e.clientX, y: e.clientY };
        // Notify parent that user is panning
        if (onPan) onPan();
      }
    };

    const handleUp = () => (isDragging.current = false);

    const handleMove = (e) => {
      if (isDragging.current) {
        const deltaX = e.clientX - prevMouse.current.x;
        const deltaY = e.clientY - prevMouse.current.y;
        camera.rotation.y -= deltaX * 0.002;
        camera.rotation.x = Math.max(
          -Math.PI / 3,
          Math.min(Math.PI / 3, camera.rotation.x - deltaY * 0.002)
        );
        prevMouse.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handleContextMenu = (e) => e.preventDefault();
    const canvas = gl.domElement;
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("mousedown", handleDown);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("mousemove", handleMove);
    canvas.addEventListener("contextmenu", handleContextMenu);
    return () => {
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("mousedown", handleDown);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("mousemove", handleMove);
      canvas.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [camera, gl, length, onPan]);

  useFrame(() => {
    currentZ.current = THREE.MathUtils.lerp(
      currentZ.current,
      targetZ.current,
      0.08
    );
    camera.position.z = currentZ.current;
    cameraZ.current = currentZ.current;
    onEndReached(currentZ.current > length - 10);
  });
  return null;
};

// ==========================================
// 4. UI COMPONENTS (HTML OVERLAYS)
// ==========================================

const EmotionOverlay = ({ visible }) => {
  if (!visible) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 5,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        width="600"
        height="600"
        viewBox="0 0 100 100"
        style={{ filter: "drop-shadow(0px 0px 4px rgba(0,0,0,1))" }}
      >
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="#fff"
          strokeWidth="0.5"
          strokeOpacity="0.5"
          strokeDasharray="1,2"
        />
        {EMOTIONS.map((emo) => {
          const { angle, color } = SECTOR_CONFIG[emo];
          const r = 40;
          const x = 50 + r * Math.cos(angle);
          const y = 50 - r * Math.sin(angle);

          return (
            <g key={emo}>
              <line
                x1="50"
                y1="50"
                x2={50 + 45 * Math.cos(angle)}
                y2={50 - 45 * Math.sin(angle)}
                stroke={color}
                strokeWidth="0.2"
                strokeOpacity="0.8"
              />
              <text
                x={x}
                y={y}
                fill={color}
                fontSize="2.5"
                fontWeight="bold"
                textAnchor="middle"
                alignmentBaseline="middle"
                style={{
                  textTransform: "uppercase",
                  textShadow: "1px 1px 2px #000",
                }}
              >
                {emo}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ==========================================
// 5. MAIN COMPONENT EXPORT
// ==========================================

export const Visualizer = ({ provider }) => {
  const [scenes, setScenes] = useState([]);
  const [allCharacters, setAllCharacters] = useState([]);
  const [sceneIndex, setSceneIndex] = useState(0);

  const [tooltip, setTooltip] = useState({
    visible: false,
    x: 0,
    y: 0,
    data: null,
  });
  const [showOverlay, setShowOverlay] = useState(true);
  const [atEndOfScene, setAtEndOfScene] = useState(false);

  // Triggers camera reset in Rig
  const [resetStack, setResetStack] = useState(0);

  const cameraZ = useRef(0);

  useEffect(() => {
    if (!provider) return;
    const map = provider.document.getMap("script_analysis");
    const updateHandler = () => {
      setScenes(map.get("scenes") || []);
      setAllCharacters(map.get("characters") || []);
    };
    updateHandler();
    map.observe(updateHandler);
    return () => map.unobserve(updateHandler);
  }, [provider]);

  const activeScene = scenes[sceneIndex];
  const sceneStrands = useMemo(() => {
    if (!activeScene) return [];

    const charList = Array.isArray(activeScene.characters)
      ? activeScene.characters
      : Array.from(activeScene.characters || []);

    return allCharacters.filter(
      (c) => charList.includes(c.name) || charList.includes(c.id)
    );
  }, [activeScene, allCharacters]);

  const sceneLength = 100 + (activeScene?.durationSecs || 0);

  // --- HANDLERS ---
  const handleToggleOverlay = () => {
    const nextState = !showOverlay;
    setShowOverlay(nextState);
    if (nextState === true) {
      // Snap camera back to center if turning overlay ON
      setResetStack((s) => s + 1);
    }
  };

  const handleUserPan = () => {
    // If user starts panning, hide overlay
    if (showOverlay) setShowOverlay(false);
  };

  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        background: "#050505",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* 2D HTML Overlay (Always Visible) */}
      <EmotionOverlay visible={showOverlay} />

      <Canvas camera={{ position: [0, 0, 0], fov: 75 }}>
        <EffectComposer disableNormalPass>
          <Bloom
            luminanceThreshold={0.2}
            mipmapBlur
            intensity={1.2}
            radius={0.5}
          />
        </EffectComposer>
        <fog attach="fog" args={["#050505", 5, 40]} />
        <ambientLight intensity={0.1} />

        <Tunnel length={sceneLength} />

        <Rig
          length={sceneLength}
          onEndReached={setAtEndOfScene}
          cameraZ={cameraZ}
          onPan={handleUserPan}
          resetTrigger={resetStack}
        />

        <group>
          {sceneStrands.map((char) => (
            <CharacterStrand
              key={`${char.id}-${sceneIndex}`}
              char={char}
              length={sceneLength}
              cameraZ={cameraZ}
              onHover={(isActive, d, x, y) =>
                setTooltip({ visible: isActive, data: d, x, y })
              }
              onClick={() => {}}
            />
          ))}
        </group>
      </Canvas>

      {/* --- HUD --- */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          zIndex: 10,
          pointerEvents: "none",
        }}
      >
        <Space direction="vertical">
          <Text style={{ color: "white", fontSize: 18, fontWeight: "bold" }}>
            {activeScene ? activeScene.name : "Loading..."}
          </Text>
          <Space>
            <Tag color="blue">
              {sceneIndex + 1} / {scenes.length} Scenes
            </Tag>
            {activeScene && (
              <Tag color="purple">
                {activeScene.characters.length} Characters
              </Tag>
            )}
          </Space>
        </Space>
      </div>

      {/* Bottom Right Controls */}
      <div style={{ position: "absolute", bottom: 20, right: 20, zIndex: 10 }}>
        <Space>
          <Button
            shape="circle"
            icon={<ReloadOutlined />}
            onClick={() => setSceneIndex(0)}
            style={{
              color: "white",
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          />
          <Button
            type="text"
            icon={showOverlay ? <EyeOutlined /> : <EyeInvisibleOutlined />}
            onClick={handleToggleOverlay}
            style={{
              color: "white",
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          >
            {showOverlay ? "Hide Sectors" : "Show Sectors"}
          </Button>
        </Space>
      </div>

      {tooltip.visible && tooltip.data && (
        <div
          style={{
            position: "absolute",
            top: tooltip.y - 20,
            left: tooltip.x,
            transform: "translate(-50%, -100%)",
            zIndex: 20,
            pointerEvents: "none",
          }}
        >
          <Card
            size="small"
            style={{
              width: 220,
              background: "rgba(10,10,10,0.8)",
              borderColor: "#444",
              backdropFilter: "blur(10px)",
            }}
            bordered={false}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background:
                    SECTOR_CONFIG[tooltip.data.emotion]?.color || "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "bold",
                  color: "#000",
                  fontSize: 10,
                }}
              >
                {tooltip.data.name.substring(0, 1)}
              </div>
              <div>
                <Text
                  strong
                  style={{ color: "#fff", display: "block", lineHeight: 1 }}
                >
                  {tooltip.data.name}
                </Text>
              </div>
            </div>
            <Tag
              color={SECTOR_CONFIG[tooltip.data.emotion]?.color}
              style={{ color: "#000" }}
            >
              {(tooltip.data.emotion || "neutral").toUpperCase()}
            </Tag>
          </Card>
        </div>
      )}

      {/* End Prompt - Scroll Passthrough */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: atEndOfScene ? "rgba(0,0,0,0.8)" : "transparent",
          pointerEvents: "none", // Allows scrolling through overlay
          opacity: atEndOfScene ? 1 : 0,
          transition: "opacity 0.5s",
          zIndex: 15,
        }}
      >
        <div
          style={{
            textAlign: "center",
            pointerEvents: atEndOfScene ? "auto" : "none",
          }}
        >
          <Result
            status="success"
            icon={<InfoCircleOutlined style={{ color: "#fff" }} />}
            title={<span style={{ color: "#fff" }}>Scene Complete</span>}
            subTitle={
              <span style={{ color: "#aaa" }}>
                Scroll up to review or continue.
              </span>
            }
            extra={[
              <Button
                key="prev"
                icon={<ArrowLeftOutlined />}
                onClick={() => {
                  setSceneIndex((s) => Math.max(0, s - 1));
                  setAtEndOfScene(false);
                }}
                disabled={sceneIndex === 0}
              >
                Previous
              </Button>,
              <Button
                key="next"
                type="primary"
                icon={<ArrowRightOutlined />}
                onClick={() => {
                  setSceneIndex((s) => Math.min(scenes.length - 1, s + 1));
                  setAtEndOfScene(false);
                }}
                disabled={sceneIndex === scenes.length - 1}
              >
                Next Scene
              </Button>,
            ]}
          />
        </div>
      </div>
    </div>
  );
};