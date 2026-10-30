// Lo común de las grabaciones del panel de KudeExpress: iniciar sesión,
// encabezado de marca, textos, puntero y placa final inyectados en la página,
// captura de cuadros por CDP y armado del MP4 vertical (1080×1920, H.264, audio
// AAC 48 kHz mudo: lo que piden los Reels de Instagram y Facebook).
//
// Cada guion (facturacion-masiva.mjs, punto-de-venta.mjs) llama a recordReel()
// con sus textos y una función que maneja la página.

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function overlayScript({ logo, header, end }) {
    return `
(() => {
  const css = \`
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&display=swap');
    .fi-topbar, .fi-breadcrumbs { display: none !important; }
    .fi-no { padding-top: 180px !important; z-index: 10002 !important; }
    body { padding-top: 170px !important; }
    #reel-top { position: fixed; inset: 0 0 auto 0; height: 170px; background: #0B1A2B; z-index: 9998;
      display: flex; flex-direction: column; justify-content: flex-end; padding: 0 32px 22px; box-sizing: border-box;
      font-family: 'Plus Jakarta Sans', sans-serif; color: #fff; }
    #reel-top .brand { display: flex; align-items: center; gap: 10px; font-size: 20px; font-weight: 500; margin-bottom: 8px; }
    #reel-top .brand img { width: 26px; height: 33px; object-fit: contain; }
    #reel-top h1 { margin: 0; font-size: 42px; line-height: 1; font-weight: 800; letter-spacing: -1.5px; }
    #reel-top h1 span { color: #08D8E5; }
    #reel-cap { position: fixed; left: 50%; bottom: 250px; transform: translate(-50%, 12px); opacity: 0;
      transition: opacity .35s ease, transform .35s ease; z-index: 9999; max-width: 600px; width: max-content;
      background: #0B1A2B; color: #fff; border-radius: 18px; padding: 16px 24px; text-align: center;
      font: 700 27px/1.25 'Plus Jakarta Sans', sans-serif; box-shadow: 0 10px 30px rgba(11,26,43,.35); }
    #reel-cap.on { opacity: 1; transform: translate(-50%, 0); }
    #reel-cap.top { bottom: auto; top: 190px; }
    #reel-cap b { color: #08D8E5; }
    #reel-cursor { position: fixed; left: 360px; top: 760px; width: 34px; height: 34px; z-index: 10000;
      transition: left .7s cubic-bezier(.4,0,.2,1), top .7s cubic-bezier(.4,0,.2,1); pointer-events: none; }
    #reel-cursor svg { filter: drop-shadow(0 2px 3px rgba(0,0,0,.35)); }
    #reel-cursor::after { content: ''; position: absolute; left: -14px; top: -14px; width: 28px; height: 28px; border-radius: 50%;
      border: 3px solid #FC9320; opacity: 0; transform: scale(.4); }
    #reel-cursor.click::after { animation: reel-ring .5s ease-out; }
    @keyframes reel-ring { 0% { opacity: 1; transform: scale(.4); } 100% { opacity: 0; transform: scale(1.8); } }
    #reel-end { position: fixed; inset: 0; background: #0B1A2B; z-index: 10003; opacity: 0; transition: opacity .5s ease;
      display: flex; flex-direction: column; justify-content: center; padding: 0 56px; gap: 26px;
      font-family: 'Plus Jakarta Sans', sans-serif; color: #fff; pointer-events: none; }
    #reel-end.on { opacity: 1; }
    #reel-end .brand { display: flex; align-items: center; gap: 14px; font-size: 32px; font-weight: 500; }
    #reel-end .brand img { width: 44px; height: 56px; object-fit: contain; }
    #reel-end h2 { margin: 0; font-size: 60px; line-height: 1.02; font-weight: 800; letter-spacing: -2px; }
    #reel-end h2 span { color: #08D8E5; }
    #reel-end p { margin: 0; font-size: 28px; line-height: 1.35; color: #C3CFDC; font-weight: 500; }
    #reel-end .cta { align-self: flex-start; background: #08D8E5; color: #0B1A2B; font-weight: 800; font-size: 28px;
      border-radius: 999px; padding: 18px 32px; margin-top: 10px; }
  \`;
  const mount = () => {
    if (document.getElementById('reel-top')) return;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    document.body.insertAdjacentHTML('beforeend', \`
      <div id="reel-top"><div class="brand"><img src="${logo}" alt=""><span>Kude<b>Express</b></span></div>
        <h1>${header.lead} <span>${header.accent}</span></h1></div>
      <div id="reel-cap"></div>
      <div id="reel-cursor"><svg width="34" height="34" viewBox="0 0 24 24"><path d="M4 2l15 11-6.5 1.2L16 21l-3 1.4-3.6-6.9L4 20z" fill="#fff" stroke="#0B1A2B" stroke-width="1.6" stroke-linejoin="round"/></svg></div>
      <div id="reel-end"><div class="brand"><img src="${logo}" alt=""><span>Kude<b>Express</b></span></div>
        <h2>${end.lead} <span>${end.accent}</span></h2>
        <p>${end.line}</p>
        <div class="cta">WhatsApp 0987 800 032</div></div>\`);
  };
  window.reel = {
    caption(html, top) {
      const cap = document.getElementById('reel-cap');
      if (!html) { cap.classList.remove('on'); return; }
      cap.classList.remove('on');
      setTimeout(() => { cap.innerHTML = html; cap.classList.toggle('top', !!top); cap.classList.add('on'); }, cap.innerHTML ? 250 : 0);
    },
    cursor(x, y, instant) {
      const c = document.getElementById('reel-cursor');
      if (instant) { c.style.transition = 'none'; }
      c.style.left = x + 'px'; c.style.top = y + 'px';
      if (instant) { c.offsetHeight; c.style.transition = ''; }
    },
    click() {
      const c = document.getElementById('reel-cursor');
      c.classList.remove('click'); c.offsetHeight; c.classList.add('click');
    },
    end() { document.getElementById('reel-end').classList.add('on'); document.getElementById('reel-cursor').style.display = 'none'; },
  };
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
`;
}

/**
 * @param {object} o
 * @param {string} o.output  ruta del MP4
 * @param {string} o.path    página donde empieza la grabación (después del login)
 * @param {{email: string, password: string}} o.user
 * @param {{lead: string, accent: string}} o.header  título fijo de arriba
 * @param {{lead: string, accent: string, line: string}} o.end  placa final
 * @param {(h: object) => Promise<void>} scenario  maneja la página con los ayudantes
 */
export async function recordReel({ output, path: startPath, user, header, end }, scenario) {
    const BASE = (process.env.BASE ?? 'http://localhost:8123').replace(/\/$/, '');
    const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
    const logo = `data:image/png;base64,${(await readFile(path.join(root, 'assets/kudeexpress-logo.png'))).toString('base64')}`;

    const browser = await chromium.launch();
    const context = await browser.newContext({
        viewport: { width: 720, height: 1280 },
        deviceScaleFactor: 1.5,
        colorScheme: 'light',
        locale: 'es-PY',
    });

    const login = await context.newPage();
    await login.goto(`${BASE}/admin/login`);
    await login.locator('input[type="email"]').fill(user.email);
    await login.locator('input[type="password"]').fill(user.password);
    await login.locator('form button[type="submit"]').click();
    await login.waitForURL((url) => !url.pathname.endsWith('/login'));
    await login.close();

    await context.addInitScript(overlayScript({ logo, header, end }));
    const page = await context.newPage();
    await page.goto(`${BASE}${startPath}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);

    // Cuadros del screencast con su hora: el video respeta la duración real de cada uno.
    const frames = [];
    const cdp = await context.newCDPSession(page);
    cdp.on('Page.screencastFrame', (frame) => {
        frames.push({ ts: frame.metadata.timestamp, data: frame.data });
        cdp.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {});
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1 });

    const pause = (ms) => page.waitForTimeout(ms);
    const helpers = {
        page,
        pause,
        // top: true lo muestra debajo del encabezado, cuando abajo tapa algo que importa.
        caption: (html, { top = false } = {}) => page.evaluate(([h, t]) => window.reel.caption(h, t), [html, top]),
        async pointAt(locator) {
            const box = await locator.boundingBox();
            await page.evaluate(([x, y]) => window.reel.cursor(x, y), [box.x + box.width * 0.55, box.y + box.height * 0.6]);
            await pause(800);
        },
        async clickOn(locator) {
            await helpers.pointAt(locator);
            await page.evaluate(() => window.reel.click());
            await pause(250);
            await locator.click();
        },
        async scrollTo(locator, offset = 200) {
            const y = await locator.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
            await page.evaluate((top) => window.scrollTo({ top, behavior: 'smooth' }), y - offset);
            await pause(900);
        },
        resetCursor: (x = 360, y = 900) => page.evaluate(([cx, cy]) => window.reel.cursor(cx, cy, true), [x, y]),
    };

    await scenario(helpers);

    await helpers.caption('');
    await page.evaluate(() => window.reel.end());
    await pause(3200);

    const stoppedAt = Date.now() / 1000;
    await cdp.send('Page.stopScreencast');
    await browser.close();

    // Cada cuadro dura hasta el siguiente; el último, hasta el final de la grabación.
    const dir = await mkdtemp(path.join(os.tmpdir(), 'reel-'));
    let list = 'ffconcat version 1.0\n';
    for (const [i, frame] of frames.entries()) {
        const name = `f${String(i).padStart(5, '0')}.jpg`;
        await writeFile(path.join(dir, name), Buffer.from(frame.data, 'base64'));
        const next = frames[i + 1]?.ts ?? stoppedAt;
        list += `file '${name}'\nduration ${Math.max(next - frame.ts, 0.001).toFixed(4)}\n`;
    }
    list += `file 'f${String(frames.length - 1).padStart(5, '0')}.jpg'\n`;
    await writeFile(path.join(dir, 'list.txt'), list);

    execFileSync(FFMPEG, [
        '-y', '-loglevel', 'error',
        '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'),
        '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
        '-vf', 'fps=30,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x0B1A2B,format=yuv420p',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-profile:v', 'high', '-g', '60', '-keyint_min', '60', '-sc_threshold', '0',
        '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-shortest',
        '-movflags', '+faststart', path.resolve(output),
    ], { stdio: 'inherit' });
    await rm(dir, { recursive: true });
    console.log(`${output} (${frames.length} cuadros, ${(stoppedAt - frames[0].ts).toFixed(1)} s)`);
}
