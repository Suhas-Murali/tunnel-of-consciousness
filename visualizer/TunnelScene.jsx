import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame, extend, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, OrthographicCamera, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { emotionHierarchy } from '../src/emotionHierarchy';

// Place this mapping table immediately after imports
const EMOTION_LABEL_MAP = {
  anger: "angry",
  disgust: "disgusted",
  fear: "fearful",
  joy: "happy",
  sadness: "sad",
  surprise: "surprised",
  neutral: "content", // fallback for neutral
  hopelessness: "despair",
  "let down": "let down",
  letdown: "let down",
  admiration: "proud",
  relief: "peaceful",
  realization: "surprised",
  nervousness: "anxious",
  nervous: "anxious",
  remorseful: "guilty",
  embarrassment: "embarrassed",
  disappointment: "disappointed",
  approval: "proud",
  caring: "loving",
  gratitude: "thankful",
  love: "loving",
  amusement: "playful",
  desire: "hopeful",
  optimism: "optimistic",
  pride: "proud",
  surprise: "surprised",
  curiosity: "curious",
  sadness: "sad",
  anger: "angry",
  fear: "fearful",
  // Add more as needed
};
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

// Utility: Flatten all tertiary emotions for tunnel segment count
function getAllTertiaryEmotions() {
  return emotionHierarchy.flatMap(core =>
    core.secondary.flatMap(sec =>
      sec.tertiary.map(ter => ({
        core: core.core,
        color: core.color,
        secondary: sec.name,
        tertiary: ter
      }))
    )
  );
}

const EMOTION_WHEEL_RADII = {
  core: 1.3,
  secondary: 2.2,
  tertiary: 3.2
};

function Tunnel({ colorScheme }) {
  // Tunnel geometry: one segment per tertiary emotion
  const tertiaryEmotions = useMemo(getAllTertiaryEmotions, []);
  const numSegments = tertiaryEmotions.length;
  const radius = 3.2; // Match tertiaryRadius
  const tubularSegments = numSegments * 8; // More segments for smoothness
  // Make tunnel a ring/cylinder
  const path = useMemo(() => {
    const curve = new THREE.CurvePath();
    const points = [];
    for (let i = 0; i < numSegments; i++) {
      const angle = (i / numSegments) * 2 * Math.PI;
      points.push(new THREE.Vector3(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        0
      ));
    }
    points.push(points[0]); // Close the loop
    const curve3 = new THREE.CatmullRomCurve3(points, true);
    curve.add(curve3);
    return curve;
  }, [numSegments, radius]);
  const geometry = useMemo(() => new THREE.TubeGeometry(path, tubularSegments, 0.35, numSegments, true), [path, tubularSegments, numSegments]);
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
  // Increased radii to reduce overlap
  const coreRadius = EMOTION_WHEEL_RADII.core;
  const secondaryRadius = EMOTION_WHEEL_RADII.secondary;
  const tertiaryRadius = EMOTION_WHEEL_RADII.tertiary;
  const coreEmotions = emotionHierarchy;
  const numCores = coreEmotions.length;

  // Helper to get more vibrant/saturated shades
  function saturateColor(hex, amount = 0.4) {
    // Convert hex to HSL, adjust saturation (can be negative), convert back to hex
    let r = parseInt(hex.slice(1, 3), 16) / 255;
    let g = parseInt(hex.slice(3, 5), 16) / 255;
    let b = parseInt(hex.slice(5, 7), 16) / 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) {
      h = s = 0;
    } else {
      let d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    s = Math.max(0, Math.min(1, s + amount)); // allow negative for desaturation
    // Convert HSL back to RGB
    let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    let p = 2 * l - q;
    function hue2rgb(p, q, t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    }
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
    r = Math.round(r * 255);
    g = Math.round(g * 255);
    b = Math.round(b * 255);
    return `#${(r<16?'0':'')+r.toString(16)}${(g<16?'0':'')+g.toString(16)}${(b<16?'0':'')+b.toString(16)}`;
  }

  // Arc segments for each ring
  const arcSegments = [];
  // Core arcs (most vibrant)
  coreEmotions.forEach((core, coreIdx) => {
    const coreAngleStart = (coreIdx / numCores) * 2 * Math.PI;
    const coreAngleEnd = ((coreIdx + 1) / numCores) * 2 * Math.PI;
    // Use negative saturation to desaturate and darken
    const desaturatedCore = saturateColor(core.color, -0.25);
    // Core arc segment
    const shape = new THREE.Shape();
    shape.absarc(0, 0, coreRadius, coreAngleStart, coreAngleEnd, false);
    shape.lineTo(0, 0);
    const geometry = new THREE.ShapeGeometry(shape, 16);
    arcSegments.push(
      <mesh key={`core-arc-${core.core}`} geometry={geometry} position={[0,0,-0.01]}>
        <meshBasicMaterial attach="material" color={desaturatedCore} transparent opacity={0.45} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    );
    // Secondary arcs (vibrant, slightly lighter)
    const numSecondaries = core.secondary.length;
    core.secondary.forEach((sec, secIdx) => {
      const secAngleStart = coreAngleStart + (secIdx / numSecondaries) * (coreAngleEnd - coreAngleStart);
      const secAngleEnd = coreAngleStart + ((secIdx + 1) / numSecondaries) * (coreAngleEnd - coreAngleStart);
      const desaturatedSec = saturateColor(core.color, -0.25);
      const secShape = new THREE.Shape();
      secShape.absarc(0, 0, secondaryRadius, secAngleStart, secAngleEnd, false);
      secShape.lineTo(0, 0);
      const secGeometry = new THREE.ShapeGeometry(secShape, 16);
      arcSegments.push(
        <mesh key={`sec-arc-${core.core}-${sec.name}`} geometry={secGeometry} position={[0,0,-0.02]}>
          <meshBasicMaterial attach="material" color={desaturatedSec} transparent opacity={0.32} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
    );
      // Tertiary arcs (most light/vibrant)
      const numTertiaries = sec.tertiary.length;
      sec.tertiary.forEach((ter, terIdx) => {
        const terAngleStart = secAngleStart + (terIdx / numTertiaries) * (secAngleEnd - secAngleStart);
        const terAngleEnd = secAngleStart + ((terIdx + 1) / numTertiaries) * (secAngleEnd - secAngleStart);
        const desaturatedTer = saturateColor(core.color, -0.25);
        const terShape = new THREE.Shape();
        terShape.absarc(0, 0, tertiaryRadius, terAngleStart, terAngleEnd, false);
        terShape.lineTo(0, 0);
        const terGeometry = new THREE.ShapeGeometry(terShape, 16);
        arcSegments.push(
          <mesh key={`ter-arc-${core.core}-${sec.name}-${ter}`} geometry={terGeometry} position={[0,0,-0.03]}>
            <meshBasicMaterial attach="material" color={desaturatedTer} transparent opacity={0.22} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
      );
      });
    });
  });

  // Collect all label elements (color each word by core color)
  const labels = [];
  coreEmotions.forEach((core, coreIdx) => {
    const coreAngleStart = (coreIdx / numCores) * 2 * Math.PI;
    const coreAngleEnd = ((coreIdx + 1) / numCores) * 2 * Math.PI;
    const coreAngleMid = (coreAngleStart + coreAngleEnd) / 2;
    // Core label
    labels.push(
      <Html
        key={`core-${core.core}`}
        position={[Math.cos(coreAngleMid) * coreRadius, Math.sin(coreAngleMid) * coreRadius, 0.01]}
        transform
        distanceFactor={3}
        style={{
          color: core.color,
          fontWeight: 500,
          fontSize: '1.05rem',
          letterSpacing: '0.01em',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {core.core}
      </Html>
    );
    // For each secondary emotion
    const numSecondaries = core.secondary.length;
    core.secondary.forEach((sec, secIdx) => {
      const secAngleStart = coreAngleStart + (secIdx / numSecondaries) * (coreAngleEnd - coreAngleStart);
      const secAngleEnd = coreAngleStart + ((secIdx + 1) / numSecondaries) * (coreAngleEnd - coreAngleStart);
      const secAngleMid = (secAngleStart + secAngleEnd) / 2;
      // Secondary label
      labels.push(
        <Html
          key={`sec-${core.core}-${sec.name}`}
          position={[Math.cos(secAngleMid) * secondaryRadius, Math.sin(secAngleMid) * secondaryRadius, 0.01]}
          transform
          distanceFactor={3}
          style={{
            color: core.color,
            fontWeight: 400,
            fontSize: '0.92rem',
            letterSpacing: '0.01em',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {sec.name}
        </Html>
      );
      // For each tertiary emotion
      const numTertiaries = sec.tertiary.length;
      sec.tertiary.forEach((ter, terIdx) => {
        const terAngleStart = secAngleStart + (terIdx / numTertiaries) * (secAngleEnd - secAngleStart);
        const terAngleEnd = secAngleStart + ((terIdx + 1) / numTertiaries) * (secAngleEnd - secAngleStart);
        const terAngleMid = (terAngleStart + terAngleEnd) / 2;
        // Tertiary label
        labels.push(
          <Html
            key={`ter-${core.core}-${sec.name}-${ter}`}
            position={[Math.cos(terAngleMid) * tertiaryRadius, Math.sin(terAngleMid) * tertiaryRadius, 0.01]}
            transform
            distanceFactor={3}
            style={{
              color: core.color,
              fontWeight: 300,
              fontSize: '0.8rem',
              letterSpacing: '0.01em',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {ter}
          </Html>
        );
      });
    });
  });

  // Draw ring outlines for visual clarity
  const ringGeometries = [coreRadius, secondaryRadius, tertiaryRadius].map((r, i) => {
    const points = [];
    for (let a = 0; a <= 64; a++) {
      const theta = (a / 64) * 2 * Math.PI;
      points.push([
        Math.cos(theta) * r,
        Math.sin(theta) * r,
        0.0
      ]);
    }
    return (
      <Line
        key={`ring-${i}`}
        points={points}
        color="#fff"
        lineWidth={0.7}
        transparent
        opacity={0.18}
      />
    );
  });

  return <group>{arcSegments}{ringGeometries}{labels}</group>;
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

function findEmotionPath(label) {
  if (!label) return null;
  const emo = label.toLowerCase();
  for (let i = 0; i < emotionHierarchy.length; i++) {
    const core = emotionHierarchy[i];
    if (core.core.toLowerCase() === emo) {
      return { coreIdx: i, secIdx: null, terIdx: null, core, secondary: null, tertiary: null };
    }
    for (let j = 0; j < core.secondary.length; j++) {
      const sec = core.secondary[j];
      if (sec.name.toLowerCase() === emo) {
        return { coreIdx: i, secIdx: j, terIdx: null, core, secondary: sec, tertiary: null };
      }
      for (let k = 0; k < sec.tertiary.length; k++) {
        if (sec.tertiary[k].toLowerCase() === emo) {
          return { coreIdx: i, secIdx: j, terIdx: k, core, secondary: sec, tertiary: sec.tertiary[k] };
        }
      }
    }
  }
  return null;
}

function getEmotionRingAndAngle(label) {
  const path = findEmotionPath(label);
  if (!path) return { ring: 'core', angle: 0 };
  const numCores = emotionHierarchy.length;
  if (path.tertiary) {
    // Tertiary
    const coreAngleStart = (path.coreIdx / numCores) * 2 * Math.PI;
    const coreAngleEnd = ((path.coreIdx + 1) / numCores) * 2 * Math.PI;
    const numSecondaries = path.core.secondary.length;
    const secAngleStart = coreAngleStart + (path.secIdx / numSecondaries) * (coreAngleEnd - coreAngleStart);
    const secAngleEnd = coreAngleStart + ((path.secIdx + 1) / numSecondaries) * (coreAngleEnd - coreAngleStart);
    const numTertiaries = path.secondary.tertiary.length;
    const terAngleStart = secAngleStart + (path.terIdx / numTertiaries) * (secAngleEnd - secAngleStart);
    const terAngleEnd = secAngleStart + ((path.terIdx + 1) / numTertiaries) * (secAngleEnd - secAngleStart);
    const terAngleMid = (terAngleStart + terAngleEnd) / 2;
    return { ring: 'tertiary', angle: terAngleMid };
  } else if (path.secondary) {
    // Secondary
    const coreAngleStart = (path.coreIdx / numCores) * 2 * Math.PI;
    const coreAngleEnd = ((path.coreIdx + 1) / numCores) * 2 * Math.PI;
    const numSecondaries = path.core.secondary.length;
    const secAngleStart = coreAngleStart + (path.secIdx / numSecondaries) * (coreAngleEnd - coreAngleStart);
    const secAngleEnd = coreAngleStart + ((path.secIdx + 1) / numSecondaries) * (coreAngleEnd - coreAngleStart);
    const secAngleMid = (secAngleStart + secAngleEnd) / 2;
    return { ring: 'secondary', angle: secAngleMid };
  } else {
    // Core
    return { ring: 'core', angle: ((path.coreIdx + 0.5) / numCores) * 2 * Math.PI };
  }
}

function CharacterStrands({ data, viewMode }) {
  const { camera, size } = useThree();
  const dotGeometry = useMemo(() => new THREE.SphereGeometry(0.06, 16, 16), []);

  if (!data || !data.characters) 
    return null;
  const ringRadii = EMOTION_WHEEL_RADII;

  const charEntries = Object.entries(data.characters);
  // Sort characters by first appearance in the story
  const charEntriesSorted = charEntries.slice().sort((a, b) => {
    const aFirst = (a[1].emotionTimeline?.[0]?.position ?? 1);
    const bFirst = (b[1].emotionTimeline?.[0]?.position ?? 1);
    return aFirst - bFirst;
  });

  // Map: sector -> [charName, charData, originalIndex]
  const sectorMap = {};
  charEntriesSorted.forEach(([charName, charData], idx) => {
    const timeline = (charData.emotionTimeline || []).sort((a, b) => a.position - b.position);
    const firstEmotion = timeline[0]?.emotion?.toLowerCase?.();
    const primary = GOEMOTIONS_TO_SECTOR[firstEmotion] || 'bad';
    if (!sectorMap[primary]) sectorMap[primary] = [];
    sectorMap[primary].push([charName, charData, idx]);
  });

  return charEntriesSorted.map(([charName, charData], charIdx) => {
    const points = [];
    const colors = [];
    const timeline = (charData.emotionTimeline || []).sort((a, b) => a.position - b.position);
    if (!timeline.length) return null;
    // Debug: print the raw timeline for this character
    console.log('Character:', charName, 'Timeline:', timeline);
    // Offset within sector to avoid overlap
    const firstEmotion = timeline[0]?.emotion?.toLowerCase?.();
    const primary = GOEMOTIONS_TO_SECTOR[firstEmotion] || 'bad';
    const charsInSector = sectorMap[primary] || [];
    const mySectorIdx = charsInSector.findIndex(([n]) => n === charName);
    const sectorCount = charsInSector.length;
    // Compute offset angle within sector
    const sectorAngle = (2 * Math.PI) / EMOTION_SECTORS.length;
    const sectorIdx = EMOTION_SECTORS.indexOf(primary);
    const baseAngle = sectorIdx >= 0 ? sectorIdx * sectorAngle : 0;
    const spread = sectorAngle * 0.35;
    let offset = 0;
    if (sectorCount > 1) {
      offset = spread * ((mySectorIdx / (sectorCount - 1)) - 0.5);
    }
    // Only the first character starts at the entrance; others start at their first appearance
    let labelPoint = null;
    if (charIdx === 0) {
      // Start at entrance (core ring, mapped angle of first emotion + offset)
      const firstMap = getEmotionRingAndAngle(timeline[0]?.emotion);
      if (isNaN(firstMap.angle)) return null;
      points.push([
        Math.cos(firstMap.angle + offset) * ringRadii.core,
        Math.sin(firstMap.angle + offset) * ringRadii.core,
        0
      ]);
      colors.push([1, 1, 1]); // White at entrance
      labelPoint = [
        Math.cos(firstMap.angle + offset) * ringRadii.core,
        Math.sin(firstMap.angle + offset) * ringRadii.core,
        0
      ];
    }
    // For each timeline entry, map to correct ring and angle using the actual emotion label
    timeline.forEach((entry, i) => {
      const emotionLabel = entry.emotion;
      let mappedLabel = EMOTION_LABEL_MAP[emotionLabel?.toLowerCase?.()] || emotionLabel;
      if (!EMOTION_LABEL_MAP[emotionLabel?.toLowerCase?.()] && !findEmotionPath(emotionLabel)) {
        console.warn('Unmapped emotion label:', emotionLabel, '-> using fallback "content"');
        mappedLabel = 'content';
      }
      const map = getEmotionRingAndAngle(mappedLabel);
      if (!map || isNaN(map.angle)) {
        console.warn('Emotion not found in hierarchy:', emotionLabel);
        return;
      }
      let radius = ringRadii[map.ring] || ringRadii.core;
      const angle = map.angle + offset;
      const z = -entry.position * 100;
      points.push([
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        z
      ]);
      const color = new THREE.Color(getEmotionColor(emotionLabel, charData.color));
      colors.push([color.r, color.g, color.b]);
      // For the first timeline entry of non-first characters, set labelPoint
      if (charIdx !== 0 && i === 0) {
        labelPoint = [
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
          z
        ];
      }
      // Debug log for mapping
      console.log(`Character: ${charName}, Entry: ${i}, Emotion: ${emotionLabel}, Ring: ${map.ring}, Angle: ${map.angle}`);
    });
    if (points.length < 2) return null;
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
    // Always show label at the start of the strand
    if (!labelPoint) labelPoint = points[0];
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