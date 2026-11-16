// Guestbook: every message becomes a glowing ornament on the tree.
// Data comes from the Worker API (/api/entries). If the API is unreachable (e.g. a static preview),
// entries are kept in this browser only.
import { TREE, coneR } from './shared/js/config.js';
import { camera, glowSprite } from './shared/js/stage.js';
import { tree, baubleGeo } from './shared/js/tree.js';
import { burst } from './shared/js/burst.js';
import { onFrame, onTap, onHover, aim, spinTreeTo } from './shared/js/loop.js';

const THREE = window.THREE;

const COLORS = {
  red:    { hex: '#e2475b', label: '빨강' },
  gold:   { hex: '#f3c25b', label: '금색' },
  blue:   { hex: '#5aa9e6', label: '파랑' },
  pink:   { hex: '#f28dc0', label: '분홍' },
  silver: { hex: '#dfe7ee', label: '은색' },
  green:  { hex: '#59c98a', label: '초록' },
};
const LIMITS = { name: 16, msg: 80 };
const POLL_MS = 15000;
const STORAGE = { nick: 'xmas-nick', tokens: 'xmas-tokens', local: 'xmas-guestbook-local' };

const store = {
  get(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch (_) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* storage blocked */ }
  },
};

function timeAgo(at) {
  if (!at) return '';
  const s = Math.max(0, (Date.now() - at) / 1000);
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}일 전`;
  const d = new Date(at);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** Validate an entry from the server (or storage); returns null if unusable. */
function clean(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, LIMITS.name) : '';
  const msg = typeof raw.msg === 'string' ? raw.msg.trim().slice(0, LIMITS.msg) : '';
  const id = typeof raw.id === 'string' ? raw.id.slice(0, 40) : '';
  if (!name || !msg || !id) return null;
  const color = Object.hasOwn(COLORS, raw.color) ? raw.color : 'gold';
  const at = Number.isFinite(raw.at) ? raw.at : 0;
  return { id, name, msg, color, at };
}

// ======================================================================
// Data source: Worker API, or this browser only
// ======================================================================
const api = {
  async list() {
    const res = await fetch('/api/entries', { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data?.entries)) throw new Error('unexpected response');
    return data.entries;
  },
  async add(entry) {
    const res = await fetch('/api/entries', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(entry),
    });
    if (res.status === 429) throw Object.assign(new Error('rate limited'), { rateLimited: true });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { entry: saved, token } = await res.json();
    store.set(STORAGE.tokens, { ...store.get(STORAGE.tokens, {}), [saved.id]: token });
    return saved;
  },
  async remove(id) {
    const token = store.get(STORAGE.tokens, {})[id] || '';
    const res = await fetch(`/api/entries/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'x-delete-token': token } });
    if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
  },
  canDelete: (id) => Boolean(store.get(STORAGE.tokens, {})[id]),
};

const local = {
  async list() { return store.get(STORAGE.local, []); },
  async add(entry) {
    const saved = { ...entry, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), at: Date.now() };
    store.set(STORAGE.local, [...store.get(STORAGE.local, []), saved].slice(-40));
    return saved;
  },
  async remove(id) { store.set(STORAGE.local, store.get(STORAGE.local, []).filter((e) => e.id !== id)); },
  canDelete: () => true,
};

// ======================================================================
// Ornaments on the tree
// ======================================================================
const ornGroup = new THREE.Group();
tree.add(ornGroup);
const ornaments = new Map(); // id → { mesh, halo, entry, base, angle, from, born, hover, pulse }
const capGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.05, 10);
const capMat = new THREE.MeshStandardMaterial({ color: 0xd9c08a, metalness: 0.9, roughness: 0.3 });
const v3 = new THREE.Vector3();

/** Stable 0..1 hash so each entry always hangs in the same spot. */
function hash01(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}

function placeFor(id) {
  const y = TREE.BASE_Y + (0.07 + hash01(`${id}y`) * 0.74) * TREE.H;
  const a = hash01(`${id}a`) * Math.PI * 2;
  const r = coneR(y) + 0.1;
  return { pos: new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), angle: Math.atan2(Math.cos(a), Math.sin(a)) };
}

function addOrnament(entry, flyIn) {
  const c = new THREE.Color(COLORS[entry.color].hex);
  const mesh = new THREE.Mesh(baubleGeo, new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.55, metalness: 0.35, roughness: 0.18 }));
  mesh.scale.setScalar(0.19);
  const cap = new THREE.Mesh(capGeo, capMat);
  cap.position.y = 1.05;
  cap.scale.setScalar(5.2);
  mesh.add(cap);
  mesh.userData.entryId = entry.id;
  const halo = glowSprite(c, 0.55);
  const { pos, angle } = placeFor(entry.id);
  const o = { mesh, halo, entry, base: pos, angle, from: null, born: performance.now(), hover: 0, pulse: 0 };
  if (flyIn) {
    // fly in from just in front of the camera
    const start = camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(3)).add(new THREE.Vector3(0, -1, 0));
    o.from = ornGroup.worldToLocal(start);
  }
  mesh.position.copy(o.from || pos);
  halo.position.copy(mesh.position);
  ornGroup.add(mesh, halo);
  ornaments.set(entry.id, o);
}

function removeOrnament(id) {
  const o = ornaments.get(id);
  if (!o) return;
  ornGroup.remove(o.mesh, o.halo);
  o.mesh.material.dispose();
  o.halo.material.dispose();
  ornaments.delete(id);
}

// ======================================================================
// UI
// ======================================================================
export async function initGuestbook() {
  const $ = (id) => document.getElementById(id);
  const els = {
    book: $('book'), head: $('bookHead'), count: $('count'), form: $('form'),
    name: $('nameInput'), msg: $('msgInput'), chars: $('chars'), swatches: $('swatches'),
    submit: $('submitBtn'), status: $('status'), list: $('list'),
    card: $('card'), cardMsg: $('cardMsg'), cardWho: $('cardWho'), cardWhen: $('cardWhen'), cardClose: $('cardClose'),
  };

  let source = null;      // api | local
  let entries = [];       // newest first
  let firstSync = true;
  let saving = false;
  let confirmId = null;
  let openId = null;
  let hoverId = null;

  // ----- form -----
  Object.entries(COLORS).forEach(([key, { hex, label }], i) => {
    const lab = document.createElement('label');
    lab.className = 'swatch';
    lab.title = label;
    const input = Object.assign(document.createElement('input'), { type: 'radio', name: 'color', value: key, id: `color-${key}`, checked: i === 0 });
    input.setAttribute('aria-label', label);
    const dot = document.createElement('span');
    dot.style.setProperty('--c', hex);
    lab.append(input, dot);
    els.swatches.append(lab);
  });
  els.msg.addEventListener('input', () => { els.chars.textContent = `${els.msg.value.length} / ${LIMITS.msg}`; });
  els.name.value = store.get(STORAGE.nick, '') || '';

  // phones: the panel is a bottom sheet
  const isNarrow = () => window.innerWidth <= 760;
  const setSheet = (open) => { els.book.classList.toggle('open', open); els.head.setAttribute('aria-expanded', String(open)); };
  els.head.addEventListener('click', () => { if (isNarrow()) setSheet(!els.book.classList.contains('open')); });
  if (!isNarrow()) els.head.setAttribute('aria-expanded', 'true');

  const setStatus = (text, warn = false) => {
    els.status.textContent = text;
    els.status.classList.toggle('warn', warn);
  };

  // ----- card -----
  function openCard(id, spin) {
    const o = ornaments.get(id);
    if (!o) return;
    openId = id;
    const e = o.entry;
    els.card.style.setProperty('--c', COLORS[e.color].hex);
    els.cardMsg.textContent = e.msg;
    els.cardWho.textContent = e.name;
    els.cardWhen.textContent = timeAgo(e.at);
    els.card.hidden = false;
    els.card.style.animation = 'none'; void els.card.offsetWidth; els.card.style.animation = '';
    o.pulse = performance.now();
    if (spin) spinTreeTo(o.angle);
    markActive();
    positionCard();
  }
  function closeCard() {
    openId = null;
    els.card.hidden = true;
    markActive();
  }
  els.cardClose.addEventListener('click', closeCard);

  function positionCard() {
    if (!openId) return;
    const o = ornaments.get(openId);
    if (!o) { closeCard(); return; }
    o.mesh.getWorldPosition(v3).project(camera);
    const w = window.innerWidth, h = window.innerHeight;
    const x = (v3.x * 0.5 + 0.5) * w, y = (-v3.y * 0.5 + 0.5) * h;
    const cw = els.card.offsetWidth, ch = els.card.offsetHeight;
    let top = y + 22;
    if (top + ch > h - 16) top = y - ch - 26;
    els.card.style.left = `${Math.max(16, Math.min(w - cw - 16, x - cw / 2))}px`;
    els.card.style.top = `${Math.max(16, Math.min(h - ch - 16, top))}px`;
  }

  // ----- list -----
  function markActive() {
    els.list.querySelectorAll('.entry').forEach((li) => li.classList.toggle('active', li.dataset.id === openId));
  }

  function renderList() {
    els.count.textContent = source ? `${entries.length}개` : '';
    els.list.replaceChildren();
    if (!entries.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = source ? '아직 방명록이 없어요.' : '불러오는 중…';
      els.list.append(li);
      return;
    }
    const el = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls, textContent: text ?? '' });
    for (const e of entries) {
      const li = el('li', `entry${e.id === openId ? ' active' : ''}`);
      li.dataset.id = e.id;
      li.tabIndex = 0;
      li.style.setProperty('--c', COLORS[e.color].hex);
      const meta = el('span', 'meta');
      meta.append(el('span', 'when', timeAgo(e.at)));
      if (source.canDelete(e.id)) {
        const del = el('button', 'del', '삭제');
        del.type = 'button';
        del.setAttribute('aria-label', `${e.name}의 글 삭제`);
        del.addEventListener('click', (ev) => { ev.stopPropagation(); confirmId = e.id; renderList(); });
        meta.append(del);
      }
      li.append(el('span', 'dot'), el('span', 'who', e.name), meta, el('span', 'msg', e.msg));
      if (confirmId === e.id) {
        const box = el('div', 'confirm', '삭제할까요?');
        const yes = el('button', 'yes', '삭제');
        const no = el('button', '', '취소');
        yes.type = no.type = 'button';
        yes.addEventListener('click', (ev) => { ev.stopPropagation(); confirmId = null; remove(e); });
        no.addEventListener('click', (ev) => { ev.stopPropagation(); confirmId = null; renderList(); });
        box.append(yes, no);
        li.append(box);
      }
      const go = () => openCard(e.id, true);
      li.addEventListener('click', go);
      li.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } });
      els.list.append(li);
    }
  }
  setInterval(() => { if (!confirmId) renderList(); }, 60000); // keep "n분 전" fresh

  /** Replace the entry list and sync ornaments (new ones fly in after the first load). */
  function setEntries(raw) {
    entries = raw.map(clean).filter(Boolean).sort((a, b) => b.at - a.at);
    const ids = new Set(entries.map((e) => e.id));
    [...ornaments.keys()].forEach((id) => { if (!ids.has(id)) removeOrnament(id); });
    if (openId && !ids.has(openId)) closeCard();
    for (const e of entries) {
      if (ornaments.has(e.id)) ornaments.get(e.id).entry = e;
      else addOrnament(e, !firstSync);
    }
    firstSync = false;
    renderList();
  }

  async function refresh() {
    try { setEntries(await source.list()); } catch (_) { /* keep what we have */ }
  }

  // ----- actions -----
  els.form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (saving || !source) return;
    const name = els.name.value.trim().slice(0, LIMITS.name);
    const msg = els.msg.value.trim().slice(0, LIMITS.msg);
    if (!name) { setStatus('이름을 입력해주세요.', true); els.name.focus(); return; }
    if (!msg) { setStatus('메시지를 입력해주세요.', true); els.msg.focus(); return; }
    const color = els.form.querySelector('input[name="color"]:checked')?.value || 'gold';
    store.set(STORAGE.nick, name);

    saving = true;
    els.submit.disabled = true;
    setStatus('저장 중…');
    try {
      const saved = await source.add({ name, msg, color });
      setEntries([saved, ...entries.filter((e) => e.id !== saved.id)]);
      els.msg.value = '';
      els.chars.textContent = `0 / ${LIMITS.msg}`;
      setStatus(source === local ? '저장했어요. (이 브라우저에만 저장됨)' : '저장했어요.');
      const o = ornaments.get(saved.id);
      if (o) { spinTreeTo(o.angle); setTimeout(() => openCard(saved.id, false), 1500); }
      if (isNarrow()) setSheet(false);
    } catch (err) {
      setStatus(err.rateLimited ? '잠시 후 다시 시도해주세요.' : '저장하지 못했어요. 잠시 후 다시 시도해주세요.', true);
    } finally {
      saving = false;
      els.submit.disabled = false;
    }
  });

  async function remove(e) {
    try {
      await source.remove(e.id);
      setEntries(entries.filter((x) => x.id !== e.id));
    } catch (_) {
      setStatus('삭제하지 못했어요.', true);
    }
  }

  // ----- 3D hooks -----
  function pickOrnament() {
    const hit = aim().intersectObjects([...ornaments.values()].map((o) => o.mesh), false)[0];
    return hit ? hit.object.userData.entryId : null;
  }
  onTap(() => {
    const id = pickOrnament();
    if (id) { openCard(id, false); return true; }
    closeCard();
    return false;
  });
  onHover(() => { hoverId = pickOrnament(); return Boolean(hoverId); });

  onFrame((now, dt, t) => {
    ornaments.forEach((o, id) => {
      if (o.from) { // flying in to its spot
        const k = Math.min(1, (now - o.born) / 1400);
        const e = 1 - Math.pow(1 - k, 3);
        v3.lerpVectors(o.from, o.base, e);
        v3.y += Math.sin(e * Math.PI) * 1.2;
        o.mesh.position.copy(v3);
        if (k >= 1) {
          o.from = null;
          o.mesh.getWorldPosition(v3);
          burst(v3.clone(), [COLORS[o.entry.color].hex, '#ffffff', '#ffd98a'], 220, 3.4);
        }
      } else {
        const sway = Math.sin(t * 1.4 + o.angle * 3) * 0.02;
        o.mesh.position.set(o.base.x + sway, o.base.y - Math.abs(sway) * 0.5, o.base.z);
      }
      o.halo.position.copy(o.mesh.position);
      o.hover += ((id === hoverId || id === openId ? 1 : 0) - o.hover) * Math.min(1, dt * 8);
      const k = o.pulse ? (now - o.pulse) / 900 : 1;
      const pulse = k < 1 ? Math.sin(k * Math.PI) * 0.5 : 0;
      o.mesh.scale.setScalar(0.19 * (1 + o.hover * 0.25 + pulse));
      o.mesh.material.emissiveIntensity = 0.32 + 0.15 * Math.sin(t * 2 + o.angle * 5) + o.hover * 0.35 + pulse;
      const hs = 1.1 + o.hover * 0.5 + pulse * 1.5;
      o.halo.scale.set(hs, hs, 1);
    });
    positionCard();
  });

  // ----- connect -----
  renderList();
  els.submit.disabled = true;
  try {
    const list = await api.list();
    source = api;
    setEntries(list);
    setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, POLL_MS);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
  } catch (_) {
    source = local;
    setEntries(await local.list());
    setStatus('이 브라우저에만 저장돼요.');
  }
  els.submit.disabled = false;
  renderList();
}
