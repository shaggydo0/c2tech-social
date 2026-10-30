# CLAUDE.md — c2tech-social

Este repo publica en la página de Facebook **C2 Tech** y en Instagram **@c2techpy**. Lo que está en `main` se publica solo a su hora (GitHub Actions, `scripts/publish.py`). Cómo funciona por dentro: `README.md`.

Todo el contenido es de **KudeExpress** (facturación electrónica y gestión para pymes de Paraguay), un servicio de C2 Tech. El objetivo es conseguir **clientes que pagan** el Plan Completo.

## La tarea de los jueves

Una rutina de Claude en la nube corre los jueves y prepara **la semana siguiente** (de lunes a viernes):

1. Calculá el lunes siguiente a hoy. Esa es «la semana».
2. Si en `posts/` ya hay carpetas con fechas de esa semana, no las toques: completá sólo los días que falten. Si no falta ninguno, terminá sin abrir PR.
3. Buscá la semana en `plan/calendario.md` y armá cada post fijo (carrusel, placa). Los marcados **grabación local** NO los hagas: van en una sesión aparte; nombralos en el PR como pendientes.
4. Por cada post, una carpeta `posts/AAAA-MM-DD-slug/` con:
   - `post.yml` (ver el formato en `README.md`), `publish_at` a las **12:00** de Paraguay (`T12:00:00-03:00`). Sólo se admiten 12:00 y 19:00.
   - `design/<nombre>-N.html`: una mesa por imagen. **Copiá la estructura y el estilo de los diseños que ya existen** (`posts/2026-11-02-ya-te-toca/design/` y `posts/2026-11-06-cobrar/design/`): el mismo esqueleto `.dc.html`, el logo como `/_blob/78f592d7d656f981a1732efaa925c8c7`, Plus Jakarta Sans, 1080×1350.
5. Instalá y generá: `npm ci && npx playwright install --with-deps chromium && npm run render -- <slug> [<slug>…]`.
6. **Mirá cada JPEG generado** (leelo como imagen) antes de seguir: texto cortado, que se salga de la placa, solapado o ilegible = corregir el HTML y volver a generar.
7. `pip install -r requirements.txt && python3 scripts/publish.py --check` tiene que pasar.
8. Rama `semana-AAAA-MM-DD` (el lunes), commit y PR contra `main` con título `Semana del D al D de mes`. En el cuerpo: tabla día / post / carpeta, los pendientes de grabación local y cualquier supuesto que hayas tenido que hacer. **Nunca mergees**: aprobar es de Rodrigo.

## Reglas que no se discuten

- **Sin firma y sin links de sesión**: ni «Generated with Claude Code» ni `claude.ai/code/session_…` en PR ni commits, y sin líneas `Co-Authored-By` ni `Claude-Session`.
- **No toques** `scripts/`, `.github/`, `package*.json`, `requirements.txt`, `assets/` ni posts de semanas anteriores. Sólo agregás carpetas en `posts/` (y, si hace falta, notas en `plan/`).
- **No inventes nada**: ni números de clientes, ni testimonios, ni nombres de empresas, ni funciones. Lo que KudeExpress hace está en la lista de abajo; si un post del calendario necesita un dato que no está acá, no lo hagas y explicalo en el PR.
- **No repitas** lo ya publicado (lista abajo y todo lo que hay en `posts/`).

## Marca y estilo

- La marca se escribe **KudeExpress**, junto. C2 Tech no hace falta nombrarlo en las placas.
- **WhatsApp: 0987 800 032** (nunca otro número). Web: kudeexpress.com.
- Voseo paraguayo, frases cortas, sin jerga técnica en las placas («factura», no «DE»; «la DNIT», no «SIFEN» salvo en contenido educativo).
- Precio: **Gs. 275.000 por mes, IVA incluido**, hasta 300 facturas por mes (Gs. 600 cada una extra). Guaraníes **sin decimales** y con punto de miles.
- Colores: azul marino `#0B1A2B`, cian `#08D8E5`, naranja `#FC9320`, fondo claro `#F4F7FB`, gris texto `#44566B`, verde azulado `#0B8F98`, naranja oscuro `#E0710A`. Tipografía Plus Jakarta Sans. Sin emoji en las placas.
- Portada y cierre de un carrusel en azul marino; las placas del medio en claro, como los ejemplos.
- Pie de foto: 2 a 4 frases, termina con «Escribinos al 0987 800 032» o «Consultas al 0987 800 032», y una línea de hashtags: `#KudeExpress #FacturaciónElectrónica` + 1 a 3 del tema (`#SIFEN #DNIT #PyMEsParaguay #Cobranzas #PuntoDeVenta`…). Máximo 2.200 caracteres.

## Lo que KudeExpress hace (sólo esto se puede afirmar)

- Los 7 documentos electrónicos de la DNIT (factura, nota de crédito, nota de débito, nota de remisión, autofactura, factura de importación y de exportación), firmados y enviados. Retransmisión con el mismo número si la DNIT rechaza; anulación dentro de las 48 horas; KUDE en PDF con el logo de la empresa; el cliente recibe el KUDE y el XML por correo al aprobarse.
- Si la DNIT no responde, el envío se reintenta solo y la venta no se frena.
- Punto de venta con lector de código de barras, cobro en varios medios (efectivo, tarjeta, QR, transferencia, cheque), ticket térmico de 80 mm con la impresora que ya tienen; turnos de caja por cajero con arqueo por medio de pago.
- Presupuestos y pedidos de mostrador; listas de precios.
- Stock por depósito que se mueve solo con cada venta y compra, kardex, costo promedio.
- Compras, proveedores y gastos con su crédito fiscal; órdenes de pago.
- Cuentas a cobrar con cuotas, recibos de dinero, estado de cuenta, antigüedad de la deuda, seguimiento de mora, recordatorios por correo.
- Facturación recurrente: suscripciones que facturan solas cada mes y facturación masiva (una factura por cliente desde una configuración).
- Tablero de ventas, margen e IVA; libro IVA de ventas y compras; sucursales; roles y permisos; exportación a Excel.
- API REST y webhooks para facturar desde otro sistema (planes sólo API desde Gs. 180.000).
- Funciona en el navegador, sin instalar nada. Ayudamos sin costo con el certificado digital y el CSC.

## Datos de SIFEN que se pueden usar (RG DNIT N.° 52/2026)

- Grupos de facturadores electrónicos obligatorios: **21 → 1 de diciembre de 2026**, **22 → 2 de marzo de 2027**, 23 → 1 de junio de 2027, 24 → 1 de setiembre de 2027.
- La DNIT avisa por el Buzón Tributario Marandu y publica la lista de cada grupo en dnit.gov.py.
- Al día siguiente de la fecha de inicio, el timbrado de papel (preimpreso o autoimpreso) pierde vigencia; antes hay que informar la numeración usada.
- Prórroga: una sola vez, hasta 3 meses, pedida con al menos 30 días hábiles de anticipación, sólo para quien se suma con un sistema (no con la solución gratuita de la DNIT), con un cronograma firmado por el contribuyente y su proveedor de software.
- La DNIT tiene una solución gratuita (e-Kuatia'i) para facturar de a una; nunca hablar mal de ella: decir lo que KudeExpress suma (stock, caja, cobranzas, facturación recurrente).

## Ya publicado (no repetir)

Lanzamiento de C2 Tech (presentación, dos productos, KudeExpress, los 7 documentos, Sendflow, Sendflow en equipo, API, contacto) y las piezas de KudeExpress: «Cumplís con la DNIT», «Una sola carga», «Rechazo de la DNIT», «Precio», carrusel «4 cosas que hace por vos», historias «Probalo gratis» y «¿Y si la DNIT se cae?», «API», «Impresora térmica», «Solo facturar», y las promos. Además, todo lo que está en `posts/`.
