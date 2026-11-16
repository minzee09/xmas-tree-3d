// A golden light wave that climbs the tree and makes the star burst when it reaches the top.
import { uniforms } from './stage.js';
import { star } from './tree.js';
import { burst } from './burst.js';

const THREE = window.THREE;
const DURATION = 1100;
const at = new THREE.Vector3();

let startAt = 0;
let starFired = false;
let starBoost = 0;

/** Start a wave after `delayMs`. */
export function triggerWave(delayMs = 0) {
  startAt = performance.now() + delayMs;
  starFired = false;
}

/** 0..1, how much the star is enlarged right now. */
export const getStarBoost = () => starBoost;

export function updateWave(now, dt) {
  if (startAt && now >= startAt) {
    const k = (now - startAt) / DURATION;
    uniforms.uWave.value = k * 1.15 - 0.08;
    if (k > 0.88 && !starFired) {
      starFired = true;
      starBoost = 1;
      star.getWorldPosition(at);
      burst(at.clone(), [0xffd27a, 0xffffff, 0xfff1c9, 0xff9a5c], 220, 3.2);
    }
    if (k >= 1.05) { uniforms.uWave.value = -1; startAt = 0; }
  }
  starBoost = Math.max(0, starBoost - dt * 1.4);
}
