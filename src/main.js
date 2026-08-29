import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import './style.css';

const SLICE_COUNT = 76;
const MODEL_URL = '/assets/flower.glb';
const FRAME_URL = (index) => `/assets/slices/frame-${String(index + 1).padStart(3, '0')}.png`;

const canvas = document.querySelector('#scene');
const section = document.querySelector('.slice-section');
const frameCounter = document.querySelector('#frame-counter');
const stageStatus = document.querySelector('#stage-status');
const stageHint = document.querySelector('#stage-hint');
const loadingPanel = document.querySelector('#loading-panel');
const loadingPercent = document.querySelector('#loading-percent');
const loadingBarFill = document.querySelector('#loading-bar-fill');
const loadingDetail = document.querySelector('#loading-detail');
const expandButton = document.querySelector('#expand-button');

const state = {
  scrollProgress: 0,
  frameFloat: 0,
  spread: 0,
  spreadTarget: 0,
  orbit: 0,
  orbitTarget: 0,
  isDragging: false,
};

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmallViewport = window.matchMedia('(max-width: 700px)').matches;
const clock = new THREE.Clock();
const pointer = {
  active: false,
  startX: 0,
  currentX: 0,
  startSpread: 0,
  startOrbit: 0,
};

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 100);
camera.position.set(4.2, 1.6, 8.8);

const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: !isSmallViewport,
  powerPreference: 'high-performance',
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmallViewport ? 1.25 : 1.8));

const ambientLight = new THREE.HemisphereLight(0xfff2dc, 0x51435d, 2.1);
const keyLight = new THREE.DirectionalLight(0xffe3c5, 3.5);
keyLight.position.set(4, 6, 5);
const rimLight = new THREE.DirectionalLight(0xc9b4ff, 2.4);
rimLight.position.set(-5, 3, -2);
scene.add(ambientLight, keyLight, rimLight);

const timeline = new THREE.Group();
const heroRoot = new THREE.Group();
const sliceRoot = new THREE.Group();
sliceRoot.scale.setScalar(isSmallViewport ? 0.78 : 1);
timeline.add(sliceRoot);
scene.add(timeline, heroRoot);

const slices = [];
let mixer = null;
let clipDuration = 0;
let flower = null;
let lastDisplayedFrame = -1;
let lastStatus = '';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function damp(current, target, smoothing, delta) {
  if (prefersReducedMotion) return target;
  return THREE.MathUtils.damp(current, target, smoothing, delta);
}

function roundedRectGeometry(width, height, radius) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  const r = Math.min(radius, width / 2, height / 2);

  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);

  return new THREE.ShapeGeometry(shape);
}

function setLoading(progress, detail) {
  const percent = Math.round(clamp(progress, 0, 1) * 100);
  loadingPercent.textContent = `${percent}%`;
  loadingBarFill.style.width = `${percent}%`;
  loadingDetail.textContent = detail;
}

function setStageStatus(value) {
  if (value === lastStatus) return;
  lastStatus = value;
  stageStatus.textContent = value;
}

function createSlice(texture, index) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);

  const group = new THREE.Group();
  const cardMaterial = new THREE.MeshBasicMaterial({
    color: index % 3 === 0 ? 0xffd5cf : index % 3 === 1 ? 0xdcccf4 : 0xffedc8,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const card = new THREE.Mesh(roundedRectGeometry(2.85, 2.3, 0.12), cardMaterial);
  card.position.z = -0.06;
  card.renderOrder = 10;

  const outlineMaterial = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const outline = new THREE.LineSegments(new THREE.EdgesGeometry(card.geometry), outlineMaterial);
  outline.position.z = -0.03;
  outline.renderOrder = 12;

  const imageMaterial = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const image = new THREE.Mesh(new THREE.PlaneGeometry(2.56, 2.06), imageMaterial);
  image.position.z = 0.02;
  image.renderOrder = 11;

  group.add(card, outline, image);
  group.position.y = 0.08;
  group.userData = { index, card, outline, image };
  sliceRoot.add(group);
  slices.push(group);
}

async function loadModel() {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(MODEL_URL);
  flower = gltf.scene;

  flower.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = false;
    object.receiveShadow = false;
    if (object.material) object.material.side = THREE.DoubleSide;
  });

  const bounds = new THREE.Box3().setFromObject(flower);
  const size = bounds.getSize(new THREE.Vector3());
  const scale = (isSmallViewport ? 2.25 : 3.2) / Math.max(size.y, 0.001);
  flower.scale.setScalar(scale);
  flower.position.y = isSmallViewport ? -0.58 : -0.72;
  heroRoot.add(flower);

  if (gltf.animations.length > 0) {
    const clip = gltf.animations.find((item) => item.name.toLowerCase().includes('fly')) ?? gltf.animations[0];
    mixer = new THREE.AnimationMixer(flower);
    mixer.clipAction(clip).play();
    clipDuration = clip.duration;
  }
}

async function loadSlices() {
  const loader = new THREE.TextureLoader();
  let loaded = 0;
  const textures = await Promise.all(
    Array.from({ length: SLICE_COUNT }, async (_, index) => {
      const texture = await loader.loadAsync(FRAME_URL(index));
      loaded += 1;
      setLoading(0.22 + (loaded / SLICE_COUNT) * 0.68, `生成时间切片 ${String(loaded).padStart(2, '0')} / ${SLICE_COUNT}`);
      return texture;
    }),
  );

  textures.forEach(createSlice);
}

function updateScrollProgress() {
  const rect = section.getBoundingClientRect();
  const scrollLength = Math.max(section.offsetHeight - window.innerHeight, 1);
  const progress = clamp(-rect.top / scrollLength, 0, 1);
  state.scrollProgress = progress;
  state.frameFloat = progress * (SLICE_COUNT - 1);
}

function updateHero(delta) {
  if (mixer && clipDuration > 0) mixer.setTime(state.scrollProgress * clipDuration);

  const cinematic = smoothstep(0.52, 0.95, state.scrollProgress);
  const automaticOrbit = cinematic * 0.32;
  state.orbit = damp(state.orbit, state.orbitTarget + automaticOrbit, 5, delta);

  heroRoot.rotation.y = damp(heroRoot.rotation.y, state.orbit * 0.9 + state.spread * 0.12, 4.5, delta);
  heroRoot.rotation.z = damp(heroRoot.rotation.z, Math.sin(state.scrollProgress * Math.PI) * 0.035, 4.5, delta);

  const cameraOrbit = state.orbit * 0.65;
  const cameraRadius = (isSmallViewport ? 10.2 : 8.7) - state.spread * (isSmallViewport ? 0.45 : 0.7);
  const targetCamera = new THREE.Vector3(
    Math.sin(cameraOrbit) * 1.65,
    1.25 + Math.sin(state.scrollProgress * Math.PI) * 0.25,
    cameraRadius,
  );
  camera.position.lerp(targetCamera, prefersReducedMotion ? 1 : 1 - Math.exp(-4 * delta));
  camera.lookAt(0, 0.5, 0);
}

function updateSlices(delta) {
  state.spread = damp(state.spread, state.spreadTarget, 7, delta);
  const reveal = smoothstep(0.025, 0.2, state.spread);
  const center = (SLICE_COUNT - 1) / 2;

  timeline.rotation.y = damp(timeline.rotation.y, state.orbit * 0.28, 4, delta);
  timeline.rotation.x = damp(timeline.rotation.x, -state.spread * 0.06, 4, delta);

  slices.forEach((slice, index) => {
    const offset = index - center;
    const distance = Math.abs(index - state.frameFloat);
    const focus = Math.max(0, 1 - distance / 5);
    const timeOpacity = 0.045 + Math.max(0, 0.13 - distance * 0.0015);
    const imageOpacity = reveal * (timeOpacity + focus * 0.12);

    slice.position.x = offset * 0.055 * state.spread;
    slice.position.y = Math.sin(index * 0.33) * 0.03 * state.spread;
    slice.position.z = -offset * 0.12 * state.spread - 0.55;
    slice.rotation.y = offset * 0.012 * state.spread;
    slice.rotation.z = Math.sin(index * 0.17) * 0.012 * state.spread;

    slice.userData.card.material.opacity = 0.008 + reveal * (0.016 + focus * 0.014);
    slice.userData.outline.material.opacity = reveal * (0.13 + focus * 0.14);
    slice.userData.image.material.opacity = imageOpacity;
    slice.scale.setScalar(1 + focus * 0.035 * reveal);
  });

  const frame = Math.round(state.frameFloat) + 1;
  if (frame !== lastDisplayedFrame) {
    lastDisplayedFrame = frame;
    frameCounter.textContent = `FRAME ${String(frame).padStart(2, '0')} / ${SLICE_COUNT}`;
  }

  stageHint.classList.toggle('is-hidden', state.spread > 0.08 || state.scrollProgress > 0.08);
  expandButton.setAttribute('aria-pressed', String(state.spreadTarget > 0.5));
  expandButton.textContent = state.spreadTarget > 0.5 ? '收拢切片' : '展开切片';
}

function updateInteraction() {
  const deltaX = pointer.currentX - pointer.startX;
  state.spreadTarget = clamp(pointer.startSpread + (deltaX / window.innerWidth) * 1.35, 0, 1);
  state.orbitTarget = pointer.startOrbit + (deltaX / window.innerWidth) * 0.42;
}

function onPointerDown(event) {
  pointer.active = true;
  pointer.startX = event.clientX;
  pointer.currentX = event.clientX;
  pointer.startSpread = state.spreadTarget;
  pointer.startOrbit = state.orbitTarget;
  state.isDragging = true;
  canvas.setPointerCapture(event.pointerId);
}

function onPointerMove(event) {
  if (!pointer.active) return;
  pointer.currentX = event.clientX;
  updateInteraction();
}

function onPointerUp(event) {
  pointer.active = false;
  state.isDragging = false;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
}

function toggleSpread() {
  state.spreadTarget = state.spreadTarget > 0.5 ? 0 : 1;
  state.orbitTarget = state.spreadTarget > 0.5 ? 0.18 : 0;
  canvas.focus({ preventScroll: true });
}

function onKeyDown(event) {
  if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
    event.preventDefault();
    state.spreadTarget = clamp(state.spreadTarget + 0.12, 0, 1);
  }
  if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
    event.preventDefault();
    state.spreadTarget = clamp(state.spreadTarget - 0.12, 0, 1);
  }
  if (event.key === 'Home') {
    event.preventDefault();
    state.spreadTarget = 0;
  }
  if (event.key === 'End') {
    event.preventDefault();
    state.spreadTarget = 1;
  }
}

function resize() {
  const width = canvas.clientWidth || window.innerWidth;
  const height = canvas.clientHeight || window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

async function boot() {
  resize();
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('scroll', updateScrollProgress, { passive: true });
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('keydown', onKeyDown);
  expandButton.addEventListener('click', toggleSpread);

  try {
    setStageStatus('载入模型');
    setLoading(0.08, '载入杜鹃花骨骼动画');
    await loadModel();
    setLoading(0.2, '模型就绪，准备 76 个时间切片');
    await loadSlices();
    setStageStatus('交互就绪');
    setLoading(1, '完成');
    loadingPanel.classList.add('is-complete');
  } catch (error) {
    console.error(error);
    setStageStatus('资源缺失');
    loadingDetail.textContent = '请先运行 Blender 导出脚本，再刷新页面';
  }
}

function render() {
  const delta = Math.min(clock.getDelta(), 0.05);
  updateScrollProgress();
  updateHero(delta);
  updateSlices(delta);
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

boot();
render();
