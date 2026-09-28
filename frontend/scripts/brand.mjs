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

// The social preview (OG) image, 1200×627, in the Sieve style with the current logo (still pose)
{
  const dir = mkdtempSync(join(tmpdir(), "brand-og-"));
  const fonts = fileURLToPath(new URL("../public/fonts/", import.meta.url));
  const pill = (t) => `<span style="background:#bca8ff;color:#190d3b;border-radius:10px;padding:0 14px;box-decoration-break:clone;-webkit-box-decoration-break:clone">${t}</span>`;
  const card = (score, title, why, good) => `<div style="flex:1;display:flex;gap:18px;align-items:center;background:${good ? "#252321" : "transparent"};border:1px solid rgba(232,224,212,.14);border-radius:12px;padding:20px 22px">
    <span style="font:500 24px 'Geist Mono';padding:8px 14px;border-radius:8px;${good ? "background:#58d68e;color:#062414" : "background:#252321;color:#a9a49c"}">${score}</span>
    <span><b style="display:block;font-size:22px;${good ? "" : "text-decoration:line-through;color:#a9a49c"}">${title}</b><span style="color:#a9a49c;font-size:18px">${why}</span></span></div>`;
  const html = join(dir, "og.html");
  writeFileSync(html, `<!doctype html><style>
@font-face{font-family:Geist;src:url("file://${fonts}geist-sans-latin-400-normal.woff2");font-weight:400}
@font-face{font-family:Geist;src:url("file://${fonts}geist-sans-latin-600-normal.woff2");font-weight:600}
@font-face{font-family:"Geist Mono";src:url("file://${fonts}geist-mono-latin-500-normal.woff2");font-weight:500}
body{margin:0;width:1200px;height:627px;background:#151412;color:#ece9e4;font-family:Geist;box-sizing:border-box;padding:56px 64px;display:flex;flex-direction:column}
</style><body>
<div style="display:flex;align-items:center;gap:14px">${logoSvg({ size: 56, animate: false })}<span style="font-size:26px;color:#a9a49c">Marktplaats <b style="color:#ece9e4;font-weight:600">Watcher</b></span></div>
<h1 style="font-size:58px;line-height:1.18;font-weight:600;letter-spacing:-0.035em;margin:40px 0 0;max-width:1060px">Check Marktplaats for a ${pill("Mac mini under €500")} ${pill("every morning at 8")} and <span style="white-space:nowrap">e-mail</span> me ${pill("good matches")}, with the reason.</h1>
<div style="display:flex;gap:20px;margin-top:auto">${card("9/10", "Mac mini i5, 16 GB, €230", "Well under €500. E-mailed.", true)}${card("0/10", "Mac Mini M4 Docking Station, €74", "Not a Mac mini. Skipped.", false)}</div>
<div style="text-align:right;color:#928d85;font-size:16px;margin-top:14px">Not affiliated with Marktplaats</div>
</body>`);
  await shot(html, join(pub, "og-image.png"), 1200, 627, dir);
  rmSync(dir, { recursive: true, force: true });
  console.log("public/og-image.png  1200×627");
}

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
