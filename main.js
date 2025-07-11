import * as THREE from 'three';
import { generateEmotionData } from './nlp/generateEmotionData.js';
import { applyColorScheme } from './themes.js';
import { TunnelVisualizationSystem } from './visualizer/renderer.js';

// Set up renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
const canvasContainer = document.getElementById('scene-container');
canvasContainer.appendChild(renderer.domElement);

// Create empty tunnel system (we'll load data on demand)
const tunnelSystem = new TunnelVisualizationSystem(null, renderer);
tunnelSystem.init();

// Color scheme switcher
const colorSchemeSwitcher = document.getElementById('color-scheme-switcher');
colorSchemeSwitcher.addEventListener('change', (e) => {
  applyColorScheme(e.target.value, tunnelSystem);
});
applyColorScheme('monokai');

// Window resize handling
function resize() {
  tunnelSystem.resize();
}
window.addEventListener('resize', resize);
new ResizeObserver(tunnelSystem.resize).observe(tunnelSystem.sceneContainer);

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  tunnelSystem.update();
}
animate();

// "Run Analysis" button logic
const runBtn = document.getElementById('run-btn');
const storyInput = document.getElementById('story-editor');
const timelineScrubber = document.getElementById('timeline-scrubber');
timelineScrubber.disabled = true;

timelineScrubber.addEventListener('input', (e) => {
  const t = parseFloat(e.target.value);
  tunnelSystem.setCameraPosition(t);
});

runBtn.addEventListener('click', async () => {
  const storyText = storyInput.value;
  runBtn.disabled = true;
  runBtn.textContent = 'Analyzing...';

  try {
    const data = await generateEmotionData(storyText);
    console.log(data);
    tunnelSystem.updateData(data);

    // 2.4: Sync scrubber when data updates
    timelineScrubber.disabled = false;
    timelineScrubber.value = 0;
    timelineScrubber.max = 1;
    timelineScrubber.step = 0.001;

  } catch (err) {
    console.error('Error generating data:', err);
    alert('Failed to analyze story. See console for details.');
  }

  runBtn.textContent = 'Run';
  runBtn.disabled = false;
});
