// Reel «120 facturas, un clic»: graba la facturación masiva del panel de
// KudeExpress sobre la empresa demo y deja el MP4 vertical (1080×1920, H.264)
// listo para Instagram y Facebook.
//
// Necesita KudeExpress corriendo en BASE con la empresa demo
// (LandingDemoSeeder) más una facturación masiva «Cuotas del instituto» de 120
// clientes, sin ejecuciones. Nunca contra una base con datos reales.
//
//   FFMPEG=/ruta/a/ffmpeg node scripts/grabaciones/facturacion-masiva.mjs <salida.mp4>
//
// Variables: BASE (http://localhost:8123), BILLING (1), DEMO_EMAIL, DEMO_PASSWORD.

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BASE = (process.env.BASE ?? 'http://localhost:8123').replace(/\/$/, '');
const BILLING = process.env.BILLING ?? '1';
const EMAIL = process.env.DEMO_EMAIL ?? 'laura@ejemplo.com.py';
const PASSWORD = process.env.DEMO_PASSWORD ?? 'demo-kudeexpress';
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const output = path.resolve(process.argv[2] ?? 'reel.mp4');

const logo = `data:image/png;base64,${(await readFile(path.join(root, 'assets/kudeexpress-logo.png'))).toString('base64')}`;

// Encabezado de marca, textos, puntero y placa final. Se inyecta en cada
// página (la ejecución es una navegación nueva) y se maneja con window.reel.
const overlay = `
(() => {
  const css = \`
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&display=swap');
    .fi-topbar, .fi-breadcrumbs, .fi-no { display: none !important; }
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
    #reel-cap b { color: #08D8E5; }
    #reel-cursor { position: fixed; left: 360px; top: 760px; width: 34px; height: 34px; z-index: 10000;
      transition: left .7s cubic-bezier(.4,0,.2,1), top .7s cubic-bezier(.4,0,.2,1); pointer-events: none; }
    #reel-cursor svg { filter: drop-shadow(0 2px 3px rgba(0,0,0,.35)); }
    #reel-cursor::after { content: ''; position: absolute; left: -14px; top: -14px; width: 28px; height: 28px; border-radius: 50%;
      border: 3px solid #FC9320; opacity: 0; transform: scale(.4); }
    #reel-cursor.click::after { animation: reel-ring .5s ease-out; }
    @keyframes reel-ring { 0% { opacity: 1; transform: scale(.4); } 100% { opacity: 0; transform: scale(1.8); } }
    #reel-end { position: fixed; inset: 0; background: #0B1A2B; z-index: 10001; opacity: 0; transition: opacity .5s ease;
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
        <h1>120 facturas, <span>un clic.</span></h1></div>
      <div id="reel-cap"></div>
      <div id="reel-cursor"><svg width="34" height="34" viewBox="0 0 24 24"><path d="M4 2l15 11-6.5 1.2L16 21l-3 1.4-3.6-6.9L4 20z" fill="#fff" stroke="#0B1A2B" stroke-width="1.6" stroke-linejoin="round"/></svg></div>
      <div id="reel-end"><div class="brand"><img src="${logo}" alt=""><span>Kude<b>Express</b></span></div>
        <h2>Tus cuotas del mes, <span>facturadas en un clic.</span></h2>
        <p>Facturación electrónica, cobranzas, stock y caja en un solo sistema.</p>
        <div class="cta">WhatsApp 0987 800 032</div></div>\`);
  };
  window.reel = {
    caption(html) {
      const cap = document.getElementById('reel-cap');
      if (!html) { cap.classList.remove('on'); return; }
      cap.classList.remove('on');
      setTimeout(() => { cap.innerHTML = html; cap.classList.add('on'); }, html && cap.innerHTML ? 250 : 0);
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

const browser = await chromium.launch();
const context = await browser.newContext({
    viewport: { width: 720, height: 1280 },
    deviceScaleFactor: 1.5,
    colorScheme: 'light',
    locale: 'es-PY',
});

const login = await context.newPage();
await login.goto(`${BASE}/admin/login`);
await login.locator('input[type="email"]').fill(EMAIL);
await login.locator('input[type="password"]').fill(PASSWORD);
await login.locator('form button[type="submit"]').click();
await login.waitForURL((url) => !url.pathname.endsWith('/login'));
await login.close();

await context.addInitScript(overlay);
const page = await context.newPage();
await page.goto(`${BASE}/admin/bulk-billing-resource/bulk-billings/${BILLING}`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(600);

// Cuadros del screencast con su hora: se arma el video con la duración real de cada uno.
const frames = [];
const cdp = await context.newCDPSession(page);
cdp.on('Page.screencastFrame', (frame) => {
    frames.push({ ts: frame.metadata.timestamp, data: frame.data });
    cdp.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {});
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1 });

const pause = (ms) => page.waitForTimeout(ms);
const caption = (html) => page.evaluate((h) => window.reel.caption(h), html);
async function pointAt(locator) {
    const box = await locator.boundingBox();
    await page.evaluate(([x, y]) => window.reel.cursor(x, y), [box.x + box.width * 0.55, box.y + box.height * 0.6]);
    await pause(800);
}
async function clickOn(locator) {
    await pointAt(locator);
    await page.evaluate(() => window.reel.click());
    await pause(250);
    await locator.click();
}
async function scrollTo(locator, offset = 200) {
    await page.evaluate(([y]) => window.scrollTo({ top: y, behavior: 'smooth' }), [
        (await locator.evaluate((el) => el.getBoundingClientRect().top + window.scrollY)) - offset,
    ]);
    await pause(900);
}

// 1. La facturación, con sus 120 clientes.
await pause(300);
await caption('Tus <b>120 alumnos</b>, cargados una vez');
await pause(2300);

// 2. Generar facturas.
await caption('Un clic en <b>Generar facturas</b>');
await clickOn(page.getByRole('button', { name: 'Generar facturas' }).first());
await pause(900);

// 3. La referencia del mes.
const reference = page.getByRole('textbox', { name: /Referencia/ });
await caption('Elegís el mes');
await pointAt(reference);
await reference.fill('');
await reference.pressSequentially('noviembre 2026', { delay: 70 });
await reference.blur();
await pause(1600);

// 4. Generar.
await caption('120 clientes, <b>₲ 42.000.000</b>');
await pause(1500);
await clickOn(page.getByRole('button', { name: 'Generar', exact: true }));
await page.waitForURL(/ejecuciones/, { timeout: 120000 });
await page.waitForLoadState('networkidle');
await page.evaluate(() => window.reel.cursor(360, 900, true));
await pause(300);

// 5. El resultado.
await caption('<b>120 facturas</b> listas, en segundos');
await scrollTo(page.getByText('Resultado', { exact: true }), 190);
await pause(2200);

// 6. La lista.
await caption('Una por cliente, con su número');
await scrollTo(page.locator('.fi-ta-table').first(), 230);
await pause(2000);

// 7. Emitirlas todas.
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
await pause(800);
await caption('Y las emitís todas <b>ante la DNIT</b>');
await pointAt(page.getByRole('button', { name: /Emitir borradores/ }));
await page.evaluate(() => window.reel.click());
await pause(1800);

// 8. Placa final.
await caption('');
await page.evaluate(() => window.reel.end());
await pause(3200);

const stoppedAt = Date.now() / 1000;
await cdp.send('Page.stopScreencast');
await browser.close();

// Video: cada cuadro dura hasta el siguiente; el último, hasta el final de la grabación.
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
    '-movflags', '+faststart', output,
], { stdio: 'inherit' });
await rm(dir, { recursive: true });
console.log(`${output} (${frames.length} cuadros, ${(stoppedAt - frames[0].ts).toFixed(1)} s)`);
