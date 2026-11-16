// Entry point shared by both sites: builds the scene, wires pointer input and runs the frame loop.
import { GARLAND_COLORS, reduceMotion } from './config.js';
import { canvas, camera, controls, uniforms, render, setLayout } from './stage.js';
import { updateStar } from './tree.js';
import { updatePresents, pickPresent, openPresent } from './ground.js';
import './snow.js';
import { burst, updateBursts } from './burst.js';
import { updateWave, getStarBoost } from './wave.js';
import { initMusicButton } from './music.js';
import { initDraw } from './draw.js';
import {
  ndc, aim, runFrame, runTap, runHover, setTapFallback, setHoverFallback, pauseSpin, updateSpin,
} from './loop.js';

const THREE = window.THREE;

/** Tapping empty space sets off a firework on a plane through the middle of the tree. */
function fireworkAtPointer() {
  const ray = aim().ray;
  const normal = camera.getWorldDirection(new THREE.Vector3()).negate();
  const plane = new THREE.Plane(normal, -normal.dot(new THREE.Vector3(0, 4, 0)));
  const at = new THREE.Vector3();
  if (ray.intersectPlane(plane, at)) burst(at, [...GARLAND_COLORS, 0xffffff], 140, 2.6);
}

function setPointer(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
}

function wirePointer() {
  let down = null;
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    setPointer(e);
    canvas.style.cursor = runHover() ? 'pointer' : 'grab';
  });
  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
    pauseSpin(4000);
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!down) return;
    const isTap = Math.hypot(e.clientX - down.x, e.clientY - down.y) <= 6 && performance.now() - down.t < 450;
    down = null;
    if (!isTap) return; // it was a drag to orbit
    setPointer(e);
    runTap();
  });

  // Built-in fallbacks run after every feature hook: open a decorative present, otherwise a firework.
  setTapFallback(() => {
    const i = pickPresent(aim());
    if (i >= 0) openPresent(i);
    else fireworkAtPointer();
  });
  setHoverFallback(() => pickPresent(aim()) >= 0);
}

/**
 * @param {{ layout?: 'full' | 'panel' }} options
 *   'panel' leaves room for a side panel (bottom sheet on phones).
 */
export function startApp({ layout = 'full' } = {}) {
  setLayout(layout);
  const top = document.getElementById('top');
  initMusicButton(top);
  initDraw(top);
  wirePointer();

  const clock = new THREE.Clock();
  function tick() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const now = performance.now();
    uniforms.uTime.value = t;
    if (uniforms.uReveal.value < 1.4) uniforms.uReveal.value = Math.min(1.4, uniforms.uReveal.value + dt * 0.5);

    updateSpin(now, dt, reduceMotion ? 0 : 0.12);
    updateStar(t, getStarBoost());
    updatePresents(now, dt);
    updateWave(now, dt);
    runFrame(now, dt, t);
    updateBursts(dt);
    controls.update();
    render(dt);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
