// Renderer, scene, camera, lights and the bloom post-processing pass.
import { isSmall, NARROW_PX, reduceMotion } from './config.js';

const THREE = window.THREE;

export const canvas = document.getElementById('scene');
export const DPR = Math.min(window.devicePixelRatio || 1, isSmall ? 1.5 : 1.75);

export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(DPR);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x050b12, 1);

export const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050b12, 0.03);

export const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 200);

export const controls = new THREE.OrbitControls(camera, canvas);
Object.assign(controls, {
  enableDamping: true,
  dampingFactor: 0.06,
  enablePan: false,
  minDistance: 7,
  maxDistance: 26,
  maxPolarAngle: Math.PI * 0.56,
  minPolarAngle: Math.PI * 0.18,
  rotateSpeed: 0.6,
});

/** Uniforms shared by every particle shader. */
export const uniforms = {
  uTime: { value: 0 },
  uPixelRatio: { value: DPR },
  uReveal: { value: reduceMotion ? 1.4 : 0 }, // grows the tree in from the bottom on load
  uWave: { value: -1 },                       // height (0..1) of the light wave, -1 = off
};

// Lights
scene.add(new THREE.HemisphereLight(0x9fc6ff, 0x1a120a, 0.45));
export const warmLight = new THREE.PointLight(0xffb36b, 1.6, 22, 1.6);
warmLight.position.set(2.5, 3.5, 4);
scene.add(warmLight);
const rim = new THREE.DirectionalLight(0x8fb4ff, 0.5);
rim.position.set(-6, 8, -6);
scene.add(rim);

/** Soft round sprite used for every glow. */
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
export const GLOW = glowTexture();

/** Additive glow sprite. */
export function glowSprite(color, opacity = 1) {
  return new THREE.Sprite(new THREE.SpriteMaterial({
    map: GLOW, color, opacity, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
}

// Post-processing
const composer = new THREE.EffectComposer(renderer);
composer.setPixelRatio(DPR);
composer.addPass(new THREE.RenderPass(scene, camera));
const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.8, 0.5, 0.22);
composer.addPass(bloom);

/**
 * 'full'  — tree centered.
 * 'panel' — leave room for a side panel on wide screens and a bottom sheet on phones.
 */
let layout = 'full';
let placed = false;

function frameCamera() {
  const w = window.innerWidth, h = window.innerHeight;
  const narrow = w < NARROW_PX;
  camera.aspect = w / h;
  controls.target.set(0, narrow ? 4.4 : 4.1, 0);
  if (!placed) {
    camera.position.set(0, narrow ? 6.0 : 5.4, narrow ? 18.5 : 15);
    placed = true;
  }
  const offX = layout === 'panel' && !narrow ? 190 : 0;
  const offY = layout === 'panel' && narrow ? Math.round(h * 0.05) : 0;
  camera.setViewOffset(w, h, offX, offY, w, h);
  camera.updateProjectionMatrix();
}

export function setLayout(next) {
  layout = next;
  frameCamera();
}

window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloom.setSize(w, h);
  frameCamera();
});
frameCamera();

// Camera shake (used on a big win)
let shakeAmount = 0;
export function shake(amount) {
  shakeAmount = Math.max(shakeAmount, amount);
}

const saved = new THREE.Vector3();
export function render(dt) {
  shakeAmount = Math.max(0, shakeAmount - dt * 2.5);
  const shaking = shakeAmount > 0 && !reduceMotion;
  if (shaking) {
    saved.copy(camera.position);
    camera.position.x += (Math.random() - 0.5) * shakeAmount * 0.35;
    camera.position.y += (Math.random() - 0.5) * shakeAmount * 0.35;
  }
  composer.render();
  if (shaking) camera.position.copy(saved);
}
