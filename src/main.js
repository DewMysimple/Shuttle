import * as THREE from 'three';
import './style.css';

const FRAME_URL = (index) => `/assets/slices/frame-${String(index + 1).padStart(3, '0')}.png`;
const INITIAL_SPREAD = 0.72;
const CARD_WIDTH = 2.15;
const CARD_HEIGHT = 1.72;
const IMAGE_WIDTH = 1.92;
const IMAGE_HEIGHT = 1.54;
const SLICE_DEPTH_STEP = 1;
const DRAG_DEADZONE = 8;
const LONG_PRESS_DELAY = 260;
const PLAYBACK_FPS = 30;
const YAW_PER_VIEWPORT = Math.PI * 2.2;
const PITCH_PER_VIEWPORT = THREE.MathUtils.degToRad(120);
const PITCH_LIMIT = THREE.MathUtils.degToRad(90);
const ROTATION_DRAG_SMOOTHING = 18;
const ROTATION_RELEASE_SMOOTHING = 10;
const CAMERA_ZOOM_SMOOTHING = 11;
const CAMERA_ZOOM_SENSITIVITY = 0.011;
const CAMERA_MIN_DISTANCE = 3;
const CAMERA_MAX_DISTANCE = 15.5;
const FOCUS_GLOW_BASE = 0.074;
const FOCUS_GLOW_BREATH = 0.018;
const FOCUS_GLOW_CYCLE = 1.7;
const FOCUS_TRAIL_COUNT = 5;
const FOCUS_TRAIL_FRAME_STEP = 3;
const FOCUS_TRAIL_SPACING = 0.055;
const PLAYBACK_BLEND_SMOOTHING = 9;

const canvas = document.querySelector('#scene');
const stage = document.querySelector('.slice-stage');
const frameCounter = document.querySelector('#frame-counter');
const stageStatus = document.querySelector('#stage-status');
const loadingPanel = document.querySelector('#loading-panel');
const loadingPercent = document.querySelector('#loading-percent');
const loadingBarFill = document.querySelector('#loading-bar-fill');
const loadingDetail = document.querySelector('#loading-detail');
const expandButton = document.querySelector('#expand-button');
const playButtons = [...document.querySelectorAll('[data-playback-direction]')];
const jumpStartButton = document.querySelector('#jump-start');
const jumpEndButton = document.querySelector('#jump-end');

const state = {
  frameFloat: 0,
  spread: INITIAL_SPREAD,
  spreadTarget: INITIAL_SPREAD,
  yaw: 0,
  yawTarget: 0,
  pitch: 0.08,
  pitchTarget: 0.08,
  isDragging: false,
  isPlaying: false,
  playbackDirection: 1,
};

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmallViewport = window.matchMedia('(max-width: 700px)').matches;
const clock = new THREE.Clock();
let animationTime = 0;
const pointer = {
  active: false,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
  lastX: 0,
  lastY: 0,
  moved: false,
  longPressReady: false,
  longPressTimer: 0,
};

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 100);
const defaultCameraDistance = isSmallViewport ? 10.2 : 8.7;
const cameraZoom = {
  current: defaultCameraDistance,
  target: defaultCameraDistance,
};
const cameraFocusPoint = new THREE.Vector3(0, 0.5, 0);
camera.position.set(0, 1.25, defaultCameraDistance);
camera.lookAt(0, 0.5, 0);

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

const atmosphereRoot = new THREE.Group();
const atmosphereParticles = [];
const atmosphereRings = [];
const atmosphereHalos = [];
scene.add(atmosphereRoot);

const timeline = new THREE.Group();
const sliceRoot = new THREE.Group();
sliceRoot.scale.setScalar(isSmallViewport ? 0.78 : 1);
timeline.add(sliceRoot);
const rotationRig = new THREE.Group();
rotationRig.add(timeline);
scene.add(rotationRig);

const slices = [];
const focusLayer = new THREE.Group();
const focusTrail = new THREE.Group();
const focusObjects = {
  image: null,
  nextImage: null,
  glow: null,
  nextGlow: null,
};
const focusTrailPlanes = [];
let sliceCount = 0;
let sliceTextures = [];
let focusReady = false;
let playbackBlend = 0;
let lastDisplayedFrame = -1;
let lastStatus = '';

sliceRoot.add(focusLayer);

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

function syncPlaybackButtons() {
  stage.classList.toggle('is-playing', state.isPlaying || playbackBlend > 0.02);
  playButtons.forEach((button) => {
    const isActive = state.isPlaying
      && Number(button.dataset.playbackDirection) === state.playbackDirection;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function createAtmosphere() {
  const particleCount = isSmallViewport ? 28 : 64;
  const positions = new Float32Array(particleCount * 3);
  const seeds = new Float32Array(particleCount);

  for (let index = 0; index < particleCount; index += 1) {
    const offset = index * 3;
    positions[offset] = (Math.random() - 0.5) * 9;
    positions[offset + 1] = Math.random() * 5 - 1.4;
    positions[offset + 2] = (Math.random() - 0.5) * 3.4 - 0.7;
    seeds[index] = Math.random() * Math.PI * 2;
  }

  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particleMaterial = new THREE.PointsMaterial({
    color: 0xfff0d4,
    size: isSmallViewport ? 0.055 : 0.075,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const particleField = new THREE.Points(particleGeometry, particleMaterial);
  particleField.userData = {
    basePositions: positions.slice(),
    seeds,
  };
  atmosphereRoot.add(particleField);
  atmosphereParticles.push(particleField);

  [
    { radius: 1.9, color: 0xffc7de, opacity: 0.14, spin: 0.09, tilt: 0.24 },
    { radius: 2.65, color: 0xd6c6ff, opacity: 0.1, spin: -0.065, tilt: -0.32 },
    { radius: 3.35, color: 0xffe4b4, opacity: 0.075, spin: 0.045, tilt: 0.52 },
  ].forEach((config, index) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(config.radius, isSmallViewport ? 0.008 : 0.014, 8, 128),
      new THREE.MeshBasicMaterial({
        color: config.color,
        transparent: true,
        opacity: config.opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    ring.position.set(0, 0.48 + index * 0.08, -0.85);
    ring.rotation.set(config.tilt, index * 0.55, index * 0.3);
    ring.userData = { phase: index * 1.8, spin: config.spin, baseScale: 1 };
    atmosphereRoot.add(ring);
    atmosphereRings.push(ring);
  });

  [
    { size: 2.6, color: 0xffd2c3, opacity: 0.04 },
    { size: 4.4, color: 0xd9c2f0, opacity: 0.028 },
  ].forEach((config, index) => {
    const halo = new THREE.Mesh(
      new THREE.CircleGeometry(config.size, 64),
      new THREE.MeshBasicMaterial({
        color: config.color,
        transparent: true,
        opacity: config.opacity,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    halo.position.set(0, 0.42, -1.1 - index * 0.12);
    halo.userData = { phase: index * 1.6, baseScale: 1 };
    atmosphereRoot.add(halo);
    atmosphereHalos.push(halo);
  });
}

function updateAtmosphere(elapsed) {
  if (prefersReducedMotion) return;

  atmosphereRoot.rotation.y = Math.sin(elapsed * 0.12) * 0.025;
  atmosphereRoot.rotation.x = Math.cos(elapsed * 0.18) * 0.018;

  atmosphereParticles.forEach((particleField) => {
    const { basePositions, seeds } = particleField.userData;
    const positions = particleField.geometry.attributes.position.array;

    for (let index = 0; index < seeds.length; index += 1) {
      const offset = index * 3;
      const seed = seeds[index];
      positions[offset] = basePositions[offset] + Math.sin(elapsed * 0.16 + seed) * 0.18;
      positions[offset + 1] = basePositions[offset + 1] + Math.sin(elapsed * 0.3 + seed * 1.7) * 0.24;
      positions[offset + 2] = basePositions[offset + 2] + Math.cos(elapsed * 0.21 + seed) * 0.12;
    }

    particleField.geometry.attributes.position.needsUpdate = true;
    particleField.material.opacity = 0.17 + Math.sin(elapsed * 0.55) * 0.035;
  });

  atmosphereRings.forEach((ring) => {
    const { phase, spin } = ring.userData;
    ring.rotation.x += Math.sin(elapsed * 0.23 + phase) * 0.0008;
    ring.rotation.y += spin * 0.002;
    ring.rotation.z = Math.sin(elapsed * 0.17 + phase) * 0.07;
    ring.scale.setScalar(1 + Math.sin(elapsed * 0.5 + phase) * 0.025);
    ring.material.opacity = 0.055 + Math.sin(elapsed * 0.7 + phase) * 0.018;
  });

  atmosphereHalos.forEach((halo) => {
    const { phase } = halo.userData;
    halo.scale.setScalar(1 + Math.sin(elapsed * 0.32 + phase) * 0.045);
    halo.material.opacity = 0.028 + Math.sin(elapsed * 0.48 + phase) * 0.009;
  });
}

function createGradedImageMaterial(texture, opacity = 0) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);

  const imageMaterial = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  imageMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.sliceSaturation = { value: 1.12 };
    shader.uniforms.sliceContrast = { value: 1.04 };
    shader.uniforms.sliceWarmth = { value: 0 };
    imageMaterial.userData.shader = shader;
    shader.fragmentShader = shader.fragmentShader.replace(
      'void main() {',
      `uniform float sliceSaturation;
uniform float sliceContrast;
uniform float sliceWarmth;

void main() {`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      'vec3 outgoingLight = reflectedLight.indirectDiffuse;',
      `vec3 outgoingLight = reflectedLight.indirectDiffuse;
  float sliceLuminance = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
  outgoingLight = mix(vec3(sliceLuminance), outgoingLight, sliceSaturation);
  outgoingLight = (outgoingLight - 0.5) * sliceContrast + 0.5;
  vec3 coralLift = outgoingLight * vec3(1.14, 0.88, 0.93);
  outgoingLight = mix(outgoingLight, coralLift, sliceWarmth);`,
    );
  };
  return imageMaterial;
}

function createSlice(texture, index) {
  const group = new THREE.Group();
  const cardMaterial = new THREE.MeshBasicMaterial({
    color: index % 3 === 0 ? 0xffb6bd : index % 3 === 1 ? 0xc8b4f2 : 0xffd38f,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const card = new THREE.Mesh(roundedRectGeometry(CARD_WIDTH, CARD_HEIGHT, 0.1), cardMaterial);
  card.position.z = -0.06;
  card.renderOrder = 10;

  const outlineMaterial = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
  });
  const outline = new THREE.LineSegments(new THREE.EdgesGeometry(card.geometry), outlineMaterial);
  outline.position.z = -0.03;
  outline.renderOrder = 12;

  const imageMaterial = createGradedImageMaterial(texture);
  const image = new THREE.Mesh(new THREE.PlaneGeometry(IMAGE_WIDTH, IMAGE_HEIGHT), imageMaterial);
  image.position.z = 0.02;
  image.renderOrder = 11;

  const glowMaterial = new THREE.MeshBasicMaterial({
    map: texture,
    color: 0xff5f70,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(IMAGE_WIDTH, IMAGE_HEIGHT), glowMaterial);
  glow.position.z = 0.006;
  glow.renderOrder = 10.5;

  group.add(card, glow, outline, image);
  group.position.y = 0.08;
  group.userData = { index, card, glow, outline, image };
  sliceRoot.add(group);
  slices.push(group);
}

function createFocusLayer() {
  if (focusReady || sliceTextures.length === 0) return;

  const focusImage = new THREE.Mesh(
    new THREE.PlaneGeometry(IMAGE_WIDTH, IMAGE_HEIGHT),
    createGradedImageMaterial(sliceTextures[0]),
  );
  focusImage.position.z = 0.16;
  focusImage.renderOrder = 42;

  const nextFocusImage = new THREE.Mesh(
    new THREE.PlaneGeometry(IMAGE_WIDTH, IMAGE_HEIGHT),
    createGradedImageMaterial(sliceTextures[0]),
  );
  nextFocusImage.position.z = 0.15;
  nextFocusImage.renderOrder = 41;

  const focusGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(IMAGE_WIDTH, IMAGE_HEIGHT),
    new THREE.MeshBasicMaterial({
      map: sliceTextures[0],
      color: 0xff5f70,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  focusGlow.position.z = 0.1;
  focusGlow.renderOrder = 40;

  const nextFocusGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(IMAGE_WIDTH, IMAGE_HEIGHT),
    new THREE.MeshBasicMaterial({
      map: sliceTextures[0],
      color: 0xff5f70,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  nextFocusGlow.position.z = 0.09;
  nextFocusGlow.renderOrder = 39;

  focusTrailPlanes.push(
    ...Array.from({ length: FOCUS_TRAIL_COUNT }, (_, index) => {
      const trail = new THREE.Mesh(
        new THREE.PlaneGeometry(IMAGE_WIDTH, IMAGE_HEIGHT),
        new THREE.MeshBasicMaterial({
          map: sliceTextures[0],
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: THREE.DoubleSide,
          toneMapped: false,
        }),
      );
      trail.position.z = 0.04 - index * 0.004;
      trail.renderOrder = 30 + index;
      focusTrail.add(trail);
      return trail;
    }),
  );

  focusObjects.image = focusImage;
  focusObjects.nextImage = nextFocusImage;
  focusObjects.glow = focusGlow;
  focusObjects.nextGlow = nextFocusGlow;
  focusLayer.add(focusTrail, nextFocusGlow, focusGlow, nextFocusImage, focusImage);
  focusLayer.visible = true;
  focusReady = true;
}

async function loadSlices() {
  const manifestResponse = await fetch('/assets/slice-manifest.json');
  if (!manifestResponse.ok) {
    throw new Error(`Unable to load slice manifest: ${manifestResponse.status}`);
  }

  const manifest = await manifestResponse.json();
  const manifestFrames = Array.isArray(manifest.frames) ? manifest.frames : [];
  if (!Number.isInteger(manifest.count) || manifest.count < 1 || manifestFrames.length !== manifest.count) {
    throw new Error('Slice manifest count does not match its frame list');
  }

  sliceCount = manifest.count;
  frameCounter.textContent = `FRAME 01 / ${sliceCount}`;

  const loader = new THREE.TextureLoader();
  let loaded = 0;
  const textures = await Promise.all(
    Array.from({ length: sliceCount }, async (_, index) => {
      const texture = await loader.loadAsync(FRAME_URL(index));
      loaded += 1;
      setLoading(0.12 + (loaded / sliceCount) * 0.82, `载入时间切片 ${loaded} / ${sliceCount}`);
      return texture;
    }),
  );

  sliceTextures = textures;
  textures.forEach(createSlice);
  createFocusLayer();
}

function updatePlayback(delta) {
  if (!state.isPlaying || sliceCount < 2) return;

  state.frameFloat += delta * PLAYBACK_FPS * state.playbackDirection;
  const reachedEnd = state.playbackDirection > 0
    ? state.frameFloat >= sliceCount - 1
    : state.frameFloat <= 0;
  if (!reachedEnd) return;

  state.frameFloat = state.playbackDirection > 0 ? sliceCount - 1 : 0;
  state.isPlaying = false;
  syncPlaybackButtons();
  setStageStatus(state.playbackDirection > 0 ? '正向播放结束' : '倒放结束');
}

function updateCamera(delta, elapsed) {
  cameraZoom.current = damp(cameraZoom.current, cameraZoom.target, CAMERA_ZOOM_SMOOTHING, delta);
  camera.position.z = cameraZoom.current;

  const focusDrift = prefersReducedMotion ? 0 : state.spread;
  cameraFocusPoint.set(
    Math.sin(elapsed * 0.56) * 0.008 * focusDrift,
    0.5 + Math.sin(elapsed * 0.78) * 0.018 * focusDrift,
    0,
  );
  sliceRoot.localToWorld(cameraFocusPoint);
  camera.lookAt(cameraFocusPoint);
}

function updateRotation(delta) {
  const smoothing = state.isDragging ? ROTATION_DRAG_SMOOTHING : ROTATION_RELEASE_SMOOTHING;
  state.yaw = damp(state.yaw, state.yawTarget, smoothing, delta);
  state.pitch = damp(state.pitch, state.pitchTarget, smoothing, delta);

  rotationRig.rotation.y = state.yaw;
  rotationRig.rotation.x = state.pitch;
}

function updateGradedMaterial(material, saturation, contrast, warmth) {
  const shader = material.userData.shader;
  if (!shader) return;
  shader.uniforms.sliceSaturation.value = saturation;
  shader.uniforms.sliceContrast.value = contrast;
  shader.uniforms.sliceWarmth.value = warmth;
}

function updateFocus(delta, elapsed) {
  if (!focusReady || sliceCount < 1) return;

  playbackBlend = damp(
    playbackBlend,
    state.isPlaying ? 1 : 0,
    PLAYBACK_BLEND_SMOOTHING,
    delta,
  );
  stage.classList.toggle('is-playing', state.isPlaying || playbackBlend > 0.02);

  const frameFloat = clamp(state.frameFloat, 0, sliceCount - 1);
  const currentIndex = Math.floor(frameFloat);
  const nextIndex = Math.min(currentIndex + 1, sliceCount - 1);
  const interpolation = frameFloat - currentIndex;
  const focusSaturation = 1.9;
  const focusContrast = 1.29;
  const focusWarmth = 0.28;

  focusObjects.image.material.map = sliceTextures[currentIndex];
  focusObjects.nextImage.material.map = sliceTextures[nextIndex];
  focusObjects.glow.material.map = sliceTextures[currentIndex];
  focusObjects.nextGlow.material.map = sliceTextures[nextIndex];

  focusObjects.image.material.opacity = 0.99 * (1 - interpolation);
  focusObjects.nextImage.material.opacity = nextIndex === currentIndex ? 0 : 0.99 * interpolation;
  const glowPulse = prefersReducedMotion
    ? FOCUS_GLOW_BASE
    : FOCUS_GLOW_BASE
      + Math.sin((elapsed / FOCUS_GLOW_CYCLE) * Math.PI * 2) * FOCUS_GLOW_BREATH;
  focusObjects.glow.material.opacity = glowPulse * (1 - interpolation);
  focusObjects.nextGlow.material.opacity = nextIndex === currentIndex
    ? 0
    : glowPulse * interpolation;

  updateGradedMaterial(focusObjects.image.material, focusSaturation, focusContrast, focusWarmth);
  updateGradedMaterial(focusObjects.nextImage.material, focusSaturation, focusContrast, focusWarmth);
  focusObjects.image.scale.setScalar(1.03 + playbackBlend * 0.02);
  focusObjects.nextImage.scale.setScalar(1.03 + playbackBlend * 0.02);
  focusObjects.glow.scale.setScalar(1.04 + playbackBlend * 0.025);
  focusObjects.nextGlow.scale.copy(focusObjects.glow.scale);

  const trailOpacity = [0.11, 0.075, 0.05, 0.032, 0.02];
  const trailVisibility = prefersReducedMotion ? 0 : playbackBlend;
  focusTrailPlanes.forEach((trail, index) => {
    const trailFrame = clamp(
      Math.round(frameFloat - state.playbackDirection * (index + 1) * FOCUS_TRAIL_FRAME_STEP),
      0,
      sliceCount - 1,
    );
    trail.material.map = sliceTextures[trailFrame];
    trail.material.opacity = trailVisibility * trailOpacity[index];
    trail.position.x = -state.playbackDirection * (index + 1) * FOCUS_TRAIL_SPACING * trailVisibility;
    trail.position.y = ((index % 2 === 0 ? 1 : -1) * (index + 1) * 0.012) * trailVisibility;
    trail.scale.setScalar(0.98 - index * 0.028);
  });
}

function updateSlices(delta, elapsed) {
  state.spread = damp(state.spread, state.spreadTarget, 7, delta);
  sliceRoot.position.y = prefersReducedMotion ? 0 : Math.sin(elapsed * 1.15) * 0.022;
  const reveal = smoothstep(0.025, 0.2, state.spread);
  const sideView = smoothstep(0.2, 0.86, Math.abs(Math.sin(state.yaw)));
  const timelineCenter = (sliceCount - 1) / 2;
  const timelineVisibility = reveal * (1 - playbackBlend * 0.78);
  slices.forEach((slice, index) => {
    const distance = Math.abs(index - timelineCenter);
    const timelineFade = Math.exp(-distance / 15);

    slice.visible = true;
    slice.position.set(0, 0, -(index - timelineCenter) * SLICE_DEPTH_STEP * state.spread);
    slice.rotation.set(0, 0, 0);

    slice.userData.card.material.opacity = timelineVisibility
      * (0.006 + sideView * 0.01 + timelineFade * 0.016);
    slice.userData.outline.material.opacity = timelineVisibility
      * (0.035 + sideView * 0.02 + timelineFade * 0.06);
    slice.userData.image.material.opacity = timelineVisibility * (0.002 + timelineFade * 0.05);
    slice.userData.glow.material.opacity = 0;
    updateGradedMaterial(
      slice.userData.image.material,
      1.04 + timelineFade * 0.1,
      1.02 + timelineFade * 0.08,
      timelineFade * 0.025,
    );
    slice.scale.setScalar(0.88 + timelineFade * 0.04);
  });

  const frame = Math.round(state.frameFloat) + 1;
  if (frame !== lastDisplayedFrame) {
    lastDisplayedFrame = frame;
    frameCounter.textContent = `FRAME ${String(frame).padStart(3, '0')} / ${sliceCount}`;
  }

  expandButton.setAttribute('aria-pressed', String(state.spreadTarget > 0.5));
  expandButton.textContent = state.spreadTarget > 0.5 ? '收拢切片' : '展开切片';
}

function updateInteraction() {
  const totalX = pointer.currentX - pointer.startX;
  const totalY = pointer.currentY - pointer.startY;

  if (!pointer.moved) {
    if (Math.hypot(totalX, totalY) < DRAG_DEADZONE) return;
    clearLongPressTimer();
    pointer.moved = true;
    pointer.lastX = pointer.currentX;
    pointer.lastY = pointer.currentY;
    return;
  }

  const deltaX = pointer.currentX - pointer.lastX;
  const deltaY = pointer.currentY - pointer.lastY;
  state.yawTarget += (deltaX / Math.max(window.innerWidth, 1)) * YAW_PER_VIEWPORT;
  state.pitchTarget = clamp(
    state.pitchTarget + (deltaY / Math.max(window.innerHeight, 1)) * PITCH_PER_VIEWPORT,
    -PITCH_LIMIT,
    PITCH_LIMIT,
  );
  pointer.lastX = pointer.currentX;
  pointer.lastY = pointer.currentY;
}

function clearLongPressTimer() {
  if (!pointer.longPressTimer) return;
  window.clearTimeout(pointer.longPressTimer);
  pointer.longPressTimer = 0;
}

function beginPlayback() {
  beginPlaybackInDirection(1);
}

function beginPlaybackInDirection(direction) {
  if (sliceCount < 2) return;
  state.playbackDirection = direction < 0 ? -1 : 1;
  if (state.playbackDirection > 0 && state.frameFloat >= sliceCount - 1) state.frameFloat = 0;
  if (state.playbackDirection < 0 && state.frameFloat <= 0) state.frameFloat = sliceCount - 1;
  state.isPlaying = true;
  state.isDragging = pointer.active;
  syncPlaybackButtons();
  setStageStatus(state.playbackDirection > 0 ? '正向播放' : '倒放');
}

function pausePlayback() {
  if (!state.isPlaying) return;
  state.isPlaying = false;
  syncPlaybackButtons();
  setStageStatus('已暂停');
}

function jumpToFrame(frameIndex, label) {
  if (sliceCount < 1) return;
  clearLongPressTimer();
  state.isPlaying = false;
  state.frameFloat = clamp(frameIndex, 0, sliceCount - 1);
  syncPlaybackButtons();
  setStageStatus(label);
  canvas.focus({ preventScroll: true });
}

function onPlaybackButtonClick(direction) {
  if (state.isPlaying && state.playbackDirection === direction) {
    pausePlayback();
    return;
  }
  beginPlaybackInDirection(direction);
}

function onPointerDown(event) {
  const canPlayOnHold = event.button === 0 || event.button === 2;
  pointer.active = true;
  pointer.startX = event.clientX;
  pointer.startY = event.clientY;
  pointer.currentX = event.clientX;
  pointer.currentY = event.clientY;
  pointer.lastX = event.clientX;
  pointer.lastY = event.clientY;
  pointer.moved = false;
  pointer.longPressReady = false;
  clearLongPressTimer();
  state.isDragging = true;
  if (event.button === 2) event.preventDefault();
  canvas.setPointerCapture(event.pointerId);
  if (canPlayOnHold) {
    pointer.longPressTimer = window.setTimeout(() => {
      pointer.longPressTimer = 0;
      if (!pointer.active || pointer.moved) return;
      pointer.longPressReady = true;
      beginPlaybackInDirection(event.button === 2 ? -1 : 1);
    }, LONG_PRESS_DELAY);
  }
}

function onPointerMove(event) {
  if (!pointer.active) return;
  pointer.currentX = event.clientX;
  pointer.currentY = event.clientY;
  updateInteraction();
}

function onPointerUp(event) {
  clearLongPressTimer();
  if (pointer.longPressReady) pausePlayback();
  pointer.active = false;
  pointer.moved = false;
  pointer.longPressReady = false;
  state.isDragging = false;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
}

function onWheel(event) {
  event.preventDefault();
  const modeMultiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
  const delta = clamp(event.deltaY * modeMultiplier, -240, 240);
  cameraZoom.target = clamp(
    cameraZoom.target + delta * CAMERA_ZOOM_SENSITIVITY,
    CAMERA_MIN_DISTANCE,
    CAMERA_MAX_DISTANCE,
  );
}

function toggleSpread() {
  state.spreadTarget = state.spreadTarget > 0.5 ? 0 : 1;
  canvas.focus({ preventScroll: true });
}

function onKeyDown(event) {
  if (event.key === ' ' || event.key === 'Spacebar') {
    event.preventDefault();
    if (!event.repeat) beginPlayback();
    return;
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    state.yawTarget += THREE.MathUtils.degToRad(10);
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    state.yawTarget -= THREE.MathUtils.degToRad(10);
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    state.pitchTarget = clamp(state.pitchTarget - THREE.MathUtils.degToRad(4), -PITCH_LIMIT, PITCH_LIMIT);
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    state.pitchTarget = clamp(state.pitchTarget + THREE.MathUtils.degToRad(4), -PITCH_LIMIT, PITCH_LIMIT);
  }
  if (event.key === 'Home') {
    event.preventDefault();
    state.spreadTarget = 0;
  }
  if (event.key === 'End') {
    event.preventDefault();
    state.spreadTarget = 1;
  }
  if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    state.yawTarget = 0;
    state.pitchTarget = 0.08;
  }
}

function onKeyUp(event) {
  if (event.key === ' ' || event.key === 'Spacebar') {
    event.preventDefault();
    pausePlayback();
  }
}

function onWindowBlur() {
  clearLongPressTimer();
  pausePlayback();
  pointer.active = false;
  pointer.moved = false;
  pointer.longPressReady = false;
  state.isDragging = false;
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
  createAtmosphere();
  window.addEventListener('resize', resize, { passive: true });
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('keydown', onKeyDown);
  canvas.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('blur', pausePlayback);
  window.addEventListener('blur', onWindowBlur);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  expandButton.addEventListener('click', toggleSpread);
  playButtons.forEach((button) => {
    button.addEventListener('click', () => {
      onPlaybackButtonClick(Number(button.dataset.playbackDirection));
    });
  });
  jumpStartButton.addEventListener('click', () => jumpToFrame(0, '已到开头'));
  jumpEndButton.addEventListener('click', () => jumpToFrame(sliceCount - 1, '已到结尾'));

  try {
    setStageStatus('载入切片');
    setLoading(0.08, '读取完整动画帧清单');
    await loadSlices();
    setStageStatus('交互就绪');
    setLoading(1, '完成');
    loadingPanel.classList.add('is-complete');
  } catch (error) {
    console.error(error);
    setStageStatus('资源缺失');
    loadingDetail.textContent = '请检查 public/assets/slices 与 slice-manifest.json，再刷新页面';
  }
}

function render() {
  const delta = Math.min(clock.getDelta(), 0.05);
  animationTime += delta;
  updatePlayback(delta);
  updateRotation(delta);
  updateFocus(delta, animationTime);
  updateSlices(delta, animationTime);
  updateCamera(delta, animationTime);
  updateAtmosphere(animationTime);
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

boot();
render();
