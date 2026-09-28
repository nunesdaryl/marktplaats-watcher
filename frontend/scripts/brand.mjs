// Regenerates the favicon and app icons from src/brand/logo.js (the one place the logo is defined).
// Run after changing LOGO: `npm run brand`. PNGs are rendered with a local headless Chrome.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { logoSvg, LOGO, raiseAt } from "../src/brand/logo.js";

const pub = fileURLToPath(new URL("../public/", import.meta.url));
writeFileSync(join(pub, "icon.svg"), logoSvg({ animate: false }));   // tabs don't play animated favicons reliably
console.log(`public/icon.svg  (mark: ${LOGO.mark}, lens: ${LOGO.lens})`);

const chrome = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
if (!chrome) { console.warn("No Chrome found: PNG icons not regenerated."); process.exit(0); }

async function shot(html, out, w, h, dir) {
  await new Promise((resolve) => {
    const p = spawn(chrome, ["--headless=new", "--disable-gpu", "--no-first-run", `--user-data-dir=${join(dir, "p")}`, "--hide-scrollbars",
      "--default-background-color=00000000", `--window-size=${w},${h}`, `--screenshot=${out}`, `file://${html}`], { stdio: "ignore" });
    const timer = setTimeout(() => p.kill(), 60000);
    p.on("exit", () => { clearTimeout(timer); resolve(); });
  });
}

async function png(file, size) {
  const dir = mkdtempSync(join(tmpdir(), "brand-"));
  const html = join(dir, "i.html");
  writeFileSync(html, `<!doctype html><body style="margin:0;background:transparent">${logoSvg({ size, animate: false })}</body>`);
  const out = join(pub, file);
  await new Promise((resolve) => {
    const p = spawn(chrome, ["--headless=new", "--disable-gpu", "--no-first-run", `--user-data-dir=${join(dir, "p")}`, "--hide-scrollbars",
      "--default-background-color=00000000", `--window-size=${size},${size}`, `--screenshot=${out}`, `file://${html}`], { stdio: "ignore" });
    const timer = setTimeout(() => p.kill(), 30000);
    p.on("exit", () => { clearTimeout(timer); resolve(); });
  });
  rmSync(dir, { recursive: true, force: true });
  console.log(`public/${file}  ${size}×${size}`);
}
await png("apple-icon.png", 180);
await png("icon-512.png", 512);

// The animated logo as a GIF (H to I and back, 4 s loop) for LinkedIn, Slack and slides: 100 frames rendered on one
// sprite sheet by Chrome, cut into frames and encoded by ffmpeg (skipped when ffmpeg isn't installed).
if (LOGO.animate) {
  const ffmpeg = ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/usr/bin/ffmpeg"].find(existsSync);
  if (!ffmpeg) console.warn("No ffmpeg found: animated GIF not regenerated.");
  else {
    const dir = mkdtempSync(join(tmpdir(), "brand-gif-"));
    const cols = 10, frames = 100, px = 256;
    const tiles = Array.from({ length: frames }, (_, i) =>
      `<div style="width:${px}px;height:${px}px">${logoSvg({ raise: raiseAt(i / frames), size: px })}</div>`).join("");
    const html = join(dir, "sheet.html"), sheet = join(dir, "sheet.png");
    writeFileSync(html, `<!doctype html><body style="margin:0;background:#fbfaf7;display:grid;grid-template-columns:repeat(${cols},${px}px)">${tiles}</body>`);
    await shot(html, sheet, cols * px, (frames / cols) * px, dir);
    const gif = fileURLToPath(new URL("../../docs/design/logo-h-to-i.gif", import.meta.url));
    await new Promise((resolve) => {
      const p = spawn(ffmpeg, ["-y", "-loglevel", "error", "-i", sheet, "-vf",
        `untile=${cols}x${frames / cols},setpts=N/25/TB,split[a][b];[a]palettegen=reserve_transparent=0[p];[b][p]paletteuse`,
        "-r", "25", "-loop", "0", gif], { stdio: "inherit" });
      p.on("exit", resolve);
    });
    rmSync(dir, { recursive: true, force: true });
    console.log("docs/design/logo-h-to-i.gif  256×256, 4 s loop");
  }
}
