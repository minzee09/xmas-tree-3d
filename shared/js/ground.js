// Snowy ground and the decorative presents under the tree (tap one to open it).
import { GROUND_Y } from './config.js';
import { scene, uniforms } from './stage.js';
import { makeGift } from './gift.js';
import { burst } from './burst.js';
import { triggerWave } from './wave.js';
import { Music } from './music.js';

const THREE = window.THREE;

// ---------- ground ----------
(function buildGround() {
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: uniforms.uTime },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      varying vec2 vUv; uniform float uTime;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        float d = length(vUv - 0.5) * 2.0;
        vec3 snow = mix(vec3(0.17, 0.21, 0.27), vec3(0.03, 0.06, 0.10), smoothstep(0.0, 0.8, d));
        vec3 warmPool = vec3(1.0, 0.62, 0.3) * 0.12 * (1.0 - smoothstep(0.0, 0.3, d));
        vec2 cell = floor(vUv * 220.0);
        float sparkle = step(0.996, hash(cell)) * (0.5 + 0.5 * sin(uTime * 3.0 + hash(cell + 3.1) * 40.0));
        gl_FragColor = vec4(snow + warmPool + sparkle * 0.9, 1.0 - smoothstep(0.55, 1.0, d));
      }`,
  });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(14, 64), material);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = GROUND_Y;
  scene.add(ground);
})();

// ---------- decorative presents ----------
const DEFS = [
  { x: 1.7, z: 1.2, w: 0.9, h: 0.7, d: 0.8, color: 0xc8324a, ribbon: 0xf3c25b, rot: 0.4 },
  { x: -1.6, z: 1.4, w: 0.7, h: 0.55, d: 0.7, color: 0x2e7d5b, ribbon: 0xeef3f6, rot: -0.3 },
  { x: 0.4, z: 2.1, w: 0.6, h: 0.45, d: 0.6, color: 0xf3c25b, ribbon: 0xc8324a, rot: 0.9 },
  { x: -0.9, z: -1.9, w: 1.0, h: 0.6, d: 0.7, color: 0x3a5fa8, ribbon: 0xf3c25b, rot: 0.2 },
  { x: 2.0, z: -1.0, w: 0.55, h: 0.8, d: 0.55, color: 0xe6e9ef, ribbon: 0xc8324a, rot: -0.6 },
];

const presents = DEFS.map((def, i) => {
  const gift = makeGift(def);
  gift.group.position.set(def.x, GROUND_Y, def.z);
  gift.group.rotation.y = def.rot;
  gift.meshes.forEach((m) => { m.userData.present = i; });
  scene.add(gift.group);
  return { ...gift, def, openedAt: -1, spinX: 0, spinY: 0 };
});
const presentMeshes = presents.flatMap((p) => p.meshes);

let hidden = false;

/** Shrink the presents away (during the gift draw, so they are not mistaken for draw gifts). */
export const setPresentsHidden = (v) => { hidden = v; };

/** Index of the present under the ray, or -1. */
export function pickPresent(ray) {
  if (hidden) return -1;
  const hit = ray.intersectObjects(presentMeshes, false)[0];
  return hit ? hit.object.userData.present : -1;
}

const at = new THREE.Vector3();

/** Lid pops, confetti fountain, light wave up the tree. */
export function openPresent(i) {
  const p = presents[i];
  const now = performance.now();
  if (p.openedAt >= 0 && now - p.openedAt < 1300) return;
  p.openedAt = now;
  p.spinY = (Math.random() < 0.5 ? -1 : 1) * Math.PI * 2;
  p.spinX = (Math.random() - 0.5) * 1.2;
  p.glow.getWorldPosition(at);
  burst(at.clone(), [p.def.color, p.def.ribbon, 0xffd98a, 0xffffff, 0xff8fb1], 260, 2.6, 6.5);
  triggerWave(250);
  Music.chime();
}

export function updatePresents(now, dt) {
  const want = hidden ? 0 : 1;
  for (const p of presents) {
    const s = p.group.scale.x + (want - p.group.scale.x) * Math.min(1, dt * 6);
    p.group.scale.setScalar(Math.max(0.001, s));
    p.group.visible = s > 0.02;

    if (p.openedAt < 0) continue;
    const e = (now - p.openedAt) / 1000;
    const T = 1.05, vy = 4.9, G = (2 * vy) / T;
    // body squashes as the lid leaves
    const sq = e < 0.18 ? Math.sin((e / 0.18) * Math.PI) : 0;
    p.body.scale.set(1 + sq * 0.12, 1 - sq * 0.2, 1 + sq * 0.12);
    p.body.position.y = (p.bodyH / 2) * (1 - sq * 0.2);
    // lid: straight up with a full spin, back down, small bounce
    let y = 0, rx = 0, ry = 0;
    if (e < T) {
      y = vy * e - 0.5 * G * e * e;
      const k = e / T;
      ry = p.spinY * k * k * (3 - 2 * k);
      rx = Math.sin(k * Math.PI) * p.spinX;
    } else if (e < T + 0.3) {
      y = 0.07 * Math.sin(((e - T) / 0.3) * Math.PI);
    } else {
      p.openedAt = -1;
    }
    p.lid.position.y = p.lidRestY + y;
    p.lid.rotation.set(rx, ry, 0);
    const open = e < T ? Math.sin(Math.min(1, e / T) * Math.PI) : 0;
    p.glow.material.opacity = open * 0.95;
    p.bodyMat.emissiveIntensity = open * 0.35;
  }
}
