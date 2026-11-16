// Small hook registry so features can plug into the frame loop and pointer handling
// without importing each other.
import { camera, controls } from './stage.js';
import { tree } from './tree.js';

const THREE = window.THREE;

const frameHooks = [];
const tapHooks = [];
const hoverHooks = [];
let tapFallback = () => {};
let hoverFallback = () => false;

/** fn(now, dt, t) every frame. */
export const onFrame = (fn) => { frameHooks.push(fn); };

/** fn() on a tap; return true to consume it. Hooks run in registration order. */
export const onTap = (fn) => { tapHooks.push(fn); };

/** fn() on mouse move; return true when the pointer is over something clickable. */
export const onHover = (fn) => { hoverHooks.push(fn); };

export const setTapFallback = (fn) => { tapFallback = fn; };
export const setHoverFallback = (fn) => { hoverFallback = fn; };

export const runFrame = (now, dt, t) => { for (const fn of frameHooks) fn(now, dt, t); };
export const runTap = () => { if (!tapHooks.some((fn) => fn())) tapFallback(); };
export function runHover() {
  let any = false;
  for (const fn of hoverHooks) any = fn() || any; // call every hook so each can update its hover state
  return any || hoverFallback();
}

// ---------- pointer → ray ----------
export const raycaster = new THREE.Raycaster();
export const ndc = new THREE.Vector2();

/** Cast a ray through the current pointer position. */
export function aim() {
  raycaster.setFromCamera(ndc, camera);
  return raycaster;
}

// ---------- tree spin ----------
let idleUntil = 0;
let spinTarget = null;

/** Stop the slow idle spin for a while (e.g. while the viewer drags). */
export const pauseSpin = (ms) => { idleUntil = Math.max(idleUntil, performance.now() + ms); };

/** Turn the tree so a point at `localAngle` (atan2(x, z) in tree space) faces the camera. */
export function spinTreeTo(localAngle) {
  const camAz = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z);
  const cur = tree.rotation.y;
  const target = camAz - localAngle;
  spinTarget = cur + ((((target - cur) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  pauseSpin(6000);
}

export function updateSpin(now, dt, idleSpeed) {
  if (spinTarget !== null) {
    tree.rotation.y += (spinTarget - tree.rotation.y) * Math.min(1, dt * 4);
    if (Math.abs(spinTarget - tree.rotation.y) < 0.002) spinTarget = null;
  } else if (now > idleUntil) {
    tree.rotation.y += dt * idleSpeed;
  }
}
