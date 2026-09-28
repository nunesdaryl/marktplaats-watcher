// The logo, in one place. Change LOGO to switch it everywhere: the app (<Logo>), the favicon and the app icons
// (`npm run brand` regenerates public/icon.svg, apple-icon.png and icon-512.png from this file).
//
//   mark: "robot"  a friendly agent looking through binoculars (chosen by the FDE group, 28 Sep 2026)
//         "sieve"  three bars narrowing to one dot (the Claude Design prototype)
//   lens: what the robot sees in both lenses: "marktplaats" | "dot" | "sieve" | "score" | "slot" | "none"
//         (a different marketplace later = one more entry in LENSES)
export const LOGO = { mark: "robot", lens: "marktplaats" };

const C = {
  tile: "#1b1a18", teal: "#4fd1bf", white: "#f4f2ee", lilac: "#bca8ff", ink: "#1b1a18",
  mpOrange: "#eda566", mpNavy: "#2d3c4d",
};

// Lens contents, drawn around (cx, cy) inside a lens of radius r
const LENSES = {
  // Marktplaats-style mark: orange disc with a ≥ glyph. Their trademark: "Not affiliated with Marktplaats" stays
  // on the landing page, e-mails and social images.
  marktplaats: (cx, cy, r) => {
    const s = r * 0.42;
    return `<circle cx="${cx}" cy="${cy}" r="${r * 0.92}" fill="${C.mpOrange}"/>` +
      `<path d="M${cx - s * 0.7} ${cy - s * 0.95} L${cx + s * 0.75} ${cy - s * 0.1} L${cx - s * 0.7} ${cy + s * 0.75}" fill="none" stroke="${C.mpNavy}" stroke-width="${r * 0.2}" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="M${cx - s * 0.75} ${cy + s * 1.4} H${cx + s * 0.75}" stroke="${C.mpNavy}" stroke-width="${r * 0.2}" stroke-linecap="round"/>`;
  },
  dot: (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r * 0.45}" fill="${C.lilac}"/>`,
  sieve: (cx, cy, r) => [[0.62, -0.42], [0.4, -0.05], [0.2, 0.32]]
    .map(([w, dy]) => `<rect x="${cx - r * w}" y="${cy + r * dy - r * 0.09}" width="${r * w * 2}" height="${r * 0.18}" rx="${r * 0.09}" fill="${C.teal}"/>`).join("") +
    `<circle cx="${cx}" cy="${cy + r * 0.64}" r="${r * 0.12}" fill="${C.lilac}"/>`,
  score: (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r * 0.9}" fill="${C.lilac}"/>` +
    `<text x="${cx}" y="${cy + r * 0.2}" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-weight="700" font-size="${r * 0.6}" fill="${C.ink}">9/10</text>`,
  slot: (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r * 0.7}" fill="none" stroke="${C.teal}" stroke-width="${r * 0.12}" stroke-dasharray="${r * 0.3} ${r * 0.22}"/>`,
  none: () => "",
};

function robot(lens) {
  const see = LENSES[lens] ?? LENSES.none;
  return [
    `<rect width="64" height="64" rx="16" fill="${C.tile}"/>`,
    // antenna, ears, head, smiling eyes
    `<path d="M32 8.5V13" stroke="${C.teal}" stroke-width="2.6" stroke-linecap="round"/><circle cx="32" cy="7" r="2.8" fill="${C.teal}"/>`,
    `<rect x="11.5" y="19" width="5" height="11" rx="2.5" fill="${C.teal}"/><rect x="47.5" y="19" width="5" height="11" rx="2.5" fill="${C.teal}"/>`,
    `<rect x="16" y="13" width="32" height="25" rx="9" fill="${C.tile}" stroke="${C.white}" stroke-width="3"/>`,
    `<path d="M23 23.5q3-3.4 6 0M35 23.5q3-3.4 6 0" fill="none" stroke="${C.teal}" stroke-width="2.4" stroke-linecap="round"/>`,
    // body and hands holding the binoculars
    `<rect x="23" y="49" width="18" height="8" rx="3" fill="${C.white}"/>`,
    `<rect x="6.5" y="34" width="9" height="15" rx="4.5" fill="${C.white}"/><rect x="48.5" y="34" width="9" height="15" rx="4.5" fill="${C.white}"/>`,
    // binoculars: bridge with hinge, two barrels (teal rims), dark lenses
    `<rect x="26" y="31" width="12" height="9" rx="4" fill="${C.teal}"/><circle cx="32" cy="34.5" r="2.2" fill="${C.tile}"/>`,
    `<circle cx="21" cy="42" r="11" fill="${C.teal}"/><circle cx="43" cy="42" r="11" fill="${C.teal}"/>`,
    `<circle cx="21" cy="42" r="7.6" fill="${C.tile}"/><circle cx="43" cy="42" r="7.6" fill="${C.tile}"/>`,
    see(21, 42, 7.6), see(43, 42, 7.6),
  ].join("");
}

function sieve() {
  return `<rect width="64" height="64" rx="16" fill="${C.tile}"/>` +
    [[12, 10, 40], [20, 22, 24], [26, 34, 12]].map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="6" rx="3" fill="${C.teal}"/>`).join("") +
    `<circle cx="32" cy="50" r="4" fill="${C.lilac}"/>`;
}

/** The logo as an SVG string (64×64 view box). Pure: same input, same output, safe to inline. */
export function logoSvg({ mark = LOGO.mark, lens = LOGO.lens, size } = {}) {
  const body = mark === "sieve" ? sieve() : robot(lens);
  const dims = size ? ` width="${size}" height="${size}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"${dims} role="img" aria-label="Marktplaats Watcher">${body}</svg>`;
}

export const LENS_OPTIONS = Object.keys(LENSES);
