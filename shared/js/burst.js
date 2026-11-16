// Pooled particle bursts: fireworks, confetti fountains, snow puffs.
import { scene, uniforms } from './stage.js';

const THREE = window.THREE;
const MAX = 3000;

const pos = new Float32Array(MAX * 3), col = new Float32Array(MAX * 3);
const alpha = new Float32Array(MAX), size = new Float32Array(MAX);
const vel = new Float32Array(MAX * 3), life = new Float32Array(MAX), maxLife = new Float32Array(MAX);
let cursor = 0;

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
geometry.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
geometry.setAttribute('aSize', new THREE.BufferAttribute(size, 1));

const material = new THREE.ShaderMaterial({
  uniforms: { uPixelRatio: uniforms.uPixelRatio },
  vertexShader: `
    attribute vec3 aColor; attribute float aAlpha; attribute float aSize; uniform float uPixelRatio;
    varying vec3 vC; varying float vA;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = aSize * uPixelRatio * (30.0 / -mv.z);
      vC = aColor; vA = aAlpha;
    }`,
  fragmentShader: `
    varying vec3 vC; varying float vA;
    void main(){
      float a = pow(smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)), 1.8);
      gl_FragColor = vec4(vC * 1.6, a * vA);
    }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});

const cloud = new THREE.Points(geometry, material);
cloud.frustumCulled = false;
scene.add(cloud);

const tmp = new THREE.Color();

/**
 * Emit `count` particles at `at`.
 * lift = 0 → spherical burst (firework); lift > 0 → upward fountain (confetti).
 */
export function burst(at, colors, count = 160, power = 3.2, lift = 0) {
  for (let n = 0; n < count; n++) {
    const i = cursor;
    cursor = (cursor + 1) % MAX;
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const sp = power * (0.55 + Math.random() * 0.45);
    if (lift) {
      vel.set([s * Math.cos(th) * sp * 0.5, lift * (0.55 + 0.6 * Math.random()), s * Math.sin(th) * sp * 0.5], i * 3);
    } else {
      vel.set([s * Math.cos(th) * sp, u * sp + 0.6, s * Math.sin(th) * sp], i * 3);
    }
    pos.set([at.x, at.y, at.z], i * 3);
    tmp.set(colors[(Math.random() * colors.length) | 0]);
    col.set([tmp.r, tmp.g, tmp.b], i * 3);
    maxLife[i] = life[i] = 1.1 + Math.random() * 0.9;
    size[i] = lift ? 3.5 + Math.random() * 3.5 : 2.5 + Math.random() * 3;
  }
}

export function updateBursts(dt) {
  let dirty = false;
  const drag = Math.pow(0.12, dt);
  for (let i = 0; i < MAX; i++) {
    if (life[i] <= 0) {
      if (alpha[i] !== 0) { alpha[i] = 0; dirty = true; }
      continue;
    }
    dirty = true;
    life[i] -= dt;
    const j = i * 3;
    vel[j] *= drag; vel[j + 1] = vel[j + 1] * drag - 2.2 * dt; vel[j + 2] *= drag;
    pos[j] += vel[j] * dt; pos[j + 1] += vel[j + 1] * dt; pos[j + 2] += vel[j + 2] * dt;
    alpha[i] = Math.max(0, life[i] / maxLife[i]) * (0.7 + 0.3 * Math.sin(life[i] * 40));
  }
  if (dirty) {
    for (const name of ['position', 'aAlpha', 'aColor', 'aSize']) geometry.attributes[name].needsUpdate = true;
  }
}
