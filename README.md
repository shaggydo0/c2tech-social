# c2tech-social

Publicaciones de C2 Tech (KudeExpress y Sendflow) en Facebook e Instagram, en automático.

## Cómo funciona

1. Claude prepara cada semana un PR con los posts: una carpeta por post en `posts/`.
2. **Aprobar es mergear el PR.** Para pedir un cambio, se comenta en el PR. Lo que está en `main` está aprobado.
3. La tarea «Publicar» (GitHub Actions) corre cada 30 minutos entre las 8:00 y las 20:30 de Paraguay y publica lo que ya tiene la hora cumplida. Sube las imágenes a Cloudflare R2 (`media.kudeexpress.com`), porque Instagram las descarga de una dirección pública.
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
kind: carousel                           # image | carousel
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

## Secretos (Settings → Secrets and variables → Actions)

| Nombre | Qué es |
| --- | --- |
| `META_TOKEN` | token sin vencimiento del usuario del sistema de la cartera C2 TECH E.A.S. |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | clave de R2 limitada al bucket `c2tech-social` |
| `R2_ENDPOINT` | `https://<id-de-cuenta>.r2.cloudflarestorage.com` |

Variable opcional: `META_PAGE_ID`, si el token ve más de una página. Sin `META_TOKEN` la tarea no publica nada y termina bien.

## Límites

- Instagram: sólo JPEG, hasta 2.200 caracteres y 30 hashtags; acá los carruseles van de 2 a 10 imágenes.
- Los reels todavía no se publican desde acá: se suben a mano hasta que se sume el video al script.
