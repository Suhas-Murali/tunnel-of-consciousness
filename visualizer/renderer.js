import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

export class TunnelVisualizationSystem {
  constructor(data, renderer) {
    this.data = data;
    this.renderer = renderer;
    this.tunnel = null;
    this.characterStrands = [];
    this.interactionLinks = [];
    this.sceneOverlays = [];

    this.sceneContainer = document.getElementById('scene-container');
    this.sceneContainer.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(
      75,
      this.sceneContainer.clientWidth / this.sceneContainer.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 1, 5);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x222222);
  }

  init() {
    this.createTunnel();
    this.createCharacterStrands();
    this.createSceneOverlays();
    this.initColorSchemeControls();
  }

  initColorSchemeControls() {
    const select = document.getElementById('color-scheme-switcher');
    if (!select) return;
    select.addEventListener('change', (e) => {
      const scheme = COLOR_SCHEMES[e.target.value];
      if (scheme) {
        this.changeColorScheme(scheme);
      }
    });
  }

  update() {
    this.controls.update();
    this.setGridVisibilityByCamera(this.camera);
    this.renderer.render(this.scene, this.camera);
    this.updateCharacterLabels();
  }

  setCameraPosition(t) {
    const clampedT = Math.max(0, Math.min(1, t));
    const totalLength = 100;
    const z = -clampedT * totalLength;

    this.camera.position.set(0, 1, z);
    this.camera.lookAt(0, 0, z - 1);
    this.controls.target.set(0, 0, z - 1);
    this.controls.update();
  }

  createTunnel() {
    const path = new THREE.LineCurve3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -100)
    );
    const tubularSegments = 200;
    const geometry = new THREE.TubeGeometry(path, tubularSegments, 2, 32, false);
    const tunnelMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.09,
      depthWrite: false
    });
    const tunnelMesh = new THREE.Mesh(geometry, tunnelMaterial);
    this.scene.add(tunnelMesh);
    this.tunnel = tunnelMesh;

    const lineGeo = new LineGeometry();
    lineGeo.setPositions([0, 0, 0, 0, 0, -100]);
    const lineMaterial = new LineMaterial({
      color: 0xffffff,
      linewidth: 3,
      opacity: 0.7,
      transparent: true
    });
    const line = new Line2(lineGeo, lineMaterial);
    this.scene.add(line);
  }

  createGrid() {
    if (this.grid) {
      this.scene.remove(this.grid);
    }
    const gridSize = 100;
    const gridStep = 1;
    const lines = [];
    for (let x = -gridSize; x <= gridSize; x += gridStep) {
      lines.push(new THREE.Vector3(x, 0, -gridSize));
      lines.push(new THREE.Vector3(x, 0, gridSize));
    }
    for (let z = -gridSize; z <= gridSize; z += gridStep) {
      lines.push(new THREE.Vector3(-gridSize, 0, z));
      lines.push(new THREE.Vector3(gridSize, 0, z));
    }
    const gridGeometry = new THREE.BufferGeometry().setFromPoints(lines);
    const gridMaterial = new THREE.LineBasicMaterial({ color: 0x777777, opacity: 0.18, transparent: true });
    this.grid = new THREE.LineSegments(gridGeometry, gridMaterial);
    this.scene.add(this.grid);
  }

  createCharacterStrands() {
    if (!this.data || !this.data.characters) return;

    const tunnelRadius = 2;
    const minRadius = 0.1;
    const maxRadius = tunnelRadius - 0.1;
    Object.entries(this.data.characters).forEach(([charName, charData]) => {
      const points = [];
      const colors = [];
      const timeline = (charData.emotionTimeline || []).sort((a, b) => a.position - b.position);
      timeline.forEach((entry, i) => {
        const chaos = getChaosScore(entry.emotion);
        const radius = minRadius + (maxRadius - minRadius) * chaos;
        // Map emotion to sector
        const primary = EMOTION_TO_SECTOR[entry.emotion.toLowerCase()] || 'neutral';
        let sectorIdx = EMOTION_SECTORS.indexOf(primary);
        if (sectorIdx === -1) sectorIdx = 0; // fallback to first sector
        const angle = (sectorIdx / EMOTION_SECTORS.length) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        const z = -entry.position * 100;
        points.push(new THREE.Vector3(x, y, z));
        const color = new THREE.Color(getEmotionColor(entry.emotion, charData.color));
        colors.push(color);
      });
      let curve = points.length > 2 ? new THREE.CatmullRomCurve3(points) : { getPoints: () => points };
      const curvePoints = curve.getPoints(100);
      const geometry = new LineGeometry();
      const colorArray = new Float32Array(curvePoints.length * 3);
      const positionArray = new Float32Array(curvePoints.length * 3);
      for (let i = 0; i < curvePoints.length; i++) {
        const t = i / (curvePoints.length - 1);
        const idx = Math.floor(t * (colors.length - 1));
        const c = colors[idx];
        colorArray[i * 3] = c.r;
        colorArray[i * 3 + 1] = c.g;
        colorArray[i * 3 + 2] = c.b;
        positionArray[i * 3] = curvePoints[i].x;
        positionArray[i * 3 + 1] = curvePoints[i].y;
        positionArray[i * 3 + 2] = curvePoints[i].z;
      }
      geometry.setPositions(positionArray);
      geometry.setColors(colorArray);
      const material = new LineMaterial({ 
        vertexColors: true, 
        linewidth: 2,
        color: 0xffffff,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.85
      });
      const line = new Line2(geometry, material);
      this.scene.add(line);
      this.characterStrands.push(line);
      this.addCharacterLabel(charName, curvePoints[0], charData.color);
      const dotGeometry = new THREE.SphereGeometry(0.06, 16, 16);
      const dotMaterial = new THREE.MeshBasicMaterial({ color: charData.color });
      const startDot = new THREE.Mesh(dotGeometry, dotMaterial);
      startDot.position.copy(curvePoints[0]);
      this.scene.add(startDot);
      const endDot = new THREE.Mesh(dotGeometry, dotMaterial);
      endDot.position.copy(curvePoints[curvePoints.length - 1]);
      this.scene.add(endDot);
    });
  }

  createSceneOverlays() {
    this.createGrid();
    this.createEmotionWheelOverlay();
    if (this.data && this.data.scenes) {
      this.data.scenes.forEach(scene => {
        const z = -scene.t * 100;
        const geometry = new THREE.SphereGeometry(0.1, 12, 12);
        const material = new THREE.MeshBasicMaterial({ color: 0xffdd00 });
        const marker = new THREE.Mesh(geometry, material);
        marker.position.set(0, 0, z);
        this.scene.add(marker);

        const label = document.createElement('div');
        label.className = 'scene-label';
        label.textContent = scene.label;
        label.style.position = 'fixed';
        label.style.pointerEvents = 'none';
        label.style.zIndex = 1000;
        label.style.color = '#fff';
        label.style.padding = '2px 8px';
        label.style.borderRadius = '6px';
        label.style.background = 'rgba(0,0,0,0.8)';
        label.style.fontSize = '0.85rem';
        label.style.fontWeight = 'bold';
        label.style.boxShadow = '0 1px 4px rgba(0,0,0,0.2)';
        document.body.appendChild(label);

        if (!this.sceneLabels) this.sceneLabels = [];
        this.sceneLabels.push({ label, position: new THREE.Vector3(0, 0.1, z) });
      });
    }
  }

  createEmotionWheelOverlay() {
    // Remove previous overlays if any
    if (this.emotionWheelGroup) {
      this.scene.remove(this.emotionWheelGroup);
    }
    const group = new THREE.Group();
    const center = new THREE.Vector3(0, 0, 0);
    const radius = 2.0;
    const numSectors = EMOTION_SECTORS.length;
    const sectorAngle = (2 * Math.PI) / numSectors;
    // Colors for each sector (match wheel)
    const sectorColors = [
      0xfff86b, // happy
      0xb6a6f7, // surprised
      0xb0e0c6, // bad
      0xffe29a, // fearful
      0xff7b7b, // angry
      0xbdbdbd, // disgusted
      0x7ecbff  // sad
    ];
    // Draw sectors
    for (let i = 0; i < numSectors; i++) {
      const startAngle = i * sectorAngle;
      const endAngle = (i + 1) * sectorAngle;
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.absarc(0, 0, radius, startAngle, endAngle, false);
      shape.lineTo(0, 0);
      const geometry = new THREE.ShapeGeometry(shape, 32);
      const material = new THREE.MeshBasicMaterial({
        color: sectorColors[i],
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.z = -0.01; // Slightly behind the tunnel
      group.add(mesh);
      // Draw radial line (sector boundary)
      const lineGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(Math.cos(startAngle) * radius, Math.sin(startAngle) * radius, 0)
      ]);
      const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.18, transparent: true });
      const line = new THREE.Line(lineGeom, lineMat);
      group.add(line);
      // Add label (primary emotion)
      const labelAngle = startAngle + sectorAngle / 2;
      const labelRadius = radius * 1.08;
      const labelDiv = document.createElement('div');
      labelDiv.className = 'emotion-label';
      labelDiv.textContent = EMOTION_SECTORS[i][0].toUpperCase() + EMOTION_SECTORS[i].slice(1);
      labelDiv.style.position = 'fixed';
      labelDiv.style.pointerEvents = 'none';
      labelDiv.style.zIndex = 1000;
      labelDiv.style.color = '#fff';
      labelDiv.style.fontWeight = 'bold';
      labelDiv.style.fontSize = '1.1rem';
      labelDiv.style.textShadow = '0 1px 4px #000';
      document.body.appendChild(labelDiv);
      if (!this.emotionLabels) this.emotionLabels = [];
      this.emotionLabels.push({ label: labelDiv, angle: labelAngle, radius: labelRadius });
    }
    // Draw concentric circles
    for (let r = radius * 0.25; r <= radius; r += radius * 0.25) {
      const circleGeom = new THREE.RingGeometry(r - 0.01, r, 128);
      const circleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false });
      const circle = new THREE.Mesh(circleGeom, circleMat);
      circle.position.z = -0.02;
      group.add(circle);
    }
    group.position.z = 0;
    this.scene.add(group);
    this.emotionWheelGroup = group;
  }

  updateData(newData) {
    this.data = newData;
    this.clearScene();
    this.init();
  }

  clearScene() {
    this.characterStrands.forEach(s => this.scene.remove(s));
    this.characterStrands = [];
    this.interactionLinks.forEach(l => this.scene.remove(l));
    this.interactionLinks = [];
    if (this.characterLabels) {
      this.characterLabels.forEach(l => document.body.removeChild(l.label));
    }
    this.characterLabels = [];
    if (this.sceneLabels) {
      this.sceneLabels.forEach(l => document.body.removeChild(l.label));
    }
    this.sceneLabels = [];
  }

  loadTunnelSegments(mode = 'in-view') {}

  renderEmotionWheelOverlay() {}

  addCharacterLabel(charName, position, color) {
    const label = document.createElement('div');
    label.className = 'character-label';
    label.textContent = charName;
    label.style.position = 'fixed';
    label.style.pointerEvents = 'none';
    label.style.zIndex = 1000;
    label.style.background = 'rgba(30,30,30,0.92)';
    label.style.color = color || '#fff';
    label.style.padding = '4px 10px';
    label.style.borderRadius = '7px';
    label.style.fontSize = '1rem';
    label.style.fontWeight = 'bold';
    label.style.boxShadow = '0 2px 8px rgba(0,0,0,0.13)';
    document.body.appendChild(label);

    if (!this.characterLabels) this.characterLabels = [];
    this.characterLabels.push({ label, position });
    this.updateCharacterLabels();
  }

  updateCharacterLabels() {
    if (!this.characterLabels) return;
    const camera = this.camera;
    const container = this.sceneContainer;
    const rect = container.getBoundingClientRect();
    this.characterLabels.forEach(({ label, position }) => {
      const pos = position.clone().project(camera);
      const x = ((pos.x + 1) / 2) * rect.width + rect.left;
      const y = ((-pos.y + 1) / 2) * rect.height + rect.top;
      if (pos.z < -1 || pos.z > 1 || x < 0 || x > rect.width || y < 0 || y > rect.height) {
        label.style.display = 'none';
      } else {
        label.style.display = 'block';
        label.style.left = `${x}px`;
        label.style.top = `${y}px`;
      }
    });
    // Update emotion sector labels
    if (this.emotionLabels) {
      this.emotionLabels.forEach(({ label, angle, radius }) => {
        // Project polar to screen
        const x3 = Math.cos(angle) * radius;
        const y3 = Math.sin(angle) * radius;
        const pos = new THREE.Vector3(x3, y3, 0).project(camera);
        const x = ((pos.x + 1) / 2) * rect.width + rect.left;
        const y = ((-pos.y + 1) / 2) * rect.height + rect.top;
        if (pos.z < -1 || pos.z > 1 || x < 0 || x > rect.width || y < 0 || y > rect.height) {
          label.style.display = 'none';
        } else {
          label.style.display = 'block';
          label.style.left = `${x}px`;
          label.style.top = `${y}px`;
        }
      });
    }
  }

  setGridVisibilityByCamera(camera) {
    if (!this.grid) return;
    const viewDir = new THREE.Vector3();
    camera.getWorldDirection(viewDir);
    const angle = Math.abs(viewDir.angleTo(new THREE.Vector3(0, 1, 0)) * 180 / Math.PI);
    this.grid.visible = angle <= 80 || angle >= 100;
  }

  resize = () => {
    this.renderer.setSize(this.sceneContainer.clientWidth, this.sceneContainer.clientHeight);
    this.camera.aspect = this.sceneContainer.clientWidth / this.sceneContainer.clientHeight;
    this.camera.updateProjectionMatrix();
  }

  changeColorScheme(colorScheme) {
    this.scene.background = new THREE.Color(colorScheme.sceneBg);
  }
}

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

export function getEmotionColor(emotion, baseColor) {
  return EMOTION_WHEEL_COLORS[emotion.toLowerCase()] || baseColor;
}

export function getSentimentIntensity(sentiment) {
  return 1.0;
}

const EMOTION_CHAOS = {
  calm: 0.0, peaceful: 0.0, content: 0.1, joy: 0.2,
  happy: 0.2, proud: 0.3, surprised: 0.5, sad: 0.7,
  fearful: 0.8, angry: 1.0, disgusted: 0.9
};

function getChaosScore(emotion) {
  return EMOTION_CHAOS[emotion?.toLowerCase?.()] ?? 0.5;
}

// Emotion sector mapping (primary emotions from the wheel)
const EMOTION_SECTORS = [
  'happy', 'surprised', 'bad', 'fearful', 'angry', 'disgusted', 'sad'
];
const EMOTION_TO_SECTOR = {
  happy: 'happy', joyful: 'happy', content: 'happy', proud: 'happy', peaceful: 'happy', trusting: 'happy', optimistic: 'happy',
  surprised: 'surprised', excited: 'surprised', amazed: 'surprised', confused: 'surprised',
  bad: 'bad', bored: 'bad', tired: 'bad', stressed: 'bad', overwhelmed: 'bad',
  fearful: 'fearful', scared: 'fearful', anxious: 'fearful', insecure: 'fearful', weak: 'fearful', rejected: 'fearful',
  angry: 'angry', mad: 'angry', aggressive: 'angry', frustrated: 'angry', distant: 'angry', critical: 'angry',
  disgusted: 'disgusted', disapproving: 'disgusted', disappointed: 'disgusted', repelled: 'disgusted',
  sad: 'sad', lonely: 'sad', vulnerable: 'sad', despair: 'sad', guilty: 'sad', ashamed: 'sad', depressed: 'sad', hurt: 'sad', grief: 'sad', powerless: 'sad', empty: 'sad', victimized: 'sad', abandoned: 'sad', fragile: 'sad', remorseful: 'sad', embarrassed: 'sad', appalled: 'sad', horrified: 'sad', hesitant: 'sad', disappointed: 'sad', apathetic: 'sad', indifferent: 'sad', helpless: 'sad', hopeless: 'sad', inadequate: 'sad', insignificant: 'sad', excluded: 'sad', persecuted: 'sad', exposed: 'sad', betrayed: 'sad', resentful: 'sad', disrespected: 'sad', ridiculed: 'sad', indignant: 'sad', violated: 'sad', furious: 'angry', jealous: 'angry', provoked: 'angry', hostile: 'angry', infuriated: 'angry', annoyed: 'angry', withdrawn: 'angry', numb: 'angry', sceptical: 'angry', dismissive: 'angry', judgmental: 'angry', embarrassed: 'sad', appalled: 'disgusted', horrified: 'disgusted', hesitant: 'disgusted', disappointed: 'sad', ashamed: 'sad', remorseful: 'sad', powerless: 'sad', empty: 'sad', victimized: 'sad', abandoned: 'sad', fragile: 'sad', grief: 'sad', depressed: 'sad', hurt: 'sad', despair: 'sad', vulnerable: 'sad', lonely: 'sad', sad: 'sad', fearful: 'fearful', angry: 'angry', disgusted: 'disgusted', surprised: 'surprised', bad: 'bad', happy: 'happy'
};

const COLOR_SCHEMES = {
  monokai: { sceneBg: '#1e1e1e' },
  "desert-oasis": { sceneBg: '#fbf1c7' },
  "iceberg-light": { sceneBg: '#e8f1f9' },
  cheesecake: { sceneBg: '#fdf6e3' },
  "gruvbox-light": { sceneBg: '#f9f5d7' },
  "blueberry-light": { sceneBg: '#edf5fd' },
  darling: { sceneBg: '#2a1f33' },
  dracula: { sceneBg: '#282a36' },
  nord: { sceneBg: '#2e3440' },
  "gruvbox-dark": { sceneBg: '#282828' },
  paper: { sceneBg: '#fefefe' }
};
