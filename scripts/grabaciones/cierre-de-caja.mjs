// Reel «Cerrá la caja sin planilla»: la cajera cierra su turno, declara lo que
// contó por medio de pago y el arqueo muestra la diferencia en el acto.
//
// Necesita KudeExpress en BASE con la empresa demo (LandingDemoSeeder): la
// cajera con su turno de hoy abierto y ventas en efectivo, débito y
// transferencia. Declara el efectivo esperado menos FALTANTE y los demás medios
// exactos (los lee del modal). Nunca contra una base con datos reales.
//
//   FFMPEG=/ruta/a/ffmpeg node scripts/grabaciones/cierre-de-caja.mjs <salida.mp4>
//
// Variables: BASE (http://localhost:8123), CASHIER_EMAIL, DEMO_PASSWORD, FALTANTE (5000), SESSION (2).

import { recordReel } from './reel.mjs';

const SHORTAGE = Number(process.env.FALTANTE ?? 5000);
// El turno abierto de la cajera en la demo recién sembrada.
const SESSION = process.env.SESSION ?? '2';
const gs = (text) => Number(String(text).replace(/\D/g, ''));
const dots = (n) => n.toLocaleString('es-PY').replace(/,/g, '.');

await recordReel({
    output: process.argv[2] ?? 'reel.mp4',
    path: '/admin/cash-session-resource/cash-sessions',
    user: { email: process.env.CASHIER_EMAIL ?? 'ana@ejemplo.com.py', password: process.env.DEMO_PASSWORD ?? 'demo-kudeexpress' },
    header: { lead: 'Cerrá la caja', accent: 'sin planilla.' },
    end: { lead: '¿Al cerrar la caja nunca te da?', accent: 'Ahora lo sabés.', line: 'Turnos por cajero, arqueo por medio de pago y factura electrónica en un solo sistema.' },
}, async ({ page, pause, caption, pointAt, clickOn, scrollTo, resetCursor }) => {
    // 1. El turno abierto de la cajera.
    await pause(300);
    await caption('Cada cajero, <b>su turno</b>');
    const row = page.locator('tbody tr').first();
    await pointAt(row.locator('td').first());
    await pause(1200);

    // 2. Las acciones de la fila están plegadas detrás de la flecha de la derecha.
    // La flecha «‹» queda pegada al borde derecho de la tabla, a la altura de la fila.
    const box = await row.boundingBox();
    const toggle = [page.viewportSize().width - 36, box.y + box.height / 2];
    await page.evaluate(([x, y]) => window.reel.cursor(x, y), toggle);
    await pause(800);
    await page.evaluate(() => window.reel.click());
    await page.mouse.click(toggle[0], toggle[1]);
    await pause(700);
    await caption('Al terminar, <b>Cerrar (arqueo)</b>');
    await clickOn(page.getByRole('button', { name: 'Cerrar (arqueo)' }));
    await pause(900);

    // 3. Lo que el sistema espera, medio por medio.
    const modal = page.locator('.fi-modal-window');
    await caption('El sistema ya sabe <b>cuánto tiene que haber</b>', { top: true });
    const expectedCash = gs(await modal.getByText(/^\s*[\d.]+ Gs\s*$/).first().innerText());
    await pointAt(modal.getByText('Efectivo calculado por el sistema'));
    await pause(1400);

    // 4. Lo que contó la cajera.
    await caption('Cargás lo que <b>contaste</b>', { top: true });
    const cash = modal.getByLabel('Efectivo contado (declarado)');
    await pointAt(cash);
    await cash.pressSequentially(String(expectedCash - SHORTAGE), { delay: 80 });
    // Los demás medios, exactos: cada «Esperado: …» va debajo de su campo, en el mismo orden.
    const others = await modal.getByRole('textbox', { name: /declarado/ }).all();
    const expected = await modal.getByText(/Esperado:/).allInnerTexts();
    if (expected.length === 0 || expected.some((t) => !gs(t))) throw new Error(`No se leyeron los esperados: ${expected}`);
    const cashId = await cash.getAttribute('id');
    let n = 0;
    for (const field of others) {
        if ((await field.getAttribute('id')) === cashId) continue;
        await pointAt(field);
        await field.pressSequentially(String(gs(expected[n++])), { delay: 45 });
    }
    await pause(600);

    // 5. Cerrar: la diferencia aparece en el acto (abajo: arriba sale el aviso del panel).
    await caption(`¿Faltan ${dots(SHORTAGE)}? <b>Lo ves en el acto</b>`);
    await clickOn(modal.getByRole('button', { name: 'Enviar' }));
    await page.getByText('Caja cerrada').waitFor({ timeout: 30000 });
    await pause(2200);

    // 6. El arqueo por medio de pago.
    await page.goto(new URL(`/admin/cash-session-resource/cash-sessions/${SESSION}`, page.url()).href, { waitUntil: 'networkidle' });
    await resetCursor(360, 1000);
    await caption('Esperado, declarado y diferencia, <b>por medio de pago</b>');
    await scrollTo(page.getByText('Cierre por medio', { exact: true }), 200);
    await pause(3000);
});
