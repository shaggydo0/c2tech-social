// Reel «120 facturas, un clic»: la facturación masiva del panel de KudeExpress.
//
// Necesita KudeExpress en BASE con la empresa demo (LandingDemoSeeder) más una
// facturación masiva «Cuotas del instituto» de 120 clientes, sin ejecuciones, y
// la cola en sync (QUEUE_CONNECTION=sync) para que «Generar» termine en el acto.
// Nunca contra una base con datos reales.
//
//   FFMPEG=/ruta/a/ffmpeg node scripts/grabaciones/facturacion-masiva.mjs <salida.mp4>
//
// Variables: BASE (http://localhost:8123), BILLING (1), DEMO_EMAIL, DEMO_PASSWORD.

import { recordReel } from './reel.mjs';

await recordReel({
    output: process.argv[2] ?? 'reel.mp4',
    path: `/admin/bulk-billing-resource/bulk-billings/${process.env.BILLING ?? '1'}`,
    user: { email: process.env.DEMO_EMAIL ?? 'laura@ejemplo.com.py', password: process.env.DEMO_PASSWORD ?? 'demo-kudeexpress' },
    header: { lead: '120 facturas,', accent: 'un clic.' },
    end: { lead: 'Tus cuotas del mes,', accent: 'facturadas en un clic.', line: 'Facturación electrónica, cobranzas, stock y caja en un solo sistema.' },
}, async ({ page, pause, caption, pointAt, clickOn, scrollTo, resetCursor }) => {
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
    await resetCursor();
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
});
