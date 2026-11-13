#!/usr/bin/env node
// Motion Studio renderer: drives player.html frame-by-frame in headless Chromium and pipes PNGs into ffmpeg.
//
//   node render.cjs scenes/demo.json                 -> out/demo.mp4 (full 1080x1920)
//   node render.cjs scenes/demo.json --scale 0.5     -> half-res draft (fast)
//   node render.cjs scenes/demo.json --frames 0-90   -> render a slice
//   node render.cjs scenes/demo.json --still 150     -> out/demo-150.png (single frame check)
//   node render.cjs --serve                          -> live preview at http://localhost:4173/player.html
//
// Needs: node, ffmpeg, playwright (with Chromium).
const http = require("http"), fs = require("fs"), path = require("path"), { spawn } = require("child_process");
const { chromium } = require("playwright");

const ROOT = __dirname;
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const PORT = Number(flag("--port", 4173));

const TYPES = { ".html": "text/html", ".json": "application/json", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".wav": "audio/wav" };
function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const p = path.normalize(path.join(ROOT, decodeURIComponent(req.url.split("?")[0])));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
      fs.createReadStream(p).pipe(rsp);
    }).listen(PORT, "127.0.0.1", () => res(srv));
  });
}

(async () => {
  const srv = await serve();
  if (args.includes("--serve")) { console.log(`Preview: http://localhost:${PORT}/player.html?scene=scenes/demo.json`); return; }

  const scenePath = args.find(a => a.endsWith(".json")) || "scenes/demo.json";
  const meta = JSON.parse(fs.readFileSync(path.join(ROOT, scenePath), "utf8")).meta;
  const scale = Number(flag("--scale", 1));
  const [f0, f1] = (flag("--frames", `0-${meta.durationFrames - 1}`)).split("-").map(Number);
  const name = path.basename(scenePath, ".json");
  fs.mkdirSync(path.join(ROOT, "out"), { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: meta.width, height: meta.height }, deviceScaleFactor: scale });
  page.on("pageerror", e => { console.error("player error:", e.message); process.exitCode = 1; });
  await page.goto(`http://127.0.0.1:${PORT}/player.html?render=1&scene=${encodeURIComponent(scenePath)}`);
  await page.evaluate(() => window.ready);

  const still = flag("--still");
  if (still !== undefined) {
    await page.evaluate(f => window.seek(f), Number(still));
    const out = path.join(ROOT, "out", `${name}-${still}.png`);
    await page.screenshot({ path: out });
    console.log("wrote", out);
  } else {
    const out = path.join(ROOT, "out", `${name}.mp4`);
    const ff = ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(meta.fps), "-i", "-"];
    if (meta.audio) ff.push("-ss", String(f0 / meta.fps), "-i", path.join(ROOT, meta.audio), "-shortest", "-c:a", "aac");
    ff.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-movflags", "+faststart", out);
    const enc = spawn("ffmpeg", ff, { stdio: ["pipe", "ignore", "inherit"] });
    const t0 = Date.now();
    for (let f = f0; f <= f1; f++) {
      await page.evaluate(n => window.seek(n), f);
      const buf = await page.screenshot({ type: "png" });
      if (!enc.stdin.write(buf)) await new Promise(r => enc.stdin.once("drain", r));
      if (f % 30 === 0) process.stdout.write(`\rframe ${f}/${f1}`);
    }
    enc.stdin.end();
    await new Promise(r => enc.on("close", r));
    console.log(`\nwrote ${out} (${f1 - f0 + 1} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
