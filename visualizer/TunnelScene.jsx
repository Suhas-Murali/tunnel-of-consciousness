import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame, extend, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, OrthographicCamera, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

// Utility functions and constants from renderer.js
const EMOTION_WHEEL_COLORS = {
  happy: '#fff86b', joyful: '#fff86b', content: '#f7e96b', proud: '#f7c96b',
  peaceful: '#e6f7c6', trusting: '#b6e6a6', optimistic: '#ffe29a',
  surprised: '#b6a6f7', excited: '#e6a6f7', amazed: '#c6b6f7',
  confused: '#b6d6f7', bad: '#b0e0c6', bored: '#e0e0c6', tired: '#d6c6b6',
  stressed: '#f7c6a6', overwhelmed: '#f7a6a6', fearful: '#ffe29a',
  scared: '#ffd580', anxious: '#ffe0b2', insecure: '#f7b6b6',
  weak: '#e6b6b6', rejected: '#f7b6c6', angry: '#ff7b7b',
  mad: '#ffb6b6', aggressive: '#ffb6a6', frustrated: '#ffb6b6',
  distant: '#b6b6b6', critical: '#b6b6c6', disgusted: '#bdbdbd',
  disapproving: '#b6b6b6', disappointed: '#b6c6b6', repelled: '#b6b6b6',
  sad: '#7ecbff', lonely: '#b6d6f7', vulnerable: '#b6e6f7',
  despair: '#b6b6f7', guilty: '#b6b6d6', ashamed: '#b6b6c6'
};
const EMOTION_SECTORS = [
  'happy', 'surprised', 'bad', 'fearful', 'angry', 'disgusted', 'sad'
];
// Expand EMOTION_TO_SECTOR for GoEmotions labels
const GOEMOTIONS_TO_SECTOR = {
  happy: 'happy', joy: 'happy', joyful: 'happy', content: 'happy', proud: 'happy', peaceful: 'happy', trusting: 'happy', optimistic: 'happy',
  excited: 'surprised', surprised: 'surprised', amazed: 'surprised', confusion: 'surprised', curious: 'surprised', realization: 'surprised',
  bad: 'bad', bored: 'bad', tired: 'bad', stressed: 'bad', overwhelmed: 'bad', disappointment: 'bad', disapproval: 'bad', 
  fearful: 'fearful', scared: 'fearful', anxious: 'fearful', insecure: 'fearful', weak: 'fearful', rejected: 'fearful', nervousness: 'fearful', fear: 'fearful',
  angry: 'angry', mad: 'angry', aggressive: 'angry', frustrated: 'angry', distant: 'angry', critical: 'angry', furious: 'angry', hostile: 'angry', annoyance: 'angry',
  disgusted: 'disgusted', disapproving: 'disgusted', disappointed: 'disgusted', repelled: 'disgusted', embarrassment: 'disgusted', disgust: 'disgusted',
  sad: 'sad', lonely: 'sad', vulnerable: 'sad', despair: 'sad', guilty: 'sad', ashamed: 'sad', depressed: 'sad', hurt: 'sad', grief: 'sad', powerless: 'sad', empty: 'sad', victimized: 'sad', abandoned: 'sad', fragile: 'sad', remorseful: 'sad', embarrassed: 'sad', appalled: 'sad', horrified: 'sad', hesitant: 'sad', apathetic: 'sad', indifferent: 'sad', helpless: 'sad', hopeless: 'sad', inadequate: 'sad', insignificant: 'sad', excluded: 'sad', persecuted: 'sad', exposed: 'sad', betrayed: 'sad', resentful: 'sad', disrespected: 'sad', ridiculed: 'sad', indignant: 'sad', violated: 'sad',
  admiration: 'happy', approval: 'happy', caring: 'happy', gratitude: 'happy', love: 'happy', relief: 'happy', amusement: 'happy',
  desire: 'happy', optimism: 'happy', pride: 'happy', surprise: 'surprised',
  curiosity: 'surprised',
  sadness: 'sad', anger: 'angry', 
  // fallback
  neutral: 'bad',
};
const EMOTION_CHAOS = {
  calm: 0.0, peaceful: 0.0, content: 0.1, joy: 0.2,
  happy: 0.2, proud: 0.3, surprised: 0.5, sad: 0.7,
  fearful: 0.8, angry: 1.0, disgusted: 0.9
};
function getEmotionColor(emotion, baseColor) {
  return EMOTION_WHEEL_COLORS[emotion?.toLowerCase?.()] || baseColor;
}
function getChaosScore(emotion) {
  return EMOTION_CHAOS[emotion?.toLowerCase?.()] ?? 0.5;
}

function Tunnel({ colorScheme }) {
  // Tunnel geometry
  const path = useMemo(() => new THREE.LineCurve3(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -100)
  ), []);
  const tubularSegments = 200;
  const geometry = useMemo(() => new THREE.TubeGeometry(path, tubularSegments, 2, 32, false), [path]);
  return (
    <mesh geometry={geometry} position={[0,0,0]}>
      <meshBasicMaterial attach="material" color={0xffffff} side={THREE.DoubleSide} transparent opacity={0.09} depthWrite={false} />
    </mesh>
  );
}

function TunnelLine() {
  // Center line
  const points = [
    [0, 0, 0],
    [0, 0, -100]
  ];
  return (
    <Line
      points={points}
      color="white"
      lineWidth={2} // thickness in world units
      transparent
      opacity={0.4}
    />
  );
}

function Grid() {
  // Grid lines
  const gridSize = 100;
  const gridStep = 1;
  const lines = useMemo(() => {
    const arr = [];
    for (let x = -gridSize; x <= gridSize; x += gridStep) {
      arr.push([
        [x, 0, -gridSize],
        [x, 0, gridSize]
      ]);
    }
    for (let z = -gridSize; z <= gridSize; z += gridStep) {
      arr.push([
        [-gridSize, 0, z],
        [gridSize, 0, z]
      ]);
    }
    return arr;
  }, []);
  return (
    <group>
      {lines.map((pts, i) => (
        <Line
          key={i}
          points={pts}
          color="#777"
          lineWidth={0.5}
          transparent
          opacity={0.18}
        />
      ))}
    </group>
  );
}

function EmotionWheelOverlay() {
  // Sectors and concentric circles
  const radius = 2.0;
  const numSectors = EMOTION_SECTORS.length;
  const sectorAngle = (2 * Math.PI) / numSectors;
  const sectorColors = ["#fff86b", "#b6a6f7", "#b0e0c6", "#ffe29a", "#ff7b7b", "#bdbdbd", "#7ecbff"];
  // Sectors
  const sectors = [];
  for (let i = 0; i < numSectors; i++) {
    const startAngle = i * sectorAngle;
    const endAngle = (i + 1) * sectorAngle;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.absarc(0, 0, radius, startAngle, endAngle, false);
    shape.lineTo(0, 0);
    const geometry = new THREE.ShapeGeometry(shape, 32);
    sectors.push(
      <mesh key={i} geometry={geometry} position={[0,0,-0.01]}>
        <meshBasicMaterial attach="material" color={sectorColors[i]} transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    );
    // Radial line
    const linePts = [
      [0, 0, 0],
      [Math.cos(startAngle) * radius, Math.sin(startAngle) * radius, 0]
    ];
    sectors.push(
      <Line
        key={`line-${i}`}
        points={linePts}
        color="#fff"
        lineWidth={0.5}
        transparent
        opacity={0.18}
      />
    );
  }
  // Concentric circles
  const circles = [];
  for (let r = radius * 0.25; r <= radius; r += radius * 0.25) {
    const circlePts = [];
    for (let a = 0; a <= 64; a++) {
      const theta = (a / 64) * 2 * Math.PI;
      circlePts.push([
        Math.cos(theta) * (r - 0.01),
        Math.sin(theta) * (r - 0.01),
        -0.02
      ]);
      circlePts.push([
        Math.cos(theta) * r,
        Math.sin(theta) * r,
        -0.02
      ]);
    }
    for (let i = 0; i < circlePts.length; i += 2) {
      circles.push(
        <Line
          key={`circle-${r}-${i}`}
          points={[circlePts[i], circlePts[i + 1]]}
          color="#fff"
          lineWidth={0.5}
          transparent
          opacity={0.08}
        />
      );
    }
  }
  // Sector labels
  const labels = EMOTION_SECTORS.map((sector, i) => {
    const angle = (i + 0.5) * sectorAngle; // Center of sector
    const labelRadius = radius * 1.13; // Slightly outside the wheel
    const x = Math.cos(angle) * labelRadius;
    const y = Math.sin(angle) * labelRadius;
    return (
      <Html
        key={`label-${sector}`}
        position={[x, y, 0.01]}
        transform
        distanceFactor={3}
        style={{
          background: 'rgba(0,0,0,0.7)',
          color: '#fff',
          padding: '2px 10px',
          borderRadius: '8px',
          fontWeight: 'bold',
          fontSize: '1.1rem',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {sector.charAt(0).toUpperCase() + sector.slice(1)}
      </Html>
    );
  });
  return <group>{sectors}{circles}{labels}</group>;
}

function ColoredLine({ points, colors, lineWidth = 0.1, opacity = 1 }) {
  const ref = useRef();
  const geometry = useMemo(() => {
    const g = new LineGeometry();
    g.setPositions(points.flat());
    g.setColors(colors.flat());
    return g;
  }, [points, colors]);
  const material = useMemo(
    () =>
      new LineMaterial({
        color: 0xffffff,
        linewidth: lineWidth,
        vertexColors: true,
        transparent: true,
        opacity: opacity,
        depthTest: true,
        depthWrite: true,
      }),
    [lineWidth, opacity]
  );
  // Update resolution on mount and resize
  React.useEffect(() => {
    function updateResolution() {
      if (ref.current && ref.current.material && ref.current.material.resolution) {
        ref.current.material.resolution.set(window.innerWidth, window.innerHeight);
      }
    }
    updateResolution();
    window.addEventListener('resize', updateResolution);
    return () => window.removeEventListener('resize', updateResolution);
  }, []);
  return <primitive object={new Line2(geometry, material)} ref={ref} />;
}

function CharacterStrands({ data, viewMode }) {
  // All hooks must be called before any return!
  const { camera, size } = useThree();
  const dotGeometry = useMemo(() => new THREE.SphereGeometry(0.06, 16, 16), []);

  if (!data || !data.characters) 
    return null;
  const tunnelRadius = 2;
  const minRadius = 0.1;
  const maxRadius = tunnelRadius - 0.1;

  // Group characters by their primary sector for angular offsetting
  const charEntries = Object.entries(data.characters);
  // Map: sector -> [charName, charData, originalIndex]
  const sectorMap = {};
  charEntries.forEach(([charName, charData], idx) => {
    const timeline = (charData.emotionTimeline || []).sort((a, b) => a.position - b.position);
    const firstEmotion = timeline[0]?.emotion?.toLowerCase?.();
    const primary = GOEMOTIONS_TO_SECTOR[firstEmotion] || 'bad';
    if (!sectorMap[primary]) sectorMap[primary] = [];
    sectorMap[primary].push([charName, charData, idx]);
  });

  // For each character, compute their offset within their sector
  let charIdx = 0;
  return charEntries.map(([charName, charData]) => {
    const points = [];
    const colors = [];
    const timeline = (charData.emotionTimeline || []).sort((a, b) => a.position - b.position);
    // Determine primary sector and offset
    const firstEmotion = timeline[0]?.emotion?.toLowerCase?.();
    const primary = GOEMOTIONS_TO_SECTOR[firstEmotion] || 'bad';
    let sectorIdx = EMOTION_SECTORS.indexOf(primary);
    if (sectorIdx === -1) sectorIdx = 0;
    const charsInSector = sectorMap[primary] || [];
    const mySectorIdx = charsInSector.findIndex(([n]) => n === charName);
    const sectorCount = charsInSector.length;
    // Offset angle within sector
    const sectorAngle = (2 * Math.PI) / EMOTION_SECTORS.length;
    const baseAngle = sectorIdx * sectorAngle;
    // Spread within sector: [-spread, +spread]
    const spread = sectorAngle * 0.35; // 35% of sector width
    let offset = 0;
    if (sectorCount > 1) {
      offset = spread * ((mySectorIdx / (sectorCount - 1)) - 0.5);
    }
    // For each timeline entry, use the offset angle
    timeline.forEach((entry, i) => {
      const chaos = getChaosScore(entry.emotion);
      const radius = minRadius + (maxRadius - minRadius) * chaos;
      // Use offset angle for all points in this strand
      const emotionSector = GOEMOTIONS_TO_SECTOR[entry.emotion?.toLowerCase?.()] || 'bad';
      let angleSectorIdx = EMOTION_SECTORS.indexOf(emotionSector);
      if (angleSectorIdx === -1) angleSectorIdx = 0;
      const angle = (angleSectorIdx / EMOTION_SECTORS.length) * Math.PI * 2 + offset;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const z = -entry.position * 100;
      points.push([x, y, z]);
      const color = new THREE.Color(getEmotionColor(entry.emotion, charData.color));
      colors.push([color.r, color.g, color.b]);
    });
    let curve = points.length > 2 ? new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z))) : { getPoints: () => points.map(([x, y, z]) => new THREE.Vector3(x, y, z)) };
    const curvePoints = curve.getPoints(100).map(v => [v.x, v.y, v.z]);
    // Interpolate colors along the curve
    const vertexColors = [];
    for (let i = 0; i < curvePoints.length; i++) {
      const t = i / (curvePoints.length - 1);
      let idx = Math.round(t * (colors.length - 1));
      if (isNaN(idx) || idx < 0) idx = 0;
      if (idx >= colors.length) idx = colors.length - 1;
      const c = colors[idx] || colors[0] || [1, 1, 1];
      vertexColors.push(c);
    }
    const dotColor = getEmotionColor(timeline[0]?.emotion, charData.color);
    // Place label at tip of the strand
    const labelPoint = curvePoints[0];
    // Always show label in 2D, keep 3D logic for inCanvas
    const vector = new THREE.Vector3(...labelPoint).project(camera);
    const x = (vector.x + 1) / 2 * size.width;
    const inCanvas = viewMode === '3d' ? (x >= 0 && x <= size.width * 0.6 && vector.z < 1 && vector.z > -1) : true;
    // Style for 2D vs 3D
    const labelStyle = viewMode === '3d' ? {
      background: 'rgba(0,0,0,0.7)',
      color: '#fff',
      padding: '6px 18px',
      borderRadius: '10px',
      fontWeight: 'bold',
      fontSize: '1.5rem',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
      userSelect: 'none',
    } : {
      background: 'rgba(0,0,0,0.7)',
      color: '#fff',
      padding: '2px 6px',
      borderRadius: '7px',
      fontWeight: 'bold',
      fontSize: '0.85rem',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
      userSelect: 'none',
    };
    const distanceFactor = viewMode === '3d' ? 4 : 3;
    return (
      <group key={charName}>
        <ColoredLine
          points={curvePoints}
          colors={vertexColors}
          lineWidth={2}
          opacity={1}
        />
        <mesh geometry={dotGeometry} position={curvePoints[0]}>
          <meshBasicMaterial attach="material" color={dotColor} />
        </mesh>
        <mesh geometry={dotGeometry} position={curvePoints[curvePoints.length - 1]}>
          <meshBasicMaterial attach="material" color={dotColor} />
        </mesh>
        {inCanvas && (
          <Html
            position={labelPoint}
            distanceFactor={distanceFactor}
            transform={viewMode !== '3d' ? true : false}
            style={labelStyle}
          >
            {charName}
          </Html>
        )}
        {/* TODO: Add character label overlays using <Html /> if needed */}
      </group>
    );
  });
}

function SceneMarkers({ data }) {
  if (!data || !data.scenes) return null;
  return data.scenes.map((scene, i) => {
    const z = -scene.t * 100;
    return (
      <mesh key={i} position={[0, 0, z]}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshBasicMaterial color={0xffdd00} />
        {/* TODO: Add scene label overlays using <Html /> if needed */}
      </mesh>
    );
  });
}

export default function TunnelScene({ data, colorScheme, viewMode }) {
  const { scene, size } = useThree();
  const orthoCamRef = useRef();
  const perspCamRef = useRef();

  // Set background color
  React.useEffect(() => {
    scene.background = new THREE.Color(colorScheme.sceneBg || '#222');
  }, [scene, colorScheme]);

  // Camera settings for 2D/3D
  let cameraNode = null;
  let controlsNode = null;
  if (viewMode === '2d-front') {
    // Orthographic camera, looking down -Z (front view)
    const orthoSize = 3;
    cameraNode = (
      <OrthographicCamera
        ref={orthoCamRef}
        makeDefault
        position={[0, 0, 10]}
        zoom={size.height / (orthoSize * 2)}
        near={0.1}
        far={1000}
        up={[0, 1, 0]}
        onUpdate={self => self.lookAt(0, 0, 0)}
      />
    );
    controlsNode = (
      <OrbitControls
        makeDefault
        enableRotate={false}
        enablePan={true}
        enableZoom={true}
        screenSpacePanning={true}
        target={[0, 0, 0]}
        minZoom={0.5}
        maxZoom={size.height / (orthoSize * 0.5)}
        mouseButtons={{ LEFT: 0, MIDDLE: 1, RIGHT: 2 }}
      />
    );
  } else if (viewMode === '2d-side') {
    // Orthographic camera, looking down -X (side view)
    const orthoSize = 3;
    cameraNode = (
      <OrthographicCamera
        ref={orthoCamRef}
        makeDefault
        position={[10, 0, 0]}
        zoom={size.height / (orthoSize * 2)}
        near={0.1}
        far={1000}
        up={[0, 1, 0]}
        onUpdate={self => self.lookAt(0, 0, 0)}
      />
    );
    controlsNode = (
      <OrbitControls
        makeDefault
        enableRotate={false}
        enablePan={true}
        enableZoom={true}
        screenSpacePanning={true}
        target={[0, 0, 0]}
        minZoom={0.5}
        maxZoom={size.height / (orthoSize * 0.5)}
        mouseButtons={{ LEFT: 0, MIDDLE: 1, RIGHT: 2 }}
      />
    );
  } else {
    // Default 3D
    cameraNode = <PerspectiveCamera ref={perspCamRef} makeDefault position={[0, 1, 5]} fov={75} near={0.1} far={1000} />;
    controlsNode = <OrbitControls makeDefault enableDamping target={[0, 0, -1]} />;
  }

  return (
    <>
      {cameraNode}
      {controlsNode}
      <ambientLight intensity={0.7} />
      <Tunnel colorScheme={colorScheme} />
      <TunnelLine />
      <Grid />
      <EmotionWheelOverlay />
      <CharacterStrands data={data} viewMode={viewMode} />
      <SceneMarkers data={data} />
    </>
  );
} 