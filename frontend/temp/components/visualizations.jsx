import React, { useRef, useMemo, useState, useEffect } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree, extend } from "@react-three/fiber";
import { Html, shaderMaterial } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { Button, Result, Card, Tag, Typography } from "antd";
import { ArrowRightOutlined, UserOutlined } from "@ant-design/icons";

const { Text, Title } = Typography;

// ==========================================
// 1. MOCK DATA & CONFIG
// ==========================================
const TUNNEL_LENGTH = 100;
const TUNNEL_RADIUS = 6;
const BASE_THICKNESS = 0.05;

const CHARACTERS = [
  {
    id: "char-1",
    name: "Commander Shepard",
    emotion: "Determination",
    color: new THREE.Color("#ff0040"),
    significance: 2.0,
    points: [
      [-2, 1, 0],
      [-2.5, 2, 25],
      [-1.5, 0.5, 50],
      [-2, 1, 75],
      [-2, 3, 100],
    ],
  },
  {
    id: "char-2",
    name: "Liara T'Soni",
    emotion: "Grief",
    color: new THREE.Color("#0040ff"),
    significance: 0.8,
    points: [
      [2, -1, 0],
      [2.2, -1.5, 25],
      [1.8, -0.5, 50],
      [2, -2, 75],
      [2.5, -1, 100],
    ],
  },
  {
    id: "char-3",
    name: "Garrus Vakarian",
    emotion: "Supportive",
    color: new THREE.Color("#00ff80"),
    significance: 1.2,
    points: [
      [0.5, 3, 0],
      [0.8, 2.8, 25],
      [0.2, 3.2, 50],
      [0.5, 3, 100],
    ],
  },
  {
    id: "char-4",
    name: "Tali'Zorah",
    emotion: "Curiosity",
    color: new THREE.Color("#ffff00"),
    significance: 1.2,
    points: [
      [0.8, 3.2, 0],
      [1.1, 3.0, 25],
      [0.5, 3.4, 50],
      [0.8, 3.2, 100],
    ],
  },
];

// ==========================================
// 2. HDR BLOOM SHADER
// ==========================================

const BloomStrandMaterial = shaderMaterial(
  {
    uTime: 0,
    uColor: new THREE.Color(1, 1, 1),
    uCurrentZ: 0,
    uSignificance: 1.0,
  },
  `
    varying vec2 vUv;
    varying vec3 vPosition;
    void main() {
      vUv = uv;
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  `
    uniform float uCurrentZ;
    uniform vec3 uColor;
    uniform float uSignificance;
    varying vec3 vPosition;

    void main() {
      float dist = abs(vPosition.z - uCurrentZ);
      float proximity = 1.0 - smoothstep(0.0, 8.0, dist);
      
      vec3 baseColor = uColor * 0.2; 
      float bloomIntensity = 10.0 * uSignificance; 
      vec3 activeColor = uColor * bloomIntensity;
      
      vec3 finalColor = mix(baseColor, activeColor, proximity);
      
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
);

extend({ BloomStrandMaterial });

// ==========================================
// 3. SCENE COMPONENTS
// ==========================================

const Tunnel = () => {
  return (
    <mesh position={[0, 0, TUNNEL_LENGTH / 2]} rotation={[0, 0, 0]}>
      <cylinderGeometry
        args={[TUNNEL_RADIUS, TUNNEL_RADIUS, TUNNEL_LENGTH, 32, 1, true]}
      />
      <meshBasicMaterial
        color="#222"
        side={THREE.BackSide}
        wireframe
        transparent
        opacity={0.15}
      />
    </mesh>
  );
};

const CharacterStrand = ({ data, currentZ, onHover, onClick }) => {
  const materialRef = useRef();

  const curve = useMemo(() => {
    const vectors = data.points.map((p) => new THREE.Vector3(...p));
    return new THREE.CatmullRomCurve3(vectors);
  }, [data]);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uCurrentZ = currentZ.current;
      materialRef.current.uTime = state.clock.elapsedTime;
    }
  });

  const radius = BASE_THICKNESS * data.significance;

  return (
    <group>
      {/* 1. VISIBLE MESH (The pretty, glowing, thin strand) */}
      <mesh>
        <tubeGeometry args={[curve, 128, radius, 8, false]} />
        <bloomStrandMaterial
          ref={materialRef}
          uColor={data.color}
          uSignificance={data.significance}
          toneMapped={false}
        />
      </mesh>

      {/* 2. HIT MESH (Invisible, thicker tube for easier clicking) */}
      <mesh
        visible={false}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer"; // Change cursor
          onHover(true, data, e.clientX, e.clientY);
        }}
        onPointerOut={(e) => {
          document.body.style.cursor = "auto"; // Reset cursor
          onHover(false, null, 0, 0);
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick(data);
        }}
      >
        {/* Radius is multiplied by 6 to make hit area generous */}
        <tubeGeometry args={[curve, 64, radius * 6, 8, false]} />
        <meshBasicMaterial color="white" transparent opacity={0} />
      </mesh>
    </group>
  );
};

// ==========================================
// 4. INTERACTION RIG
// ==========================================

const Rig = ({ onEndReached, onHoverStrand, onClickStrand }) => {
  const { camera, gl } = useThree();
  const targetZ = useRef(0);
  const currentZ = useRef(0);
  const isDragging = useRef(false);
  const prevMouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY * 0.05;
      targetZ.current = Math.max(
        0,
        Math.min(TUNNEL_LENGTH + 10, targetZ.current + delta)
      );
    };

    const handleDown = (e) => {
      if (e.button === 2) {
        isDragging.current = true;
        prevMouse.current = { x: e.clientX, y: e.clientY };
      }
    };
    const handleUp = () => (isDragging.current = false);
    const handleMove = (e) => {
      if (isDragging.current) {
        const deltaX = e.clientX - prevMouse.current.x;
        const deltaY = e.clientY - prevMouse.current.y;
        camera.rotation.y -= deltaX * 0.002;
        camera.rotation.x -= deltaY * 0.002;
        camera.rotation.x = Math.max(
          -Math.PI / 3,
          Math.min(Math.PI / 3, camera.rotation.x)
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
  }, [camera, gl]);

  useFrame(() => {
    currentZ.current = THREE.MathUtils.lerp(
      currentZ.current,
      targetZ.current,
      0.08
    );
    camera.position.z = currentZ.current;
    onEndReached(currentZ.current > TUNNEL_LENGTH - 2);
  });

  return (
    <group>
      {CHARACTERS.map((char) => (
        <CharacterStrand
          key={char.id}
          data={char}
          currentZ={currentZ}
          onHover={onHoverStrand}
          onClick={onClickStrand}
        />
      ))}
    </group>
  );
};

// ==========================================
// 5. MAIN COMPONENT
// ==========================================

const Visualizer = ({ token }) => {
  const [showEndPrompt, setShowEndPrompt] = useState(false);

  // Tooltip State
  const [tooltip, setTooltip] = useState({
    visible: false,
    x: 0,
    y: 0,
    data: null,
  });

  const handleStrandHover = (isActive, data, clientX, clientY) => {
    if (isActive) {
      setTooltip({ visible: true, x: clientX, y: clientY, data: data });
    } else {
      setTooltip((prev) => ({ ...prev, visible: false }));
    }
  };

  const handleStrandClick = (data) => {
    console.log(`[Interaction] Sync editor to line for: ${data.name}`);
    console.log(`[Interaction] Open Biodata Panel for: ${data.id}`);
    // FUTURE: Dispatch event or call prop here to sync editor
  };

  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        background: "#000",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Canvas camera={{ position: [0, 0, 0], fov: 75 }}>
        <EffectComposer disableNormalPass>
          <Bloom
            luminanceThreshold={1}
            mipmapBlur
            intensity={1.5}
            radius={0.6}
          />
        </EffectComposer>

        <fog attach="fog" args={["#000", 5, 50]} />
        <ambientLight intensity={0.1} />

        <Tunnel />
        <Rig
          onEndReached={setShowEndPrompt}
          onHoverStrand={handleStrandHover}
          onClickStrand={handleStrandClick}
        />
      </Canvas>

      {/* INSTRUCTIONS */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          color: "rgba(255,255,255,0.4)",
          pointerEvents: "none",
          userSelect: "none",
          zIndex: 5,
        }}
      >
        <p style={{ margin: 0 }}>🖱️ Scroll to move</p>
        <p style={{ margin: 0 }}>🖱️ Right-Click drag to look</p>
      </div>

      {/* TOOLTIP OVERLAY */}
      {tooltip.visible && tooltip.data && (
        <div
          style={{
            position: "absolute",
            top: tooltip.y + 15, // Offset slightly
            left: tooltip.x + 15,
            zIndex: 20,
            pointerEvents: "none", // Let clicks pass through
            transform: "translate(-50%, -50%)", // Center on cursor
          }}
        >
          <Card
            size="small"
            style={{
              width: 200,
              background: "rgba(0,0,0,0.85)",
              borderColor: "#333",
              backdropFilter: "blur(4px)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 4,
              }}
            >
              <UserOutlined
                style={{ color: "#" + tooltip.data.color.getHexString() }}
              />
              <Text strong style={{ color: "#fff", fontSize: 14 }}>
                {tooltip.data.name}
              </Text>
            </div>
            <Tag color={"#" + tooltip.data.color.getHexString()}>
              {tooltip.data.emotion}
            </Tag>
          </Card>
        </div>
      )}

      {/* END PROMPT */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: showEndPrompt ? "rgba(0,0,0,0.6)" : "transparent",
          backdropFilter: showEndPrompt ? "blur(4px)" : "none",
          opacity: showEndPrompt ? 1 : 0,
          transition: "all 0.5s ease",
          zIndex: 10,
          pointerEvents: "none",
        }}
      >
        <div style={{ pointerEvents: showEndPrompt ? "auto" : "none" }}>
          <Result
            status="success"
            title={<span style={{ color: "#fff" }}>End of Scene</span>}
            subTitle={
              <span style={{ color: "#ccc" }}>
                Scroll up to review or continue.
              </span>
            }
            extra={[
              <Button type="primary" key="next" icon={<ArrowRightOutlined />}>
                Next Scene
              </Button>,
            ]}
          />
        </div>
      </div>
    </div>
  );
};

export { Visualizer };
