# c2tech-social

Publicaciones de C2 Tech (KudeExpress y Sendflow) en Facebook e Instagram, en automático.

## Cómo funciona

1. Claude prepara cada semana un PR con los posts: una carpeta por post en `posts/`.
2. **Aprobar es mergear el PR.** Para pedir un cambio, se comenta en el PR. Lo que está en `main` está aprobado.
3. La tarea «Publicar» (GitHub Actions) corre a las 12:05 y a las 19:05 de Paraguay y publica lo que ya tiene la hora cumplida: un post se programa a las 12:00 o a las 19:00. Corre sólo dos veces por día porque los minutos gratis de Actions los comparte toda la cuenta. Sube las imágenes a Cloudflare R2 (`media.c2tech.com.py`), porque Instagram las descarga de una dirección pública.
4. Lo publicado queda anotado en `posts/<slug>/published.json`, por red. Si falla una red, la siguiente corrida reintenta sólo esa.

## Un post

```
posts/2026-11-02-ya-te-toca/
  post.yml          # cuándo, dónde y el texto
  design/*.html     # los diseños (copias del lienzo de Claude)
  *.jpg             # lo que se publica, generado desde design/
  published.json    # lo escribe la tarea al publicar
```

```yaml
publish_at: 2026-11-02T12:00:00-03:00   # siempre con zona horaria
kind: carousel                           # image | carousel | reel
networks: [facebook, instagram]          # por defecto, las dos
images: [sifen-1.jpg, sifen-2.jpg]
caption: |
  Texto del post.
```

## Comandos

```bash
npm install && npx playwright install chromium   # una vez
npm run render -- <slug>                         # diseños → JPEG
pip install -r requirements.txt
npm run check                                    # valida todos los posts
```

Publicar uno ya, sin esperar su hora: Actions → Publicar → Run workflow, con el nombre de la carpeta.
Probar el token y R2 sin publicar: lo mismo, marcando «Sólo probar».

## Secretos (Settings → Secrets and variables → Actions)

| Nombre | Qué es |
| --- | --- |
| `META_TOKEN` | token sin vencimiento del usuario del sistema de la cartera C2 TECH E.A.S. |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | clave de R2 limitada al bucket `c2tech-social` |
| `R2_ENDPOINT` | `https://<id-de-cuenta>.r2.cloudflarestorage.com` |

Variable opcional: `META_PAGE_ID`, si el token ve más de una página. Sin `META_TOKEN` la tarea no publica nada y termina bien.

## Límites

- Instagram: sólo JPEG, hasta 2.200 caracteres y 30 hashtags; acá los carruseles van de 2 a 10 imágenes.
- Reels: `kind: reel`, `video: reel.mp4` (H.264, 9:16, de 3 a 90 s, audio AAC 48 kHz) y `cover:` opcional (JPEG). En Facebook van por la Reels Publishing API.

## Grabaciones del panel

`scripts/grabaciones/` graba el panel de KudeExpress sobre la empresa demo (`LandingDemoSeeder`), nunca sobre datos reales, y deja el MP4 vertical listo. Cada script dice qué datos necesita la demo. Hace falta `ffmpeg` con libx264 (`FFMPEG=/ruta/a/ffmpeg`).

```bash
FFMPEG=… node scripts/grabaciones/facturacion-masiva.mjs posts/<slug>/reel.mp4
```
