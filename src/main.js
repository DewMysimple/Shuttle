import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';

const FRAME_URL = (index) => `/assets/slices/frame-${String(index + 1).padStart(3, '0')}.png`;
const COLLAPSED_STEP = 0.018;
const EXPANDED_STEP = 0.32;
const IMAGE_SIZE = 3;
const CARD_SIZE = 3.16;
const PLAYBACK_FPS = 18;
const SHUTTLE_SMOOTHING = 18;
const SPREAD_SMOOTHING = 8;
const CAMERA_SMOOTHING = 11;
const AUTO_COMPACT_TILT = THREE.MathUtils.degToRad(2.5);
const AUTO_EXPANDED_TILT = THREE.MathUtils.degToRad(68);
const EXPANSION_GESTURE_RADIUS = 0.2;

const canvas = document.querySelector('#scene');
const stage = document.querySelector('.slice-stage');
const frameCounter = document.querySelector('#frame-counter');
const stageStatus = document.querySelector('#stage-status');
const loadingPanel = document.querySelector('#loading-panel');
const loadingPercent = document.querySelector('#loading-percent');
const loadingBarFill = document.querySelector('#loading-bar-fill');
const loadingDetail = document.querySelector('#loading-detail');
const expandButton = document.querySelector('#expand-button');
const timelineProgress = document.querySelector('#timeline-progress');
const playButtons = [...document.querySelectorAll('[data-playback-direction]')];
const jumpStartButton = document.querySelector('#jump-start');
const jumpEndButton = document.querySelector('#jump-end');
const resetViewButton = document.querySelector('#reset-view');

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmallViewport = window.matchMedia('(max-width: 760px)').matches;
const clock = new THREE.Clock();

const state = {
  shuttle: 0,
  shuttleTarget: 0,
  spread: 0,
  spreadTarget: 0,
  zoomOffset: 0,
  zoomOffsetTarget: 0,
  isPlaying: false,
  playbackDirection: 1,
  previewTilt: null,
};

const pointer = {
  active: false,
  pending: false,
  id: null,
  mode: null,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
  startRadius: 0,
  startSpread: 0,
};

let sliceCount = 0;
let slices = [];
let playbackAccumulator = 0;
let lastDisplayedFrame = -1;
let lastStatus = '';
let lastWheelStepAt = 0;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 120);
const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: !isSmallViewport,
  powerPreference: 'high-performance',
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmallViewport ? 1.3 : 1.8));

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = !prefersReducedMotion;
controls.dampingFactor = 0.085;
controls.enablePan = true;
controls.enableZoom = true;
controls.screenSpacePanning = true;
controls.minDistance = 2.8;
controls.maxDistance = 120;
controls.minPolarAngle = 0.02;
controls.maxPolarAngle = Math.PI - 0.02;
camera.up.set(0, 1, 0);

let cameraMode = 'auto';
let nativeControlActive = false;
let lastFocusY = 0;
let hasCameraState = false;

const timelineRoot = new THREE.Group();
const atmosphereRoot = new THREE.Group();
scene.add(atmosphereRoot, timelineRoot);

const atmosphereItems = [];
let rail = null;
let railTicks = null;

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

function currentStep() {
  return THREE.MathUtils.lerp(COLLAPSED_STEP, EXPANDED_STEP, smoothstep(0, 1, state.spread));
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

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
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

controls.addEventListener('start', () => {
  cameraMode = 'user';
  nativeControlActive = true;
  stage.classList.add('is-orbiting');
});

controls.addEventListener('end', () => {
  nativeControlActive = false;
  stage.classList.remove('is-orbiting');
});

function syncPlaybackButtons() {
  playButtons.forEach((button) => {
    const isActive = state.isPlaying
      && Number(button.dataset.playbackDirection) === state.playbackDirection;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function syncExpandButton() {
  const expanded = state.spreadTarget >= 0.5;
  stage.classList.toggle('is-expanded', expanded);
  expandButton.setAttribute('aria-pressed', String(expanded));
  expandButton.textContent = expanded ? '收拢时间轴' : '展开 91 帧';
}

function createAtmosphere() {
  const random = seededRandom(76091);
  const count = isSmallViewport ? 42 : 76;
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = random() * 18 - 4;
    positions[index * 3 + 1] = random() * 8 - 4;
    positions[index * 3 + 2] = random() * 5 - 3;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: 0xfff0dd,
      size: isSmallViewport ? 0.035 : 0.052,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  );
  points.userData.phase = 0.4;
  atmosphereRoot.add(points);
  atmosphereItems.push(points);

  [
    { x: -1.3, y: 1.4, size: 2.7, color: 0xffd1ca, opacity: 0.055 },
    { x: 5.8, y: -1.25, size: 3.5, color: 0xd3c0ef, opacity: 0.045 },
  ].forEach((config, index) => {
    const halo = new THREE.Mesh(
      new THREE.CircleGeometry(config.size, 64),
      new THREE.MeshBasicMaterial({
        color: config.color,
        transparent: true,
        opacity: config.opacity,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    halo.position.set(config.x, config.y, -2.8 - index * 0.2);
    halo.userData.phase = index * 1.7;
    atmosphereRoot.add(halo);
    atmosphereItems.push(halo);
  });
}

function createRail() {
  rail = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.008, 0.008),
    new THREE.MeshBasicMaterial({
      color: 0x67475f,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
    }),
  );
  rail.position.x = -CARD_SIZE * 0.62;
  rail.rotation.z = Math.PI / 2;
  rail.renderOrder = 1;
  timelineRoot.add(rail);

  railTicks = new THREE.Group();
  const tickGeometry = new THREE.BoxGeometry(0.105, 0.008, 0.008);
  for (let index = 0; index < 19; index += 1) {
    const tick = new THREE.Mesh(
      tickGeometry,
      new THREE.MeshBasicMaterial({
        color: 0x67475f,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
      }),
    );
    tick.userData.frameIndex = Math.min(index * 5, 90);
    railTicks.add(tick);
  }
  timelineRoot.add(railTicks);
}

function configureTexture(texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.needsUpdate = true;
  return texture;
}

function getCameraLayout() {
  const step = currentStep();
  const railLength = Math.max(0.001, (sliceCount - 1) * step);
  const selectedY = state.shuttle * step;
  const railMidpoint = railLength / 2;
  const overviewBlend = smoothstep(0.46, 0.94, state.spread);
  return {
    focusY: THREE.MathUtils.lerp(selectedY, railMidpoint, overviewBlend),
    overviewBlend,
  };
}

function getAutomaticTilt(overviewBlend) {
  if (state.previewTilt !== null) return state.previewTilt;
  return THREE.MathUtils.lerp(AUTO_COMPACT_TILT, AUTO_EXPANDED_TILT, overviewBlend);
}

function getAutomaticCameraPosition(focusY, overviewBlend) {
  const compactDistance = isSmallViewport ? 10.6 : 6.9;
  const expandedDistance = isSmallViewport ? 72 : 54;
  const distance = THREE.MathUtils.lerp(compactDistance, expandedDistance, overviewBlend)
    + state.zoomOffset;
  const tilt = getAutomaticTilt(overviewBlend);
  const target = new THREE.Vector3(0, focusY, 0);
  const offset = new THREE.Vector3(
    0,
    Math.cos(tilt) * distance,
    Math.sin(tilt) * distance,
  );
  return { target, position: target.clone().add(offset) };
}

function applyAutomaticCamera(focusY, overviewBlend, delta, immediate = false) {
  const { target, position } = getAutomaticCameraPosition(focusY, overviewBlend);
  const blend = immediate || prefersReducedMotion
    ? 1
    : 1 - Math.exp(-CAMERA_SMOOTHING * delta);
  controls.target.lerp(target, blend);
  camera.position.lerp(position, blend);
  camera.up.set(0, 1, 0);
  camera.lookAt(controls.target);
  controls.update();
}

function resetCameraView() {
  state.previewTilt = null;
  state.zoomOffset = 0;
  state.zoomOffsetTarget = 0;
  cameraMode = 'auto';
  nativeControlActive = false;
  stage.classList.remove('is-orbiting');
  if (sliceCount) {
    const { focusY, overviewBlend } = getCameraLayout();
    applyAutomaticCamera(focusY, overviewBlend, 0, true);
    lastFocusY = focusY;
    hasCameraState = true;
  }
}

async function loadTextures(count) {
  const loader = new THREE.TextureLoader();
  const textures = new Array(count);
  const batchSize = isSmallViewport ? 5 : 9;
  let loaded = 0;
  for (let start = 0; start < count; start += batchSize) {
    const end = Math.min(start + batchSize, count);
    await Promise.all(
      Array.from({ length: end - start }, (_, offset) => {
        const index = start + offset;
        return loader.loadAsync(FRAME_URL(index)).then((texture) => {
          textures[index] = configureTexture(texture);
          loaded += 1;
          setLoading(0.08 + (loaded / count) * 0.84, `载入逐帧姿态 ${loaded} / ${count}`);
        });
      }),
    );
  }
  return textures;
}

function createSlices(textures) {
  const imageGeometry = new THREE.PlaneGeometry(IMAGE_SIZE, IMAGE_SIZE);
  const cardShape = roundedRectGeometry(CARD_SIZE, CARD_SIZE, 0.2);
  const cardEdgeGeometry = new THREE.EdgesGeometry(cardShape);

  slices = textures.map((texture, index) => {
    const root = new THREE.Group();
    root.rotation.x = -Math.PI / 2;
    const cardMaterial = new THREE.MeshBasicMaterial({
      color: index % 2 ? 0xf7dfdb : 0xeadcf0,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    });
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: index % 3 === 0 ? 0x9d6388 : 0x745b80,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
    });
    const imageMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      alphaTest: 0.012,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });

    const card = new THREE.Mesh(cardShape, cardMaterial);
    const edge = new THREE.LineSegments(cardEdgeGeometry, edgeMaterial);
    const image = new THREE.Mesh(imageGeometry, imageMaterial);
    card.position.z = -0.018;
    image.position.z = 0.012;
    root.add(card, edge, image);
    root.userData = { index, cardMaterial, edgeMaterial, imageMaterial };
    timelineRoot.add(root);
    return root;
  });
}

function setShuttleTarget(value) {
  state.shuttleTarget = clamp(value, 0, Math.max(0, sliceCount - 1));
}

function stepShuttle(direction, amount = 1) {
  stopPlayback();
  const origin = Math.round(state.shuttleTarget);
  setShuttleTarget(origin + direction * amount);
}

function jumpToFrame(index) {
  stopPlayback();
  setShuttleTarget(index);
}

function startPlayback(direction) {
  if (!sliceCount) return;
  if (state.isPlaying && state.playbackDirection === direction) {
    stopPlayback();
    return;
  }
  if (direction > 0 && state.shuttleTarget >= sliceCount - 1) setShuttleTarget(0);
  if (direction < 0 && state.shuttleTarget <= 0) setShuttleTarget(sliceCount - 1);
  state.playbackDirection = direction;
  state.isPlaying = true;
  playbackAccumulator = 0;
  syncPlaybackButtons();
}

function stopPlayback() {
  if (!state.isPlaying) return;
  state.isPlaying = false;
  playbackAccumulator = 0;
  syncPlaybackButtons();
}

function updatePlayback(delta) {
  if (!state.isPlaying || !sliceCount) return;
  playbackAccumulator += delta * PLAYBACK_FPS;
  while (playbackAccumulator >= 1) {
    playbackAccumulator -= 1;
    const next = Math.round(state.shuttleTarget) + state.playbackDirection;
    if (next < 0 || next >= sliceCount) {
      stopPlayback();
      break;
    }
    setShuttleTarget(next);
  }
}

function updateTimeline(delta) {
  state.shuttle = damp(state.shuttle, state.shuttleTarget, SHUTTLE_SMOOTHING, delta);
  state.spread = damp(state.spread, state.spreadTarget, SPREAD_SMOOTHING, delta);
  state.zoomOffset = damp(state.zoomOffset, state.zoomOffsetTarget, CAMERA_SMOOTHING, delta);

  const step = currentStep();
  const railLength = Math.max(0.001, (sliceCount - 1) * step);
  const selectedY = state.shuttle * step;
  const railMidpoint = railLength / 2;
  const overviewBlend = smoothstep(0.46, 0.94, state.spread);
  const focusY = THREE.MathUtils.lerp(selectedY, railMidpoint, overviewBlend);
  const selectedFrame = clamp(Math.round(state.shuttle), 0, Math.max(0, sliceCount - 1));

  slices.forEach((slice) => {
    const { index, imageMaterial, cardMaterial, edgeMaterial } = slice.userData;
    const distance = Math.abs(index - state.shuttle);
    const selected = index === selectedFrame;
    slice.position.y = index * step;
    const expandedScale = THREE.MathUtils.lerp(1, 1.65, overviewBlend);
    slice.scale.setScalar(expandedScale);

    const compactNeighbor = Math.max(0, 1 - distance / 2.7);
    const expandedPresence = 0.055 + 0.035 * Math.max(0, 1 - distance / 22);
    const baseOpacity = THREE.MathUtils.lerp(compactNeighbor * 0.05, expandedPresence, overviewBlend);
    imageMaterial.opacity = selected ? 1 : baseOpacity;
    cardMaterial.opacity = selected
      ? THREE.MathUtils.lerp(0.06, 0.13, overviewBlend)
      : THREE.MathUtils.lerp(compactNeighbor * 0.012, 0.026, overviewBlend);
    edgeMaterial.opacity = selected
      ? THREE.MathUtils.lerp(0.28, 0.42, overviewBlend)
      : THREE.MathUtils.lerp(compactNeighbor * 0.035, 0.1, overviewBlend);
    slice.visible = selected || distance < THREE.MathUtils.lerp(3, sliceCount, overviewBlend);
    slice.renderOrder = selected ? 1000 : Math.max(20, 900 - Math.round(distance * 5));
    slice.children.forEach((child) => { child.renderOrder = slice.renderOrder; });
  });

  rail.scale.x = railLength;
  rail.position.y = railMidpoint;
  rail.material.opacity = 0.24 * overviewBlend;
  railTicks.children.forEach((tick) => {
    tick.position.set(rail.position.x, tick.userData.frameIndex * step, 0);
    tick.material.opacity = 0.26 * overviewBlend;
  });

  if (!hasCameraState) {
    lastFocusY = focusY;
    hasCameraState = true;
  }
  if (cameraMode === 'auto') {
    applyAutomaticCamera(focusY, overviewBlend, delta);
  } else {
    const focusDelta = focusY - lastFocusY;
    if (Math.abs(focusDelta) > 0.00001) {
      camera.position.y += focusDelta;
      controls.target.y += focusDelta;
    }
    controls.update();
  }
  lastFocusY = focusY;

  if (selectedFrame !== lastDisplayedFrame) {
    lastDisplayedFrame = selectedFrame;
    frameCounter.textContent = `FRAME ${String(selectedFrame + 1).padStart(3, '0')} / ${String(sliceCount).padStart(3, '0')}`;
  }
  timelineProgress.style.width = `${sliceCount > 1 ? (state.shuttle / (sliceCount - 1)) * 100 : 0}%`;

  if (pointer.mode === 'spread') setStageStatus('调整时间间距');
  else if (nativeControlActive) setStageStatus('原生三维控制');
  else if (state.isPlaying) setStageStatus('沿轨道穿梭');
  else if (overviewBlend > 0.7) setStageStatus('91 帧实体总览');
  else setStageStatus('X-Y 平面正视');
}

function updateAtmosphere(elapsed) {
  atmosphereItems.forEach((item, index) => {
    if (item.isPoints) {
      item.position.y = Math.sin(elapsed * 0.12 + item.userData.phase) * 0.08;
    } else {
      const scale = 1 + Math.sin(elapsed * 0.18 + item.userData.phase) * 0.025;
      item.scale.setScalar(prefersReducedMotion ? 1 : scale);
      item.rotation.z = Math.sin(elapsed * 0.05 + index) * 0.025;
    }
  });
}

function radialDistance(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const dx = clientX - (rect.left + rect.width / 2);
  const dy = clientY - (rect.top + rect.height / 2);
  return Math.hypot(dx, dy);
}

function isExpansionGesture(event) {
  if (event.button !== 0 || event.pointerType === 'touch') return false;
  if (event.altKey) return true;
  const rect = canvas.getBoundingClientRect();
  const radius = radialDistance(event.clientX, event.clientY);
  return radius <= Math.min(rect.width, rect.height) * EXPANSION_GESTURE_RADIUS;
}

function radialMotion(event) {
  const rect = canvas.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const startX = pointer.startX - centerX;
  const startY = pointer.startY - centerY;
  const moveX = event.clientX - pointer.startX;
  const moveY = event.clientY - pointer.startY;
  if (pointer.startRadius < 16) return Math.hypot(moveX, moveY);
  return (moveX * startX + moveY * startY) / pointer.startRadius;
}

function activateSpreadGesture(event) {
  pointer.active = true;
  pointer.pending = false;
  pointer.mode = 'spread';
  controls.enabled = false;
  cameraMode = 'auto';
  nativeControlActive = false;
  stage.classList.remove('is-orbiting');
  stage.classList.add('is-expanding');
  canvas.setPointerCapture(event.pointerId);
}

function beginPointer(event) {
  if (!sliceCount || pointer.active || !isExpansionGesture(event)) return;
  pointer.id = event.pointerId;
  pointer.pending = !event.altKey;
  pointer.active = false;
  pointer.mode = null;
  pointer.startX = event.clientX;
  pointer.startY = event.clientY;
  pointer.lastX = event.clientX;
  pointer.lastY = event.clientY;
  pointer.startRadius = radialDistance(event.clientX, event.clientY);
  pointer.startSpread = state.spreadTarget;
  stopPlayback();
  if (event.altKey) {
    activateSpreadGesture(event);
    event.preventDefault();
  }
}

function movePointer(event) {
  if (pointer.id !== event.pointerId) return;
  if (pointer.pending && !pointer.active) {
    const movement = Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY);
    const outwardMotion = radialMotion(event);
    if (movement < 8 || Math.abs(outwardMotion) < 10) return;
    activateSpreadGesture(event);
  }
  if (!pointer.active) return;
  const rect = canvas.getBoundingClientRect();
  const radiusDelta = radialDistance(event.clientX, event.clientY) - pointer.startRadius;
  state.spreadTarget = clamp(
    pointer.startSpread + radiusDelta / (Math.min(rect.width, rect.height) * 0.31),
    0,
    1,
  );
  syncExpandButton();
  pointer.lastX = event.clientX;
  pointer.lastY = event.clientY;
  event.stopImmediatePropagation();
  event.preventDefault();
}

function endPointer(event) {
  if ((!pointer.active && !pointer.pending) || pointer.id !== event.pointerId) return;
  if (pointer.active && canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
  if (pointer.active) controls.enabled = true;
  pointer.active = false;
  pointer.pending = false;
  pointer.id = null;
  pointer.mode = null;
  stage.classList.remove('is-expanding');
}

function dollyUserCamera(deltaY) {
  const offset = camera.position.clone().sub(controls.target);
  const distance = offset.length();
  if (!distance) return;
  const nextDistance = clamp(distance + deltaY * 0.008, controls.minDistance, controls.maxDistance);
  camera.position.copy(controls.target).add(offset.normalize().multiplyScalar(nextDistance));
  controls.update();
}

function handleWheel(event) {
  if (!sliceCount) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (event.ctrlKey || event.metaKey) {
    if (cameraMode === 'auto') {
      state.zoomOffsetTarget = clamp(state.zoomOffsetTarget + event.deltaY * 0.008, -2.2, 5.5);
    } else {
      dollyUserCamera(event.deltaY);
    }
    return;
  }
  const now = performance.now();
  if (now - lastWheelStepAt < 34) return;
  lastWheelStepAt = now;
  stepShuttle(Math.sign(event.deltaY) || 1, event.shiftKey ? 5 : 1);
}

function handleKeydown(event) {
  if (!sliceCount) return;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    stepShuttle(1, event.shiftKey ? 5 : 1);
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    stepShuttle(-1, event.shiftKey ? 5 : 1);
  } else if (event.key === 'Home') {
    jumpToFrame(0);
  } else if (event.key === 'End') {
    jumpToFrame(sliceCount - 1);
  } else if (event.key.toLowerCase() === 'e') {
    state.spreadTarget = state.spreadTarget >= 0.5 ? 0 : 1;
    syncExpandButton();
  } else if (event.key.toLowerCase() === 'r') {
    resetCameraView();
  } else if (event.code === 'Space') {
    startPlayback(1);
  } else {
    return;
  }
  event.preventDefault();
}

function resize() {
  const { clientWidth, clientHeight } = canvas;
  if (!clientWidth || !clientHeight) return;
  renderer.setSize(clientWidth, clientHeight, false);
  camera.aspect = clientWidth / clientHeight;
  camera.updateProjectionMatrix();
}

function bindEvents() {
  canvas.addEventListener('pointerdown', beginPointer, { capture: true });
  canvas.addEventListener('pointermove', movePointer, { capture: true });
  canvas.addEventListener('pointerup', endPointer, { capture: true });
  canvas.addEventListener('pointercancel', endPointer, { capture: true });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('wheel', handleWheel, { capture: true, passive: false });
  canvas.addEventListener('keydown', handleKeydown);
  window.addEventListener('resize', resize);

  playButtons.forEach((button) => {
    button.addEventListener('click', () => startPlayback(Number(button.dataset.playbackDirection)));
  });
  jumpStartButton.addEventListener('click', () => jumpToFrame(0));
  jumpEndButton.addEventListener('click', () => jumpToFrame(sliceCount - 1));
  resetViewButton.addEventListener('click', () => {
    resetCameraView();
    canvas.focus({ preventScroll: true });
  });
  expandButton.addEventListener('click', () => {
    state.spreadTarget = state.spreadTarget >= 0.5 ? 0 : 1;
    syncExpandButton();
    canvas.focus({ preventScroll: true });
  });
}

function animate() {
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;
  updatePlayback(delta);
  if (sliceCount) updateTimeline(delta);
  updateAtmosphere(elapsed);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

async function initialise() {
  try {
    setLoading(0.02, '读取逐帧清单');
    const response = await fetch('/assets/slice-manifest.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`清单请求失败：${response.status}`);
    const manifest = await response.json();
    if (
      !Number.isInteger(manifest.count)
      || manifest.count < 2
      || manifest.sampleMode !== 'every-integer-frame'
      || manifest.view !== 'fixed-top-front'
      || manifest.timelineAxis !== 'y'
    ) {
      throw new Error('时间切片清单不是固定 X-Y 正视的逐帧水平轨道');
    }
    sliceCount = manifest.count;
    frameCounter.textContent = `FRAME 001 / ${String(sliceCount).padStart(3, '0')}`;
    setLoading(0.08, `确认 ${sliceCount} 张静态逐帧切片`);
    const textures = await loadTextures(sliceCount);
    setLoading(0.94, '将每张纹理永久绑定到独立平面');
    createSlices(textures);
    const preview = new URLSearchParams(window.location.search);
    const previewFrame = Number(preview.get('frame'));
    const previewSpread = Number(preview.get('spread'));
    const previewYaw = Number(preview.get('yaw'));
    if (Number.isFinite(previewFrame) && previewFrame >= 1) {
      state.shuttle = clamp(previewFrame - 1, 0, sliceCount - 1);
      state.shuttleTarget = state.shuttle;
    }
    if (Number.isFinite(previewSpread)) {
      state.spread = clamp(previewSpread, 0, 1);
      state.spreadTarget = state.spread;
      syncExpandButton();
    }
    if (Number.isFinite(previewYaw)) {
      state.previewTilt = clamp(THREE.MathUtils.degToRad(previewYaw), -THREE.MathUtils.degToRad(82), THREE.MathUtils.degToRad(82));
    }
    const { focusY, overviewBlend } = getCameraLayout();
    applyAutomaticCamera(focusY, overviewBlend, 0, true);
    lastFocusY = focusY;
    hasCameraState = true;
    setLoading(1, '真实时间轨道已就绪');
    loadingPanel.classList.add('is-complete');
    window.setTimeout(() => { loadingPanel.hidden = true; }, 700);
    canvas.focus({ preventScroll: true });
  } catch (error) {
    console.error(error);
    loadingPanel.classList.add('is-error');
    loadingPercent.textContent = 'ERROR';
    loadingBarFill.style.width = '100%';
    loadingDetail.textContent = error instanceof Error ? error.message : '时间切片载入失败';
    setStageStatus('载入失败');
  }
}

createAtmosphere();
createRail();
bindEvents();
resize();
syncPlaybackButtons();
syncExpandButton();
animate();
initialise();
