import React, { useRef, useMemo, useState, useEffect, useContext } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree, extend } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { Button, Card, Tag, Typography, Space, Empty, theme } from "antd";
import {
  EyeOutlined,
  EyeInvisibleOutlined,
  ArrowRightOutlined,
  ArrowLeftOutlined,
  AimOutlined,
} from "@ant-design/icons";

// Import the Context
import { ScriptStateContext } from "../contexts";

const { Text } = Typography;

// ==========================================
// 1. CONFIGURATION
// ==========================================

const SECTOR_CONFIG = {
  joy: { angle: 0, color: "#FFD700", label: "Joy" },
  trust: { angle: Math.PI * 0.25, color: "#00FF7F", label: "Trust" },
  fear: { angle: Math.PI * 0.5, color: "#228B22", label: "Fear" },
  surprise: { angle: Math.PI * 0.75, color: "#00BFFF", label: "Surprise" },
  sadness: { angle: Math.PI, color: "#4169E1", label: "Sadness" },
  disgust: { angle: Math.PI * 1.25, color: "#9932CC", label: "Disgust" },
  anger: { angle: Math.PI * 1.5, color: "#FF4500", label: "Anger" },
  anticipation: {
    angle: Math.PI * 1.75,
    color: "#FF8C00",
    label: "Anticipation",
  },
};

const EMOTIONS = Object.keys(SECTOR_CONFIG);
const Z_SCALE = 5; // 1 second of script = 5 units of depth

const pseudoRandom = (seed) => {
  let x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
};

// ==========================================
// 2. SHADERS
// ==========================================

const FocusingStrandMaterial = shaderMaterial(
  {
    uTime: 0,
    uColor: new THREE.Color(1, 1, 1),
    uCurrentZ: 0,
    uHover: 0,
  },
  `varying vec2 vUv; varying vec3 vPosition;
   void main() { vUv = uv; vPosition = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  `uniform float uCurrentZ; uniform vec3 uColor; uniform float uHover; varying vec3 vPosition;
   void main() {
      float dist = abs(vPosition.z - uCurrentZ);
      float proximity = 1.0 - smoothstep(0.0, 40.0, dist); 
      vec3 glow = uColor * (0.5 + (proximity * 2.0) + (uHover * 3.0));
      float opacity = 1.0 - smoothstep(50.0, 150.0, dist);
      gl_FragColor = vec4(glow, opacity); 
   }`
);
extend({ FocusingStrandMaterial });

// ==========================================
// 3. GEOMETRY
// ==========================================

const generateStrandCurve = (char, length) => {
  const points = [];
  const seed = char.name.length;

  let rawEmotion = (char.emotion || "").toLowerCase();
  const assignedEmotion = SECTOR_CONFIG[rawEmotion]
    ? rawEmotion
    : EMOTIONS[Math.floor(pseudoRandom(seed) * EMOTIONS.length)];
  const sector = SECTOR_CONFIG[assignedEmotion];
  const baseAngle = sector.angle;

  for (let z = 0; z <= length; z += 5) {
    const angleWobble = (pseudoRandom(z + seed) - 0.5) * 0.3;
    const currentAngle = baseAngle + angleWobble;
    const radiusBase = 8;
    const radiusWobble = (pseudoRandom(z * 2 + seed) - 0.5) * 1.5;
    const r = radiusBase + radiusWobble;
    const x = Math.cos(currentAngle) * r;
    const y = Math.sin(currentAngle) * r;
    points.push(new THREE.Vector3(x, y, z));
  }

  return {
    curve: new THREE.CatmullRomCurve3(points),
    emotion: assignedEmotion,
    color: char.color || SECTOR_CONFIG[assignedEmotion].color,
  };
};

// ==========================================
// 4. SUB-COMPONENTS
// ==========================================

const TunnelMesh = ({ length }) => (
  <mesh position={[0, 0, length / 2]} rotation={[Math.PI / 2, 0, 0]}>
    <cylinderGeometry args={[15, 15, length, 32, 1, true]} />
    <meshBasicMaterial
      color="#1f1f1f"
      side={THREE.BackSide}
      wireframe
      transparent
      opacity={0.05}
    />
  </mesh>
);

const CharacterStrand = ({ char, length, cameraZ, onHover, onClick }) => {
  const materialRef = useRef();
  const { curve, emotion, color } = useMemo(
    () => generateStrandCurve(char, length),
    [char, length]
  );
  const [hovered, setHover] = useState(false);

  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.uCurrentZ = cameraZ.current;
      materialRef.current.uHover = hovered ? 1.0 : 0.0;
    }
  });

  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, 128, 0.15, 8, false]} />
        <focusingStrandMaterial
          ref={materialRef}
          uColor={new THREE.Color(color)}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh
        visible={false}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          onHover(
            true,
            { name: char.name, emotion, color },
            e.clientX,
            e.clientY
          );
        }}
        onPointerOut={() => {
          setHover(false);
          onHover(false, null, 0, 0);
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick(char);
        }}
      >
        <tubeGeometry args={[curve, 64, 1.5, 8, false]} />
        <meshBasicMaterial color="white" />
      </mesh>
    </group>
  );
};

// --- UPDATED RIG: Driven by Local Time ---
const Rig = ({ localTime, onScrollDelta, onPan, onScrollPos }) => {
  const { camera, gl } = useThree();
  const currentZ = useRef(0);
  const isDragging = useRef(false);
  const prevMouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    camera.rotation.set(0, Math.PI, 0);
  }, [camera]);

  useEffect(() => {
    const canvas = gl.domElement;

    // SCROLL: Calculates Delta and sends to Parent (Visualizer -> Context)
    const handleWheel = (e) => {
      e.preventDefault();
      const deltaSeconds = e.deltaY * 0.01; // Adjust sensitivity
      if (onScrollDelta) onScrollDelta(deltaSeconds);
    };

    // PAN: Local camera rotation
    const handleDown = (e) => {
      if (e.button === 2) {
        isDragging.current = true;
        prevMouse.current = { x: e.clientX, y: e.clientY };
        if (onPan) onPan();
      }
    };
    const handleUp = () => (isDragging.current = false);
    const handleMove = (e) => {
      if (isDragging.current) {
        const deltaX = e.clientX - prevMouse.current.x;
        const deltaY = e.clientY - prevMouse.current.y;
        camera.rotation.y += deltaX * 0.002;
        camera.rotation.x = Math.max(
          -0.5,
          Math.min(0.5, camera.rotation.x - deltaY * 0.002)
        );
        prevMouse.current = { x: e.clientX, y: e.clientY };
      }
    };
    const handleContext = (e) => e.preventDefault();

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("mousedown", handleDown);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("mousemove", handleMove);
    canvas.addEventListener("contextmenu", handleContext);

    return () => {
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("mousedown", handleDown);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("mousemove", handleMove);
      canvas.removeEventListener("contextmenu", handleContext);
    };
  }, [camera, gl, onPan, onScrollDelta]);

  // SYNC: Move Camera to match Local Time
  useFrame(() => {
    const targetZ = localTime * Z_SCALE;
    currentZ.current = THREE.MathUtils.lerp(currentZ.current, targetZ, 0.1);
    camera.position.z = currentZ.current;

    if (onScrollPos) onScrollPos(currentZ.current);
  });

  return null;
};

// ==========================================
// 5. OVERLAYS
// ==========================================

const SectorOverlay = ({ visible }) => {
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
        style={{ opacity: 0.6 }}
      >
        <circle
          cx="50"
          cy="50"
          r="48"
          fill="none"
          stroke="#fff"
          strokeWidth="0.2"
          strokeDasharray="2,2"
        />
        {EMOTIONS.map((emo) => {
          const { angle, color, label } = SECTOR_CONFIG[emo];
          const rText = 42;
          const x = 50 + rText * Math.cos(angle);
          // FIX: Subtract sin(angle) because SVG Y-axis is inverted relative to 3D Y-axis
          const y = 50 - rText * Math.sin(angle);
          const y2End = 50 - 48 * Math.sin(angle);
          return (
            <g key={emo}>
              <line
                x1="50"
                y1="50"
                x2={50 + 48 * Math.cos(angle)}
                y2={y2End}
                stroke={color}
                strokeWidth="0.1"
              />
              <text
                x={x}
                y={y}
                fill={color}
                fontSize="3"
                textAnchor="middle"
                alignmentBaseline="middle"
                fontWeight="bold"
                style={{
                  textTransform: "uppercase",
                  textShadow: "0 0 2px black",
                }}
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ==========================================
// 6. MAIN COMPONENT
// ==========================================

export const Visualizer = ({ provider }) => {
  // CONSUME CONTEXT for 2-way binding
  const { currentTime, setCurrentTime, setFocusRequest } =
    useContext(ScriptStateContext);

  const [scenes, setScenes] = useState([]);
  const [allCharacters, setAllCharacters] = useState([]);

  const [showOverlay, setShowOverlay] = useState(true);
  const [tooltip, setTooltip] = useState(null);
  const [atSceneEnd, setAtSceneEnd] = useState(false);

  const cameraZRef = useRef(0);

  // Load Data
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

  // Calculate Scene & Local Time
  const { activeScene, sceneIndex, sceneLength, activeSceneStart } =
    useMemo(() => {
      if (scenes.length === 0)
        return {
          activeScene: null,
          sceneIndex: -1,
          sceneLength: 100,
          activeSceneStart: 0,
        };

      let accumulated = 0;
      for (let i = 0; i < scenes.length; i++) {
        const s = scenes[i];
        const duration = s.durationSecs || 10;
        if (
          currentTime >= accumulated &&
          currentTime < accumulated + duration
        ) {
          return {
            activeScene: s,
            sceneIndex: i,
            sceneLength: duration * Z_SCALE,
            activeSceneStart: accumulated,
          };
        }
        accumulated += duration;
      }
      // Fallback: End of script
      return {
        activeScene: scenes[scenes.length - 1],
        sceneIndex: scenes.length - 1,
        sceneLength: 100,
        activeSceneStart: accumulated,
      };
    }, [scenes, currentTime]);

  const strands = useMemo(() => {
    if (!activeScene) return [];
    const charList = Array.isArray(activeScene.characters)
      ? activeScene.characters
      : Array.from(activeScene.characters || []);
    return allCharacters.filter(
      (c) => charList.includes(c.name) || charList.includes(c.id)
    );
  }, [activeScene, allCharacters]);

  // --- INTERACTION HANDLERS ---

  // 1. Scroll: Update Global Time
  const handleScrollDelta = (delta) => {
    const newTime = Math.max(0, currentTime + delta);
    setCurrentTime(newTime);
  };

  // 2. Camera Update Feedback
  const handleScrollPos = (z) => {
    cameraZRef.current = z;
    setAtSceneEnd(z > sceneLength - 20); // Show next button if near end
  };

  // 3. Click Strand: Focus in Editor
  const onStrandClick = (char) => {
    setFocusRequest({
      type: "character-focus",
      characterId: char.id,
      characterName: char.name,
      timestamp: currentTime,
      trigger: Date.now(),
    });
  };

  // 4. Scene Navigation Buttons
  const jumpToScene = (index) => {
    let accumulated = 0;
    for (let i = 0; i < index; i++) {
      accumulated += scenes[i].durationSecs || 10;
    }
    setCurrentTime(accumulated + 0.1); // Jump to start of target scene
  };

  if (!activeScene)
    return (
      <Empty
        description="No Script Data"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        style={{ marginTop: "20%" }}
      />
    );

  // Calculate Local Time for the Rig (0 to Duration)
  const localTime = Math.max(0, currentTime - activeSceneStart);

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
      <SectorOverlay visible={showOverlay} />

      <Canvas camera={{ position: [0, 0, 0], fov: 75 }}>
        <EffectComposer disableNormalPass>
          <Bloom
            luminanceThreshold={0.1}
            mipmapBlur
            intensity={1.5}
            radius={0.6}
          />
        </EffectComposer>
        <fog attach="fog" args={["#050505", 10, 60]} />
        <ambientLight intensity={0.2} />

        <TunnelMesh length={sceneLength + 100} />

        <Rig
          localTime={localTime}
          onScrollDelta={handleScrollDelta}
          onScrollPos={handleScrollPos}
          onPan={() => setShowOverlay(false)}
        />

        <group>
          {strands.map((char) => (
            <CharacterStrand
              key={`${char.id}-${sceneIndex}`}
              char={char}
              length={sceneLength + 50}
              cameraZ={cameraZRef}
              onHover={(visible, data, x, y) =>
                setTooltip(visible ? { data, x, y } : null)
              }
              onClick={onStrandClick}
            />
          ))}
        </group>
      </Canvas>

      {/* HUD: Scene Info */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          zIndex: 10,
          pointerEvents: "none",
        }}
      >
        <Space direction="vertical" size={0}>
          <Text
            style={{
              color: "white",
              fontSize: 20,
              fontWeight: "bold",
              textShadow: "0 2px 4px black",
            }}
          >
            {activeScene.name}
          </Text>
          <Space>
            <Tag color="blue" bordered={false}>
              Scene {sceneIndex + 1} / {scenes.length}
            </Tag>
            <Tag color="orange" bordered={false}>
              {localTime.toFixed(1)}s /{" "}
              {(activeScene.durationSecs || 0).toFixed(1)}s
            </Tag>
          </Space>
        </Space>
      </div>

      {/* HUD: Toggles */}
      <div style={{ position: "absolute", bottom: 20, right: 20, zIndex: 10 }}>
        <Button
          ghost
          icon={showOverlay ? <EyeOutlined /> : <EyeInvisibleOutlined />}
          onClick={() => setShowOverlay(!showOverlay)}
        >
          {showOverlay ? "Hide Sectors" : "Show Sectors"}
        </Button>
      </div>

      {/* HUD: Tooltip */}
      {tooltip && (
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
              width: 200,
              background: "rgba(0,0,0,0.85)",
              border: `1px solid ${tooltip.data.color}`,
            }}
            bordered={false}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: tooltip.data.color,
                }}
              />
              <Text strong style={{ color: "white" }}>
                {tooltip.data.name}
              </Text>
            </div>
            <Tag color={tooltip.data.color} style={{ margin: 0 }}>
              {tooltip.data.emotion.toUpperCase()}
            </Tag>
            <div style={{ color: "#aaa", fontSize: 10, marginTop: 6 }}>
              <AimOutlined /> Click to locate
            </div>
          </Card>
        </div>
      )}

      {/* HUD: Navigation Markers (End of Scene) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          opacity: atSceneEnd ? 1 : 0,
          transition: "opacity 0.3s ease",
          background:
            "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 30%)",
          zIndex: 15,
        }}
      >
        <div
          style={{
            pointerEvents: "auto",
            display: "flex",
            gap: 16,
            marginTop: "20%",
          }}
        >
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => jumpToScene(sceneIndex - 1)}
            disabled={sceneIndex === 0}
          >
            Prev Scene
          </Button>
          <Button
            type="primary"
            icon={<ArrowRightOutlined />}
            onClick={() => jumpToScene(sceneIndex + 1)}
            disabled={sceneIndex >= scenes.length - 1}
          >
            Next Scene
          </Button>
        </div>
      </div>
    </div>
  );
};
