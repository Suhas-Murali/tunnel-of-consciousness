import React, { useRef, useMemo, useState, useEffect } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree, extend } from "@react-three/fiber";
import { Html, shaderMaterial } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { theme, Tooltip, Button, Result, Card, Tag, Typography } from "antd";
import {
  CaretDownOutlined,
  ArrowRightOutlined,
  UserOutlined,
} from "@ant-design/icons";

const { Text } = Typography;

// ==========================================
// 1. HDR BLOOM SHADER (Unchanged)
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
// 2. SCENE COMPONENTS
// ==========================================

const Tunnel = ({ config }) => {
  return (
    <mesh position={[0, 0, config.length / 2]} rotation={[0, 0, 0]}>
      <cylinderGeometry
        args={[config.radius, config.radius, config.length, 32, 1, true]}
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

const CharacterStrand = ({ data, config, currentZ, onHover, onClick }) => {
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

  const radius = config.baseThickness * data.significance;

  return (
    <group>
      {/* 1. VISIBLE MESH */}
      <mesh>
        <tubeGeometry args={[curve, 128, radius, 8, false]} />
        <bloomStrandMaterial
          ref={materialRef}
          uColor={data.color}
          uSignificance={data.significance}
          toneMapped={false}
        />
      </mesh>

      {/* 2. HIT MESH */}
      <mesh
        visible={false}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
          onHover(true, data, e.clientX, e.clientY);
        }}
        onPointerOut={(e) => {
          document.body.style.cursor = "auto";
          onHover(false, null, 0, 0);
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick(data);
        }}
      >
        <tubeGeometry args={[curve, 64, radius * 6, 8, false]} />
        <meshBasicMaterial color="white" transparent opacity={0} />
      </mesh>
    </group>
  );
};

// ==========================================
// 3. INTERACTION RIG
// ==========================================

const Rig = ({ config, data, onEndReached, onHoverStrand, onClickStrand }) => {
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
        Math.min(config.length + 10, targetZ.current + delta)
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
  }, [camera, gl, config.length]);

  useFrame(() => {
    currentZ.current = THREE.MathUtils.lerp(
      currentZ.current,
      targetZ.current,
      0.08
    );
    camera.position.z = currentZ.current;
    onEndReached(currentZ.current > config.length - 2);
  });

  return (
    <group>
      {data.map((char) => (
        <CharacterStrand
          key={char.id}
          data={char}
          config={config}
          currentZ={currentZ}
          onHover={onHoverStrand}
          onClick={onClickStrand}
        />
      ))}
    </group>
  );
};

// ==========================================
// 4. MAIN COMPONENT
// ==========================================

const Visualizer = ({ token, visualizerData = [], visualizerConfig }) => {
  const [showEndPrompt, setShowEndPrompt] = useState(false);
  const [tooltip, setTooltip] = useState({
    visible: false,
    x: 0,
    y: 0,
    data: null,
  });

  // Default config if not provided
  const config = visualizerConfig || {
    length: 100,
    radius: 6,
    baseThickness: 0.05,
  };

  const handleStrandHover = (isActive, data, clientX, clientY) => {
    if (isActive) {
      setTooltip({ visible: true, x: clientX, y: clientY, data: data });
    } else {
      setTooltip((prev) => ({ ...prev, visible: false }));
    }
  };

  const handleStrandClick = (data) => {
    console.log(`[Interaction] Clicked: ${data.name}`);
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

        <Tunnel config={config} />
        <Rig
          config={config}
          data={visualizerData}
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
            top: tooltip.y + 15,
            left: tooltip.x + 15,
            zIndex: 20,
            pointerEvents: "none",
            transform: "translate(-50%, -50%)",
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

// ==========================================
// 5. TIMELINE COMPONENT
// ==========================================

const Timeline = ({ visualizerConfig, sceneData = [] }) => {
  const { token } = theme.useToken();
  const containerRef = useRef(null);

  // State for the scrubber position (0 to 100)
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Total length from config or default to 100
  const totalLength = visualizerConfig?.length || 100;

  // Handle mouse interaction to move scrubber
  const handleSeek = (e) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;

    // Calculate percentage
    let newProgress = (x / width) * 100;

    // Clamp between 0 and 100
    newProgress = Math.max(0, Math.min(100, newProgress));

    setProgress(newProgress);
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    handleSeek(e);
  };

  useEffect(() => {
    const handleWindowMouseMove = (e) => {
      if (isDragging) {
        handleSeek(e);
      }
    };

    const handleWindowMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleWindowMouseMove);
      window.addEventListener("mouseup", handleWindowMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, [isDragging]);

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
      {/* Header Info */}
      <div
        style={{
          marginBottom: 12,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <Text strong style={{ fontSize: 12 }}>
          TIMELINE
        </Text>
        <Text
          type="secondary"
          style={{ fontSize: 12, fontFamily: "monospace" }}
        >
          {Math.round((progress / 100) * totalLength)}s / {totalLength}s
        </Text>
      </div>

      {/* Timeline Track Area */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        style={{
          position: "relative",
          height: 40,
          background: token.colorFillTertiary,
          borderRadius: 6,
          cursor: "pointer",
          overflow: "hidden", // Keeps markers inside rounded corners
        }}
      >
        {/* Render Scene Markers from PROPS */}
        {sceneData.map((scene) => (
          <Tooltip title={scene.name} key={scene.id}>
            <div
              style={{
                position: "absolute",
                left: `${scene.start}%`,
                width: `${scene.end - scene.start}%`,
                top: 8,
                bottom: 8,
                backgroundColor: scene.color,
                opacity: 0.3,
                borderLeft: `2px solid ${scene.color}`,
                borderRight: `2px solid ${scene.color}`,
                borderRadius: 4,
                transition: "opacity 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = 0.6)}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = 0.3)}
            />
          </Tooltip>
        ))}

        {/* Ruler Lines */}
        {Array.from({ length: 11 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${i * 10}%`,
              bottom: 0,
              height: i % 5 === 0 ? "50%" : "25%",
              width: 1,
              background: token.colorBorder,
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
          {/* Handle Icon */}
          <div
            style={{
              position: "absolute",
              top: -6,
              left: "50%",
              transform: "translateX(-50%)",
              color: token.colorPrimary,
              fontSize: 16,
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

export { Visualizer, Timeline };
