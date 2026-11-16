// The tree: particle foliage, chasing garland, rising dust, trunk, star and baubles.
import { TREE, coneR, isSmall, GARLAND_COLORS } from './config.js';
import { scene, uniforms, glowSprite } from './stage.js';

const THREE = window.THREE;
const { H, BASE_Y, R0 } = TREE;
const f2 = (n) => n.toFixed(2); // number → GLSL float literal

export const tree = new THREE.Group();
scene.add(tree);

/** Unit sphere shared by baubles and guestbook ornaments. */
export const baubleGeo = new THREE.SphereGeometry(1, 24, 16);

const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };

function points(attrs, material) {
  const g = new THREE.BufferGeometry();
  for (const [name, [array, size]] of Object.entries(attrs)) g.setAttribute(name, new THREE.BufferAttribute(array, size));
  return new THREE.Points(g, material);
}

// ---------- foliage: tiered cone of twinkling points ----------
(function buildFoliage() {
  const N = isSmall ? 6500 : 11000;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N), phase = new Float32Array(N);
  const greens = [0x1f8a52, 0x2fae6a, 0x167a4a, 0x4cc98a, 0x0f5f3c].map((h) => new THREE.Color(h));
  const tiers = 8;
  const c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const t = Math.pow(Math.random(), 0.85);
    const y = BASE_Y + t * H;
    const f = (t * tiers) % 1;        // position inside a tier (0 bottom → 1 top)
    const shell = 1.18 - 0.5 * f;     // tiers flare out at their bottom edge
    const r = coneR(y) * shell * (0.55 + 0.45 * Math.sqrt(Math.random()));
    const a = Math.random() * Math.PI * 2;
    const droop = f < 0.25 ? -(0.25 - f) * 0.5 * (r / R0) : 0;
    pos.set([Math.cos(a) * r, y + droop, Math.sin(a) * r], i * 3);
    const roll = Math.random();
    if (roll < 0.045) { c.set(0xffd27a); size[i] = 2.4 + Math.random() * 2; }
    else if (roll < 0.07) { c.set(0xffffff); size[i] = 1.6 + Math.random() * 1.6; }
    else {
      c.copy(greens[(Math.random() * greens.length) | 0]);
      c.multiplyScalar(0.55 + Math.random() * 0.45 + (r / (coneR(y) + 0.01)) * 0.25);
      size[i] = 1.4 + Math.random() * 1.8;
    }
    col.set([c.r, c.g, c.b], i * 3);
    phase[i] = Math.random();
  }
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      attribute float aSize; attribute float aPhase; attribute vec3 aColor;
      uniform float uTime; uniform float uPixelRatio; uniform float uReveal; uniform float uWave;
      varying vec3 vColor; varying float vAlpha;
      void main(){
        vec3 p = position;
        float h = clamp((p.y - ${f2(BASE_Y)}) / ${f2(H)}, 0.0, 1.0);
        p.x += sin(uTime * 0.9 + p.y * 1.3 + aPhase * 3.0) * 0.025 * h;
        p.z += cos(uTime * 0.7 + p.y * 1.1) * 0.02 * h;
        float vis = 1.0 - smoothstep(uReveal * 1.15 - 0.12, uReveal * 1.15, h);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float tw = 0.6 + 0.4 * sin(uTime * (1.6 + aPhase * 2.0) + aPhase * 6.2831);
        float w = uWave < 0.0 ? 0.0 : exp(-pow((h - uWave) * 9.0, 2.0));
        gl_PointSize = aSize * uPixelRatio * (30.0 / -mv.z) * (0.75 + 0.5 * tw) * (0.4 + 0.6 * vis) * (1.0 + w * 0.7);
        vColor = mix(aColor, vec3(1.0, 0.86, 0.5), w * 0.75);
        vAlpha = (0.55 + 0.45 * tw) * vis * (1.0 + w * 1.2);
      }`,
    fragmentShader: `
      varying vec3 vColor; varying float vAlpha;
      void main(){
        float a = pow(smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)), 1.7);
        gl_FragColor = vec4(vColor * (0.8 + a), a * vAlpha);
      }`,
    ...additive,
  });
  tree.add(points({ position: [pos, 3], aColor: [col, 3], aSize: [size, 1], aPhase: [phase, 1] }, material));
})();

// ---------- garland: three spiral strands of chasing bulbs ----------
(function buildGarland() {
  const strands = 3, per = isSmall ? 90 : 130, N = strands * per;
  const pos = new Float32Array(N * 3), idx = new Float32Array(N), col = new Float32Array(N * 3);
  const palette = GARLAND_COLORS.map((h) => new THREE.Color(h));
  let k = 0;
  for (let s = 0; s < strands; s++) {
    for (let i = 0; i < per; i++, k++) {
      const t = i / per;
      const y = BASE_Y + 0.3 + t * (H - 0.9);
      const a = t * 4.2 * Math.PI * 2 + (s / strands) * Math.PI * 2;
      const r = coneR(y) * 1.04 + 0.05;
      pos.set([Math.cos(a) * r, y - Math.sin(t * Math.PI * 30) * 0.03, Math.sin(a) * r], k * 3);
      idx[k] = i + s * 7;
      const c = palette[k % palette.length];
      col.set([c.r, c.g, c.b], k * 3);
    }
  }
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      attribute float aIdx; attribute vec3 aColor;
      uniform float uTime; uniform float uPixelRatio; uniform float uReveal; uniform float uWave;
      varying vec3 vColor; varying float vB;
      void main(){
        float h = clamp((position.y - ${f2(BASE_Y)}) / ${f2(H)}, 0.0, 1.0);
        float vis = 1.0 - smoothstep(uReveal * 1.15 - 0.05, uReveal * 1.15, h);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float chase = pow(0.5 + 0.5 * sin(uTime * 3.2 - aIdx * 0.45), 3.0);
        float w = uWave < 0.0 ? 0.0 : exp(-pow((h - uWave) * 7.0, 2.0));
        vB = min(1.6, (0.35 + 0.65 * chase) * vis + w * 1.2);
        gl_PointSize = (5.0 + 5.0 * chase + w * 7.0) * uPixelRatio * (30.0 / -mv.z) * vis;
        vColor = aColor;
      }`,
    fragmentShader: `
      varying vec3 vColor; varying float vB;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float core = smoothstep(0.18, 0.0, d);
        float halo = pow(smoothstep(0.5, 0.0, d), 2.2);
        gl_FragColor = vec4(vColor * (halo * 1.2 + core * 1.6), (halo + core) * vB);
      }`,
    ...additive,
  });
  tree.add(points({ position: [pos, 3], aIdx: [idx, 1], aColor: [col, 3] }, material));
})();

// ---------- magic dust spiralling up around the tree (positions computed on the GPU) ----------
(function buildDust() {
  const N = isSmall ? 500 : 900;
  const off = new Float32Array(N), spd = new Float32Array(N), ph = new Float32Array(N);
  for (let i = 0; i < N; i++) { off[i] = Math.random(); spd[i] = 0.035 + Math.random() * 0.04; ph[i] = Math.random() * 6.2831; }
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      attribute float aOff; attribute float aSpd; attribute float aPh;
      uniform float uTime; uniform float uPixelRatio; uniform float uReveal;
      varying float vA;
      void main(){
        float t = fract(aOff + uTime * aSpd);
        float y = ${f2(BASE_Y)} + t * ${f2(H + 0.6)};
        float r = max(0.0, 1.0 - t) * ${f2(R0)} * 1.18 + 0.25 + 0.15 * sin(aPh + uTime);
        float a = t * 6.2831 * 2.5 + aPh * 0.15 + uTime * 0.25;
        vec4 mv = modelViewMatrix * vec4(cos(a) * r, y, sin(a) * r, 1.0);
        gl_Position = projectionMatrix * mv;
        vA = smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.85, 1.0, t)) * step(1.0, uReveal);
        gl_PointSize = (2.0 + 2.5 * fract(aPh)) * uPixelRatio * (30.0 / -mv.z);
      }`,
    fragmentShader: `
      varying float vA;
      void main(){
        float a = pow(smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)), 2.0);
        gl_FragColor = vec4(vec3(1.0, 0.86, 0.55) * 1.4, a * vA);
      }`,
    ...additive,
  });
  const dust = points({ position: [new Float32Array(N * 3), 3], aOff: [off, 1], aSpd: [spd, 1], aPh: [ph, 1] }, material);
  dust.frustumCulled = false;
  tree.add(dust);
})();

// ---------- trunk ----------
const trunk = new THREE.Mesh(
  new THREE.CylinderGeometry(0.28, 0.4, 1.1, 16),
  new THREE.MeshStandardMaterial({ color: 0x4a2c18, roughness: 0.9 }),
);
trunk.position.y = 0.3;
tree.add(trunk);

// ---------- star ----------
export const star = (() => {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 0.55 : 0.23;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    i === 0 ? shape.moveTo(Math.cos(a) * r, Math.sin(a) * r) : shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2 });
  g.center();
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
    color: 0xffd36b, emissive: 0xffc24a, emissiveIntensity: 1.6, metalness: 0.5, roughness: 0.3,
  }));
  mesh.position.y = BASE_Y + H + 0.3;
  tree.add(mesh);
  return mesh;
})();

const starGlow = glowSprite(0xffcc66, 0.55);
starGlow.position.copy(star.position);
tree.add(starGlow);

const starRays = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.translate(128, 128);
  for (let i = 0; i < 14; i++) {
    x.rotate((Math.PI * 2) / 14);
    const grd = x.createLinearGradient(0, 0, 0, -128);
    grd.addColorStop(0, 'rgba(255,230,170,0.55)');
    grd.addColorStop(1, 'rgba(255,230,170,0)');
    x.fillStyle = grd;
    x.beginPath(); x.moveTo(-4, 0); x.lineTo(0, i % 2 ? -90 : -128); x.lineTo(4, 0); x.fill();
  }
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), opacity: 0.7, ...additive }));
  sprite.position.copy(star.position);
  tree.add(sprite);
  return sprite;
})();

const starLight = new THREE.PointLight(0xffd27a, 1.2, 8, 2);
starLight.position.copy(star.position);
tree.add(starLight);

// ---------- decorative baubles ----------
(function buildBaubles() {
  const cols = [0xc8324a, 0xe6b450, 0xd9e3ea, 0xb83a5e, 0xd4a03c];
  const n = isSmall ? 22 : 30;
  for (let i = 0; i < n; i++) {
    const y = BASE_Y + (0.06 + ((i * 0.618034) % 1) * 0.8) * H; // golden-ratio spread up the tree
    const a = i * 2.39996 + 0.4;
    const r = coneR(y) * 0.98;
    const c = cols[i % cols.length];
    const m = new THREE.Mesh(baubleGeo, new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.18, metalness: 0.55, roughness: 0.22 }));
    m.scale.setScalar(0.1 + Math.random() * 0.05);
    m.position.set(Math.cos(a) * r, y - 0.05, Math.sin(a) * r);
    tree.add(m);
  }
})();

/** Per-frame: spin the star and pulse its glow. `boost` (0..1) enlarges it after a light wave. */
export function updateStar(t, boost) {
  star.rotation.y = t * 0.8;
  const pulse = 1 + Math.sin(t * 2.2) * 0.06;
  const b = 1 + boost * 1.2;
  starGlow.scale.set(2.2 * pulse * b, 2.2 * pulse * b, 1);
  starRays.scale.set(3.4 * b, 3.4 * b, 1);
  starRays.material.rotation = t * 0.15;
}
