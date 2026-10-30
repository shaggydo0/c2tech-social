// Convierte los diseños de un post (posts/<slug>/design/*.html) en los JPEG
// que se publican (posts/<slug>/<nombre>.jpg).
//
// Los diseños son copias de las mesas de trabajo del lienzo «KudeExpress —
// Publicaciones» de Claude: se renderizan tal cual, cambiando el logo del
// lienzo (/_blob/…) por assets/kudeexpress-logo.png.
//
//   node scripts/render.mjs                 # todos los posts
//   node scripts/render.mjs <slug> [<slug>] # sólo esos

import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const logo = pathToFileURL(path.join(root, 'assets/kudeexpress-logo.png')).href;

const slugs = process.argv.slice(2);
const folders = slugs.length ? slugs : (await readdir(path.join(root, 'posts')));

const browser = await chromium.launch();
const page = await browser.newPage();

for (const slug of folders) {
    const designDir = path.join(root, 'posts', slug, 'design');
    if (!existsSync(designDir)) continue;

    for (const file of (await readdir(designDir)).filter((f) => f.endsWith('.html')).sort()) {
        let html = await readFile(path.join(designDir, file), 'utf8');
        html = html
            .replace('<script src="./support.js"></script>', '')
            .replaceAll(/\/_blob\/[0-9a-f]{32}/g, logo);

        const preview = html.match(/"\$preview":\{"width":(\d+),"height":(\d+)\}/);
        const [width, height] = preview ? [Number(preview[1]), Number(preview[2])] : [1080, 1350];

        await page.setViewportSize({ width, height });
        await page.setContent(html, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);

        const out = path.join(root, 'posts', slug, file.replace(/\.html$/, '.jpg'));
        await page.locator('x-dc > div').first().screenshot({ path: out, type: 'jpeg', quality: 92 });
        console.log(`${slug}/${path.basename(out)} (${width}×${height})`);
    }
}

await browser.close();
