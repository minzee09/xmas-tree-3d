// Shared constants for the scene.

/** Tree shape: foliage starts at BASE_Y and is H tall, with radius R0 at the base. */
export const TREE = { H: 7.4, BASE_Y: 0.55, R0: 3.1 };

/** Height of the snowy ground plane. */
export const GROUND_Y = -0.24;

/** Radius of the cone at height y. */
export const coneR = (y) => Math.max(0, 1 - (y - TREE.BASE_Y) / TREE.H) * TREE.R0;

/** Below this width the layout switches to the phone version. */
export const NARROW_PX = 760;

export const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Smaller screens get fewer particles. */
export const isSmall = Math.min(window.innerWidth, window.innerHeight) < 600;

/** Colors of the chasing garland bulbs (also used for tap fireworks). */
export const GARLAND_COLORS = [0xffb347, 0xffd98a, 0xff7a4d, 0xfff1c9];
