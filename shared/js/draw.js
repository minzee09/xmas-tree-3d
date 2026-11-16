// Gift draw: N presents drop in front of the tree, shuffle, and K of them are winners.
import { GROUND_Y } from './config.js';
import { scene, camera, controls, shake } from './stage.js';
import { makeGift } from './gift.js';
import { burst } from './burst.js';
import { triggerWave } from './wave.js';
import { setPresentsHidden } from './ground.js';
import { Music } from './music.js';
import { playAmbush } from './ambush.js';
import { reindeerSvg } from './reindeer.js';
import { onFrame, onTap, onHover, aim } from './loop.js';

const THREE = window.THREE;

const LIMITS = { minGifts: 2, maxGifts: 20 };
const WRAPS = [ // [paper, ribbon]
  [0xc8324a, 0xf3c25b], [0x2e7d5b, 0xeef3f6], [0x3a5fa8, 0xf3c25b], [0xe6e9ef, 0xc8324a],
  [0x8e4bb5, 0xf3c25b], [0xe07a2f, 0xfff4e0], [0x1f9e9a, 0xf28dc0], [0xd94f8a, 0xffffff],
];
const FIREWORKS = [
  [0xffd27a, 0xffffff, 0xff9a5c], [0xff4d6d, 0xffd6e0, 0xffffff], [0x6fd3ff, 0xe6f7ff, 0xffffff],
  [0x7dffb0, 0xfff1c9, 0xffffff], [0xc77dff, 0xffe6ff, 0xffd27a],
];
const GREY = new THREE.Color(0x4a525a);
const CAMERA_DROP = 1.6; // look lower while the gifts are out
const SHUFFLE_ROUNDS = 4;

const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOutBack = (x) => 1 + 2.7 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2);
const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
};

// ---------- markup ----------
const CONTROLS_HTML = `
  <button class="pill" type="button" data-ref="open" aria-expanded="false">선물 뽑기</button>
  <div class="draw-set" data-ref="settings" hidden>
    <div class="step">
      <label for="drawN">선물 개수</label>
      <div class="step-ctl">
        <button type="button" data-step="n:-1" aria-label="선물 개수 줄이기">−</button>
        <input type="number" id="drawN" data-ref="n" min="${LIMITS.minGifts}" max="${LIMITS.maxGifts}" value="6" inputmode="numeric">
        <button type="button" data-step="n:1" aria-label="선물 개수 늘리기">+</button>
      </div>
    </div>
    <div class="step">
      <label for="drawK">당첨 개수</label>
      <div class="step-ctl">
        <button type="button" data-step="k:-1" aria-label="당첨 개수 줄이기">−</button>
        <input type="number" id="drawK" data-ref="k" min="1" max="6" value="1" inputmode="numeric">
        <button type="button" data-step="k:1" aria-label="당첨 개수 늘리기">+</button>
      </div>
    </div>
    <button class="draw-go" type="button" data-ref="go">시작</button>
  </div>
  <div class="draw-bar" data-ref="bar" hidden>
    <span data-ref="status"></span>
    <button type="button" data-ref="quit">그만하기</button>
  </div>`;

const RESULT_HTML = `
  <div class="peek" aria-hidden="true"><div class="peek-char">${reindeerSvg('peek', 'peek-svg')}</div></div>
  <div class="peek-fx" aria-hidden="true"><span class="bubble">짠!</span><i></i><i></i><i></i><i></i></div>
  <h3 id="drawResultTitle">뽑기 끝</h3>
  <p data-ref="resultText"></p>
  <div class="btns">
    <button type="button" data-ref="close">닫기</button>
    <button type="button" class="primary" data-ref="again">다시 하기</button>
  </div>`;

const refs = (root) => Object.fromEntries([...root.querySelectorAll('[data-ref]')].map((el) => [el.dataset.ref, el]));

/** Mount the draw controls into `container` (the top bar). */
export function initDraw(container) {
  const wrap = document.createElement('div');
  wrap.className = 'draw-wrap';
  wrap.innerHTML = CONTROLS_HTML;
  const help = container.querySelector('.help');
  container.insertBefore(wrap, help);

  const result = document.createElement('div');
  result.className = 'draw-result';
  result.hidden = true;
  result.setAttribute('role', 'dialog');
  result.setAttribute('aria-labelledby', 'drawResultTitle');
  result.innerHTML = RESULT_HTML;

  const pop = document.createElement('div');
  pop.className = 'draw-pop';
  pop.hidden = true;
  document.body.append(pop, result);

  const ui = { ...refs(wrap), ...refs(result), result };

  // ----- state -----
  const group = new THREE.Group();
  scene.add(group);
  const beamGeo = new THREE.CylinderGeometry(0.26, 0.4, 10, 40, 1, true);
  beamGeo.translate(0, 5, 0);

  /** idle → dropping → shuffling → ready → ending → done; leaving while clearing. */
  let phase = 'idle';
  let items = [], slots = [], n = 6, k = 1, found = 0, opened = 0;
  let leaveAt = 0, hover = -1, baseY = null;
  const timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  const clearTimers = () => { while (timers.length) clearTimeout(timers.pop()); };
  const tmp = new THREE.Vector3();

  // ----- settings -----
  function readSettings() {
    const n = Math.max(LIMITS.minGifts, Math.min(LIMITS.maxGifts, Math.round(Number(ui.n.value)) || LIMITS.minGifts));
    const k = Math.max(1, Math.min(n, Math.round(Number(ui.k.value)) || 1));
    ui.n.value = n; ui.k.value = k; ui.k.max = n;
    return { n, k };
  }
  try {
    const saved = JSON.parse(localStorage.getItem('xmas-draw') || 'null');
    if (saved) { ui.n.value = saved.n; ui.k.value = saved.k; }
  } catch (_) { /* storage blocked */ }
  readSettings();

  ui.settings.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
    const [which, delta] = b.dataset.step.split(':');
    ui[which].value = Number(ui[which].value) + Number(delta);
    readSettings();
  }));
  ui.n.addEventListener('change', readSettings);
  ui.k.addEventListener('change', readSettings);

  const showSettings = (open) => {
    ui.settings.hidden = !open;
    ui.open.setAttribute('aria-expanded', String(open));
  };
  ui.open.addEventListener('click', () => showSettings(ui.settings.hidden));
  ui.go.addEventListener('click', () => {
    ({ n, k } = readSettings());
    try { localStorage.setItem('xmas-draw', JSON.stringify({ n, k })); } catch (_) { /* storage blocked */ }
    showSettings(false);
    begin();
  });
  ui.quit.addEventListener('click', end);
  ui.close.addEventListener('click', () => { ui.result.hidden = true; end(); });
  ui.again.addEventListener('click', () => { ui.result.hidden = true; begin(); });

  function setStatus() {
    if (phase === 'dropping' || phase === 'shuffling') ui.status.textContent = '섞는 중…';
    else if (phase === 'ready') ui.status.textContent = `당첨 ${found}/${k} · 남은 선물 ${n - opened}`;
    else ui.status.textContent = `당첨 ${found}/${k}`;
  }

  /** Slots on one or two arcs in front of the tree, facing the camera azimuth `az`. */
  function layout(count, az) {
    const size = count <= 7 ? 0.78 : count <= 12 ? 0.64 : 0.54;
    const gap = size * 1.7;
    const rows = count <= 7 ? [count] : [Math.ceil(count / 2), Math.floor(count / 2)];
    const radii = rows.length === 1 ? [4.7] : [5.5, 4.2];
    const pos = [];
    rows.forEach((m, ri) => {
      const r = radii[ri], step = gap / r, span = step * (m - 1);
      const stagger = ri === 1 && (rows[0] - m) % 2 === 0 ? step * 0.5 : 0;
      for (let j = 0; j < m; j++) {
        const th = az - span / 2 + j * step + stagger;
        pos.push(new THREE.Vector3(Math.sin(th) * r, GROUND_Y, Math.cos(th) * r));
      }
    });
    return { size, pos };
  }

  function disposeItem(it) {
    group.remove(it.group);
    it.dispose();
    if (it.beam) it.beam.material.dispose();
  }

  function begin() {
    clearTimers();
    items.forEach(disposeItem);
    items = []; found = 0; opened = 0; hover = -1;
    if (baseY === null) baseY = controls.target.y;
    const az = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z);
    const lay = layout(n, az);
    slots = lay.pos;
    const winners = new Set(shuffle([...Array(n).keys()]).slice(0, k));
    const now = performance.now();
    for (let i = 0; i < n; i++) {
      const [color, ribbon] = WRAPS[(Math.random() * WRAPS.length) | 0];
      const s = lay.size;
      const gift = makeGift({
        w: s * (0.9 + Math.random() * 0.25), h: s * (0.85 + Math.random() * 0.3), d: s * (0.9 + Math.random() * 0.25),
        color, ribbon, ribbonWidth: s * 0.13, bowSize: s * 0.12,
      });
      gift.glow.scale.set(s * 3, s * 3, 1);
      const it = Object.assign(gift, {
        size: s, paper: new THREE.Color(color), ribbon: new THREE.Color(ribbon),
        winner: winners.has(i), opened: false, landed: false, puffed: false,
        dropAt: now + i * 110 + Math.random() * 60,
        from: slots[i].clone(), to: slots[i].clone(), moveAt: 0, moveDur: 430,
        spin: (Math.random() - 0.5) * 0.6, hv: 0,
      });
      it.group.position.set(slots[i].x, 9, slots[i].z);
      it.group.rotation.y = it.spin;
      it.meshes.forEach((m) => { m.userData.draw = i; });
      group.add(it.group);
      items.push(it);
    }
    phase = 'dropping';
    setPresentsHidden(true);
    ui.open.hidden = true; showSettings(false); ui.bar.hidden = false; ui.result.hidden = true;
    setStatus();
  }

  function end() {
    clearTimers();
    if (!items.length) { reset(); return; }
    phase = 'leaving';
    leaveAt = performance.now();
    later(650, () => { items.forEach(disposeItem); items = []; reset(); });
  }

  function reset() {
    phase = 'idle';
    setPresentsHidden(false);
    ui.bar.hidden = true; ui.open.hidden = false; pop.hidden = true;
  }

  function shuffleRound(round) {
    const now = performance.now();
    if (round >= SHUFFLE_ROUNDS) {
      phase = 'ready';
      setStatus();
      return;
    }
    const order = shuffle([...Array(n).keys()]);
    items.forEach((it, i) => {
      it.from.copy(it.group.position); it.from.y = GROUND_Y;
      it.to.copy(slots[order[i]]);
      it.moveAt = now;
    });
    later(470, () => shuffleRound(round + 1));
  }

  function popText(text) {
    pop.hidden = false;
    pop.className = 'draw-pop lose';
    pop.textContent = text;
    pop.style.animation = 'none'; void pop.offsetWidth; pop.style.animation = '';
    clearTimeout(popText.timer);
    popText.timer = setTimeout(() => { pop.hidden = true; }, 1500);
  }

  function addBeam(it) {
    const material = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uA: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        varying vec2 vUv; uniform float uT; uniform float uA;
        void main(){
          float fade = pow(1.0 - vUv.y, 1.4);
          float streak = 0.55 + 0.45 * sin(vUv.x * 50.0 + uT * 5.0) * sin(vUv.y * 12.0 - uT * 8.0);
          vec3 col = mix(vec3(1.0, 0.72, 0.25), vec3(1.0, 0.97, 0.85), fade);
          gl_FragColor = vec4(col * 1.4, fade * streak * uA);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    it.beam = new THREE.Mesh(beamGeo, material);
    it.beam.position.y = it.bodyH;
    it.beam.scale.setScalar(it.size / 0.78);
    it.group.add(it.beam);
  }

  /** `quiet` = revealed automatically at the end (no sound, text or character). */
  function openItem(it, quiet) {
    if (it.opened) return;
    it.opened = true;
    it.openedAt = performance.now();
    opened++;
    it.group.getWorldPosition(tmp);
    const top = tmp.clone();
    top.y += it.bodyH + 0.1;

    if (it.winner) {
      found++;
      addBeam(it);
      it.bodyMat.emissive.set(0xffc24a);
      burst(top.clone(), [0xffd27a, 0xffffff, 0xff4d6d, 0x6fd3ff, 0x7dffb0, 0xc77dff], 380, 3.2, 8.5); // confetti fountain
      burst(top.clone(), [0xffe9a8, 0xffffff], 160, 4.5);
      shake(1);
      triggerWave(150);
      [250, 600, 950, 1350].forEach((ms, i) => later(ms, () => {
        const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 3;
        burst(new THREE.Vector3(Math.cos(a) * r, 6.5 + Math.random() * 3.5, Math.sin(a) * r), FIREWORKS[(i + found) % FIREWORKS.length], 240, 4.2);
      }));
      Music.fanfare();
      if (!quiet) playAmbush();
    } else {
      burst(top.clone(), [0x9aa4ad, 0xc9d1d8, 0x6c7680], 70, 1.5);
      if (!quiet) { Music.bloop(); popText('꽝'); }
    }
    setStatus();

    if (phase === 'ready' && (found >= k || opened >= n)) {
      phase = 'ending';
      setStatus();
      // reveal the rest as 꽝, then show the summary
      later(it.winner ? 2400 : 1000, () => {
        const rest = items.filter((x) => !x.opened);
        rest.forEach((x, i) => later(i * 110, () => openItem(x, true)));
        later(rest.length * 110 + 900, () => {
          phase = 'done';
          ui.resultText.textContent = `선물 ${n}개 중 당첨 ${k}개가 모두 나왔어요.`;
          ui.result.hidden = false;
          later(500, () => Music.boing());
        });
      });
    }
  }

  // ----- pointer -----
  function pickIndex() {
    if (!items.length) return -1;
    const meshes = items.filter((it) => !it.opened).flatMap((it) => it.meshes);
    const hit = aim().intersectObjects(meshes, false)[0];
    return hit ? hit.object.userData.draw : -1;
  }
  onTap(() => {
    if (phase === 'idle') return false;
    const i = pickIndex();
    if (i < 0) return false;
    if (phase === 'ready') openItem(items[i], false);
    return true; // swallow taps on gifts while they are still moving
  });
  onHover(() => {
    hover = phase === 'ready' ? pickIndex() : -1;
    return hover >= 0;
  });

  // ----- per frame -----
  function animateItem(it, i, now, dt, t) {
    const g = it.group;

    if (phase === 'leaving') {
      const e = Math.min(1, (now - leaveAt) / 600);
      g.scale.setScalar(Math.max(0.001, 1 - easeInOut(e)));
      g.position.y = GROUND_Y + e * 0.6;
      return true;
    }

    if (!it.landed) { // falling from the sky, then a squashy bounce
      const e = (now - it.dropAt) / 1000;
      if (e < 0) return false;
      const Tf = 0.62;
      if (e < Tf) {
        g.position.y = GROUND_Y + 9.2 * (1 - (e / Tf) ** 2);
      } else if (e < Tf + 0.35) {
        if (!it.puffed) { it.puffed = true; g.getWorldPosition(tmp); burst(tmp.clone(), [0xeef3f6, 0xc9dcec], 26, 1.4); }
        const sq = Math.sin(((e - Tf) / 0.35) * Math.PI);
        g.position.y = GROUND_Y + 0.22 * sq;
        it.body.scale.set(1 + sq * 0.08, 1 - sq * 0.12, 1 + sq * 0.08);
      } else {
        g.position.y = GROUND_Y;
        it.body.scale.set(1, 1, 1);
        it.landed = true;
      }
      g.rotation.y = it.spin + e * 2.5 * Math.max(0, 1 - e / Tf);
      return it.landed;
    }

    if (it.moveAt) { // hopping to a new slot while shuffling
      const e = Math.min(1, (now - it.moveAt) / it.moveDur);
      const s = easeInOut(e);
      g.position.lerpVectors(it.from, it.to, s);
      g.position.y = GROUND_Y + Math.sin(e * Math.PI) * (0.9 + (i % 3) * 0.25);
      g.rotation.y = it.spin + s * Math.PI * (i % 2 ? 1 : -1);
      if (e >= 1) { it.moveAt = 0; it.spin = g.rotation.y; }
      return true;
    }

    if (!it.opened) { // idle bob, lift on hover
      it.hv += ((i === hover ? 1 : 0) - it.hv) * Math.min(1, dt * 10);
      g.position.y = GROUND_Y + Math.abs(Math.sin(t * 2.2 + i * 0.8)) * 0.06 + it.hv * 0.18;
      g.scale.setScalar(1 + it.hv * 0.08);
      it.bodyMat.emissiveIntensity = it.hv * 0.25;
      it.glow.material.opacity = it.hv * 0.35;
      return true;
    }

    const e = (now - it.openedAt) / 1000;
    const sq = e < 0.16 ? Math.sin((e / 0.16) * Math.PI) : 0;
    it.body.scale.set(1 + sq * 0.12, 1 - sq * 0.2, 1 + sq * 0.12);
    g.scale.setScalar(1);
    g.position.y = GROUND_Y;

    if (it.winner) { // lid floats up and spins above a glowing box and a gold beam
      const rise = Math.min(1, e / 0.75);
      it.lid.position.y = it.lidRestY + easeOutBack(rise) * 1.5 * (it.size / 0.78) + (rise >= 1 ? Math.sin(t * 2) * 0.06 : 0);
      it.lid.rotation.y += dt * (1.2 + 6 * Math.max(0, 1 - e));
      it.lid.rotation.x = Math.sin(t * 1.5) * 0.15;
      const pulse = 0.75 + 0.25 * Math.sin(t * 4);
      it.glow.material.opacity = Math.min(1, e * 4) * pulse * 0.6;
      it.glow.scale.setScalar(it.size * (2.0 + Math.min(1, e * 2) * 0.7 * pulse));
      it.bodyMat.emissiveIntensity = 0.35 + 0.2 * pulse;
      const m = it.beam.material;
      m.uniforms.uT.value = t;
      const a = e < 0.3 ? e / 0.3 : e < 2.6 ? 1 : Math.max(0.35, 1 - (e - 2.6) * 0.6);
      m.uniforms.uA.value = a * (0.6 + 0.12 * Math.sin(t * 6));
      it.beam.scale.x = it.beam.scale.z = (it.size / 0.78) * (1 + 0.08 * Math.sin(t * 5));
      if (e < 2.2 && Math.random() < 0.8) { // sparkle stream
        g.getWorldPosition(tmp); tmp.y += it.bodyH;
        burst(tmp.clone(), [0xffd27a, 0xffffff, 0xfff1c9], 5, 1.2, 6);
      }
    } else { // lid pops and lands crooked, box fades to grey
      const T = 0.45, vy = 2.6, G = (2 * vy) / T;
      it.lid.position.y = it.lidRestY + (e < T ? vy * e - 0.5 * G * e * e : 0.01);
      it.lid.rotation.z = Math.min(1, e / T) * 0.22;
      it.lid.position.x = Math.min(1, e / T) * it.size * 0.12;
      const f = Math.min(1, Math.max(0, (e - 0.2) / 0.6));
      it.bodyMat.color.copy(it.paper).lerp(GREY, f * 0.85);
      it.bodyMat.emissive.copy(it.bodyMat.color);
      it.bodyMat.emissiveIntensity = 0;
      it.ribbonMat.color.copy(it.ribbon).lerp(GREY, f * 0.85);
      it.ribbonMat.emissiveIntensity = 0.15 * (1 - f);
      it.body.scale.y *= 1 - f * 0.08;
      it.glow.material.opacity = 0;
    }
    return true;
  }

  onFrame((now, dt, t) => {
    if (baseY !== null) {
      const want = phase === 'idle' ? baseY : baseY - CAMERA_DROP;
      const dy = (want - controls.target.y) * Math.min(1, dt * 2.2);
      if (Math.abs(dy) > 1e-4) controls.target.y += dy;
      else if (phase === 'idle') baseY = null;
    }
    if (!items.length) return;
    let allLanded = true;
    items.forEach((it, i) => { if (!animateItem(it, i, now, dt, t)) allLanded = false; });
    if (phase === 'dropping' && allLanded) {
      phase = 'shuffling';
      later(250, () => shuffleRound(0));
    }
  });
}
