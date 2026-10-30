// Reel «Vendés, cobrás y facturás»: una venta en el punto de venta de
// KudeExpress, del lector de código de barras a la factura electrónica.
//
// Necesita KudeExpress en BASE con la empresa demo (LandingDemoSeeder): la
// cajera con su turno abierto y los productos de ferretería con código de
// barras. La cola en database (QUEUE_CONNECTION=database), así el envío a la
// DNIT queda en espera y no se intenta durante la grabación. Nunca contra una
// base con datos reales.
//
//   FFMPEG=/ruta/a/ffmpeg node scripts/grabaciones/punto-de-venta.mjs <salida.mp4>
//
// Variables: BASE (http://localhost:8123), CASHIER_EMAIL, DEMO_PASSWORD.

import { recordReel } from './reel.mjs';

// Códigos de barras de la demo: cemento Portland 50 kg y martillo carpintero.
const CEMENT = '7841000000000';
const HAMMER = '7841000000017';

await recordReel({
    output: process.argv[2] ?? 'reel.mp4',
    path: '/admin/pos-terminal',
    user: { email: process.env.CASHIER_EMAIL ?? 'ana@ejemplo.com.py', password: process.env.DEMO_PASSWORD ?? 'demo-kudeexpress' },
    header: { lead: 'Una venta,', accent: 'un paso.' },
    end: { lead: 'Tu mostrador,', accent: 'con factura electrónica.', line: 'Punto de venta, caja por cajero y stock en un solo sistema.' },
}, async ({ page, pause, caption, pointAt, clickOn }) => {
    const search = page.getByPlaceholder(/Escaneá un código de barras/);
    const scan = async (code) => {
        await search.fill('');
        await search.pressSequentially(code, { delay: 25 });
        await search.press('Enter');
        await pause(700);
    };

    // 1. El lector de código de barras.
    await pause(300);
    await caption('Pasás el <b>lector de código</b>');
    await pointAt(search);
    await scan(CEMENT);
    await scan(CEMENT);
    await scan(HAMMER);
    await pause(600);

    // 2. El carrito.
    await caption('El total se arma <b>solo</b>');
    await pointAt(page.getByText('Total', { exact: true }));
    await pause(1700);

    // 3. Cobrar.
    await caption('Efectivo, tarjeta, <b>QR</b> o transferencia', { top: true });
    await clickOn(page.getByRole('button', { name: 'Cobrar', exact: true }));
    await pause(900);
    await clickOn(page.getByRole('button', { name: 'Efectivo', exact: true }));
    await pause(500);

    // 4. El vuelto.
    const cash = page.locator('input:visible').last();
    await caption('Te paga con 200.000: <b>el vuelto, calculado</b>', { top: true });
    await pointAt(cash);
    await cash.fill('');
    await cash.pressSequentially('200000', { delay: 90 });
    await cash.blur();
    await pause(1800);

    // 5. La factura.
    await caption('Y la <b>factura electrónica</b> sale sola');
    await clickOn(page.getByRole('button', { name: /^Cobrar \d/ }));
    await page.getByText('Venta emitida').waitFor({ timeout: 30000 });
    await pause(2600);
});
