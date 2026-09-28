// Regenerates the favicon and app icons from src/brand/logo.js (the one place the logo is defined).
// Run after changing LOGO: `npm run brand`. PNGs are rendered with a local headless Chrome.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { logoSvg, LOGO } from "../src/brand/logo.js";

const pub = fileURLToPath(new URL("../public/", import.meta.url));
writeFileSync(join(pub, "icon.svg"), logoSvg());
console.log(`public/icon.svg  (mark: ${LOGO.mark}, lens: ${LOGO.lens})`);

const chrome = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
if (!chrome) { console.warn("No Chrome found: PNG icons not regenerated."); process.exit(0); }

async function png(file, size) {
  const dir = mkdtempSync(join(tmpdir(), "brand-"));
  const html = join(dir, "i.html");
  writeFileSync(html, `<!doctype html><body style="margin:0;background:transparent">${logoSvg({ size })}</body>`);
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
