// On a win, the reindeer pops up from a bottom corner and throws a snowball at the screen.
import { reduceMotion } from './config.js';
import { canvas } from './stage.js';
import { Music } from './music.js';
import { reindeerSvg } from './reindeer.js';

const wrap = document.createElement('div');
wrap.className = 'ambush';
wrap.hidden = true;
wrap.setAttribute('aria-hidden', 'true');
wrap.innerHTML = `<div class="amb-char">${reindeerSvg('thrower', 'amb-svg')}</div>`;

const ball = document.createElement('div');
ball.className = 'snowball';
ball.hidden = true;

document.body.append(wrap, ball);

const timers = [];
const later = (ms, fn) => timers.push(setTimeout(fn, ms));

/** SVG of an irregular snow splat with droplets, different every time. */
function splatSvg() {
  const cx = 150, cy = 150, R = 78, N = 14;
  const p = Array.from({ length: N }, (_, i) => {
    const a = (i / N) * Math.PI * 2;
    const r = R * (0.72 + Math.random() * 0.5);
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2].map((v) => v.toFixed(1)).join(' ');
  // smooth closed curve: through edge midpoints, using the points as control points
  let d = `M${mid(p[0], p[1])}`;
  for (let i = 1; i <= N; i++) {
    const c = p[i % N], next = p[(i + 1) % N];
    d += ` Q${c[0].toFixed(1)} ${c[1].toFixed(1)} ${mid(c, next)}`;
  }
  const drops = Array.from({ length: 11 }, () => {
    const a = Math.random() * Math.PI * 2, r = R * (1.15 + Math.random() * 0.7), s = 4 + Math.random() * 11;
    return `<circle cx="${(cx + Math.cos(a) * r).toFixed(1)}" cy="${(cy + Math.sin(a) * r).toFixed(1)}" r="${s.toFixed(1)}" fill="url(#snowFill)"/>`;
  }).join('');
  return `
    <svg viewBox="0 0 300 300">
      <defs>
        <radialGradient id="snowFill" cx="40%" cy="35%" r="70%">
          <stop offset="0" stop-color="#ffffff"/><stop offset=".65" stop-color="#eef4f9"/><stop offset="1" stop-color="#c3d2df"/>
        </radialGradient>
      </defs>
      <path d="${d} Z" fill="url(#snowFill)"/>${drops}
      <ellipse cx="128" cy="124" rx="26" ry="14" fill="#fff" opacity=".85" transform="rotate(-25 128 124)"/>
    </svg>`;
}

function hit(x, y) {
  const el = document.createElement('div');
  el.className = 'splat';
  el.innerHTML = splatSvg();
  el.style.left = `${x - 150}px`;
  el.style.top = `${y - 150}px`;
  document.body.append(el);
  const rot = `rotate(${((Math.random() - 0.5) * 40).toFixed(1)}deg)`;
  el.animate([
    { transform: `scale(.3) ${rot}`, opacity: 1 },
    { transform: `scale(1.12) ${rot}`, opacity: 1, offset: 0.12 },
    { transform: `scale(1) ${rot}`, opacity: 1, offset: 0.2 },
    { transform: `translateY(14px) ${rot}`, opacity: 1, offset: 0.6 }, // starts to slide down
    { transform: `translateY(70px) scale(.98, 1.04) ${rot}`, opacity: 0 },
  ], { duration: 3200, easing: 'ease-in', fill: 'forwards' }).onfinish = () => el.remove();

  if (!reduceMotion) {
    canvas.animate([
      { transform: 'translate(0, 0)' }, { transform: 'translate(-9px, 6px)' }, { transform: 'translate(7px, -5px)' },
      { transform: 'translate(-4px, 3px)' }, { transform: 'translate(0, 0)' },
    ], { duration: 320, easing: 'ease-out' });
  }
  Music.splat();
}

function throwBall(fromRight) {
  const r = wrap.getBoundingClientRect();
  const x0 = r.left + r.width * (fromRight ? 0.3 : 0.7), y0 = r.top + r.height * 0.42;
  const W = window.innerWidth, H = window.innerHeight;
  const x1 = W * (0.35 + Math.random() * 0.3), y1 = H * (0.3 + Math.random() * 0.22);
  const xm = (x0 + x1) / 2, ym = Math.min(y0, y1) - H * 0.12;
  const at = (x, y, s) => `translate(${x - 30}px, ${y - 30}px) scale(${s})`;
  ball.hidden = false;
  // grows as it flies so it seems to come at the viewer
  ball.animate(
    [{ transform: at(x0, y0, 0.35) }, { transform: at(xm, ym, 1.1), offset: 0.55 }, { transform: at(x1, y1, 3.4) }],
    { duration: reduceMotion ? 1 : 460, easing: 'cubic-bezier(.45, 0, .9, .55)', fill: 'forwards' },
  ).onfinish = () => { ball.hidden = true; hit(x1, y1); };
  Music.whoosh();
}

export function playAmbush() {
  while (timers.length) clearTimeout(timers.pop());
  const fromRight = Math.random() < 0.5;
  wrap.className = `ambush${fromRight ? ' right' : ''}`;
  wrap.hidden = false;
  void wrap.offsetWidth; // restart the CSS animation
  wrap.classList.add('in');
  Music.pop();
  later(520, () => wrap.classList.add('windup'));
  later(900, () => {
    wrap.classList.replace('windup', 'throw');
    throwBall(fromRight);
  });
  later(1450, () => { wrap.classList.replace('throw', 'laugh'); Music.giggle(); });
  later(2700, () => { wrap.classList.remove('in', 'laugh'); wrap.classList.add('out'); });
  later(3200, () => { wrap.hidden = true; wrap.className = 'ambush'; });
}
