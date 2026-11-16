// The reindeer mascot as inline SVG (150×150, body cut off at the bottom edge).
//   'peek'   — surprised face, peeks over the result panel and waves (.paw-r).
//   'thrower' — holds a snowball in .arm (.held) and has a laughing face (.happy) for after the throw.

const ANTLERS = `
  <g stroke="#8a5a35" stroke-width="6" stroke-linecap="round" fill="none">
    <path d="M54 52 C48 38 42 30 36 18"/><path d="M46 36 L33 38"/><path d="M42 27 L44 15"/>
    <path d="M96 52 C102 38 108 30 114 18"/><path d="M104 36 L117 38"/><path d="M108 27 L106 15"/>
  </g>`;

const HEAD = `
  <g transform="rotate(-24 36 70)"><ellipse cx="36" cy="70" rx="13" ry="7.5" fill="#a46d43"/><ellipse cx="38" cy="70" rx="7" ry="3.5" fill="#f0c9a6"/></g>
  <g transform="rotate(24 114 70)"><ellipse cx="114" cy="70" rx="13" ry="7.5" fill="#a46d43"/><ellipse cx="112" cy="70" rx="7" ry="3.5" fill="#f0c9a6"/></g>
  <ellipse cx="75" cy="156" rx="50" ry="32" fill="#b5794a"/>
  <ellipse cx="75" cy="92" rx="42" ry="40" fill="#b5794a"/>
  <ellipse cx="75" cy="128" rx="37" ry="9" fill="#e2475b"/>
  <rect x="88" y="128" width="11" height="20" rx="4" fill="#c8324a" transform="rotate(-10 93 128)"/>
  <circle cx="75" cy="135" r="5" fill="#f3c25b"/>
  <ellipse cx="75" cy="106" rx="22" ry="16" fill="#f3d6b6"/>`;

const CHEEKS_NOSE = `
  <ellipse cx="49" cy="100" rx="7.5" ry="4.5" fill="#ff8fa3" opacity=".75"/>
  <ellipse cx="101" cy="100" rx="7.5" ry="4.5" fill="#ff8fa3" opacity=".75"/>
  <ellipse cx="75" cy="98" rx="8" ry="6" fill="#4a2a1a"/>
  <ellipse cx="72.5" cy="96" rx="2.6" ry="1.6" fill="#fff" opacity=".8"/>`;

const LEFT_PAW = '<ellipse cx="47" cy="146" rx="11" ry="8" fill="#8f5c37"/>';

const brow = (d) => `<path d="${d}" stroke="#6b4226" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;

const FACE = {
  peek: `
    ${brow('M53 70 q7 -6 14 -1')}${brow('M83 69 q7 -5 14 1')}
    <g class="eyes">
      <ellipse cx="60" cy="84" rx="6.5" ry="8.5" fill="#1b1410"/><circle cx="62.5" cy="80.5" r="2.6" fill="#fff"/><circle cx="58" cy="87" r="1.2" fill="#fff"/>
      <ellipse cx="90" cy="84" rx="6.5" ry="8.5" fill="#1b1410"/><circle cx="92.5" cy="80.5" r="2.6" fill="#fff"/><circle cx="88" cy="87" r="1.2" fill="#fff"/>
    </g>
    ${CHEEKS_NOSE}
    <ellipse cx="75" cy="113" rx="4.2" ry="5.2" fill="#5a2a22"/><ellipse cx="75" cy="116" rx="2.6" ry="1.8" fill="#ff8fa3"/>
    ${LEFT_PAW}
    <ellipse class="paw-r" cx="103" cy="146" rx="11" ry="8" fill="#8f5c37"/>`,
  thrower: `
    ${brow('M53 72 q7 -4 14 0')}${brow('M83 72 q7 -4 14 0')}
    <g class="eyes">
      <ellipse cx="60" cy="85" rx="6.5" ry="8" fill="#1b1410"/><circle cx="62.5" cy="81.5" r="2.6" fill="#fff"/>
      <ellipse cx="90" cy="85" rx="6.5" ry="8" fill="#1b1410"/><circle cx="92.5" cy="81.5" r="2.6" fill="#fff"/>
    </g>
    <g class="happy" stroke="#1b1410" stroke-width="3.5" fill="none" stroke-linecap="round">
      <path d="M53 87 q7 -9 14 0"/><path d="M83 87 q7 -9 14 0"/>
    </g>
    ${CHEEKS_NOSE}
    <path class="smirk" d="M68 110 q7 6 14 0" stroke="#5a2a22" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path class="happy" d="M66 109 q9 12 18 0 z" fill="#5a2a22"/>
    ${LEFT_PAW}
    <g class="arm">
      <circle class="held" cx="106" cy="128" r="11" fill="#f4f8fb" stroke="#c9d6e2" stroke-width="2"/>
      <ellipse cx="103" cy="140" rx="11" ry="8" fill="#8f5c37"/>
    </g>`,
};

export function reindeerSvg(kind, className) {
  return `<svg class="${className}" viewBox="0 0 150 150" aria-hidden="true">${ANTLERS}${HEAD}${FACE[kind]}</svg>`;
}
