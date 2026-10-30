"""Publica en Facebook e Instagram los posts aprobados cuya hora ya llegó.

Un post es una carpeta `posts/<slug>/` con `post.yml` y sus imágenes JPEG.
Lo que está en `main` está aprobado. Lo que ya salió queda anotado en
`posts/<slug>/published.json`, por red, así que un fallo en Instagram no
vuelve a publicar en Facebook.

Uso:
    python scripts/publish.py --check          # valida todos los posts, no publica
    python scripts/publish.py                  # publica lo vencido (necesita los secretos)
    python scripts/publish.py --only <slug>    # sólo ese post, aunque no haya llegado su hora
    python scripts/publish.py --verify         # prueba el token y R2 sin publicar nada

Variables de entorno (secretos de GitHub Actions):
    META_TOKEN            token del usuario del sistema de la cartera C2 TECH E.A.S.
    R2_ACCESS_KEY_ID      clave de R2 limitada al bucket
    R2_SECRET_ACCESS_KEY
    R2_ENDPOINT           https://<cuenta>.r2.cloudflarestorage.com
Opcionales:
    META_PAGE_ID          si el token ve más de una página
    R2_BUCKET             por defecto c2tech-social
    MEDIA_BASE_URL        por defecto https://media.c2tech.com.py
    GRAPH_VERSION         por defecto v23.0
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import time
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
POSTS = ROOT / 'posts'
NETWORKS = ('facebook', 'instagram')
KINDS = ('image', 'carousel')

# Límites de Instagram (documentación de Content Publishing).
CAPTION_MAX = 2200
HASHTAGS_MAX = 30
CAROUSEL_MAX = 10  # Instagram admite 20, Facebook arma bien hasta 10: usamos el menor.

# Las horas a las que corre la tarea Publicar (hora de Paraguay).
PUBLISH_TIMES = ('12:00', '19:00')


class PostError(Exception):
    pass


# --- Lectura y validación -------------------------------------------------


def load_post(folder: Path) -> dict:
    data = yaml.safe_load((folder / 'post.yml').read_text(encoding='utf-8')) or {}
    data['slug'] = folder.name
    data['folder'] = folder

    problems = []
    when = data.get('publish_at')
    if isinstance(when, str):
        try:
            when = dt.datetime.fromisoformat(when)
        except ValueError:
            problems.append(f'publish_at no es una fecha ISO: {when!r}')
    if isinstance(when, dt.datetime):
        if when.tzinfo is None:
            problems.append('publish_at necesita zona horaria (Paraguay es -03:00)')
        elif when.astimezone(dt.timezone(dt.timedelta(hours=-3))).strftime('%H:%M') not in PUBLISH_TIMES:
            problems.append(f"publish_at tiene que ser a las {' o a las '.join(PUBLISH_TIMES)} de Paraguay (la tarea corre sólo a esas horas)")
        data['publish_at'] = when
    else:
        problems.append('falta publish_at')

    if data.get('kind') not in KINDS:
        problems.append(f'kind tiene que ser uno de {KINDS}')

    networks = data.get('networks') or list(NETWORKS)
    unknown = set(networks) - set(NETWORKS)
    if unknown:
        problems.append(f'redes desconocidas: {sorted(unknown)}')
    data['networks'] = networks

    caption = (data.get('caption') or '').strip()
    if not caption:
        problems.append('falta caption')
    if len(caption) > CAPTION_MAX:
        problems.append(f'caption de {len(caption)} caracteres (máximo {CAPTION_MAX})')
    if caption.count('#') > HASHTAGS_MAX:
        problems.append(f'más de {HASHTAGS_MAX} hashtags')
    data['caption'] = caption

    images = data.get('images') or []
    if not images:
        problems.append('falta images')
    if data.get('kind') == 'image' and len(images) != 1:
        problems.append('un post image lleva exactamente una imagen')
    if data.get('kind') == 'carousel' and not 2 <= len(images) <= CAROUSEL_MAX:
        problems.append(f'un carrusel lleva de 2 a {CAROUSEL_MAX} imágenes')
    for name in images:
        path = folder / name
        if not path.is_file():
            problems.append(f'no existe {name}')
        elif path.suffix.lower() not in ('.jpg', '.jpeg'):
            problems.append(f'{name}: Instagram sólo acepta JPEG')
    data['images'] = images

    if problems:
        raise PostError(f'{folder.name}: ' + '; '.join(problems))
    return data


def all_posts() -> list[dict]:
    return [load_post(f) for f in sorted(POSTS.iterdir()) if (f / 'post.yml').is_file()]


def published_state(post: dict) -> dict:
    path = post['folder'] / 'published.json'
    return json.loads(path.read_text()) if path.is_file() else {}


def save_state(post: dict, state: dict) -> None:
    path = post['folder'] / 'published.json'
    path.write_text(json.dumps(state, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


# --- Imágenes en R2 -------------------------------------------------------


def upload_images(post: dict) -> list[str]:
    import boto3

    bucket = os.environ.get('R2_BUCKET', 'c2tech-social')
    base = os.environ.get('MEDIA_BASE_URL', 'https://media.c2tech.com.py').rstrip('/')
    s3 = boto3.client(
        's3',
        endpoint_url=os.environ['R2_ENDPOINT'],
        aws_access_key_id=os.environ['R2_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['R2_SECRET_ACCESS_KEY'],
        region_name='auto',
    )
    urls = []
    for name in post['images']:
        key = f"{post['slug']}/{name}"
        s3.upload_file(str(post['folder'] / name), bucket, key, ExtraArgs={'ContentType': 'image/jpeg'})
        urls.append(f'{base}/{key}')
    return urls


# --- Graph API ------------------------------------------------------------


class Graph:
    def __init__(self, token: str):
        import requests

        self.http = requests.Session()
        self.base = f"https://graph.facebook.com/{os.environ.get('GRAPH_VERSION', 'v23.0')}"
        self.token = token

    def call(self, method: str, path: str, token: str | None = None, **params) -> dict:
        params['access_token'] = token or self.token
        response = self.http.request(method, f'{self.base}/{path}', data=params if method == 'POST' else None,
                                     params=params if method == 'GET' else None, timeout=60)
        body = response.json()
        if 'error' in body:
            error = body['error']
            raise RuntimeError(f"Graph {path}: {error.get('message')} (código {error.get('code')})")
        return body

    def page(self) -> tuple[str, str, str | None]:
        """Página, su token de página y la cuenta de Instagram vinculada."""
        wanted = os.environ.get('META_PAGE_ID')
        pages = self.call('GET', 'me/accounts', fields='id,name,access_token').get('data', [])
        if wanted:
            pages = [p for p in pages if p['id'] == wanted]
        if len(pages) != 1:
            names = ', '.join(p['name'] for p in pages) or 'ninguna'
            raise RuntimeError(f'El token tiene que ver una sola página (ve: {names}); definí META_PAGE_ID')
        page = pages[0]
        ig = self.call('GET', page['id'], token=page['access_token'], fields='instagram_business_account')
        return page['id'], page['access_token'], (ig.get('instagram_business_account') or {}).get('id')

    # Facebook

    def facebook(self, page_id: str, page_token: str, post: dict, urls: list[str]) -> str:
        if post['kind'] == 'image':
            result = self.call('POST', f'{page_id}/photos', token=page_token, url=urls[0], message=post['caption'])
            return result.get('post_id') or result['id']
        media = []
        for url in urls:
            photo = self.call('POST', f'{page_id}/photos', token=page_token, url=url, published='false')
            media.append({'media_fbid': photo['id']})
        result = self.call('POST', f'{page_id}/feed', token=page_token, message=post['caption'],
                           attached_media=json.dumps(media))
        return result['id']

    # Instagram

    def _wait(self, container: str, token: str) -> None:
        # Meta recomienda consultar una vez por minuto, no más de 5 minutos.
        for _ in range(10):
            status = self.call('GET', container, token=token, fields='status_code')['status_code']
            if status == 'FINISHED':
                return
            if status in ('ERROR', 'EXPIRED'):
                raise RuntimeError(f'El contenedor {container} quedó en {status}')
            time.sleep(30)
        raise RuntimeError(f'El contenedor {container} no terminó de procesarse en 5 minutos')

    def instagram(self, ig_id: str, token: str, post: dict, urls: list[str]) -> str:
        if post['kind'] == 'image':
            container = self.call('POST', f'{ig_id}/media', token=token, image_url=urls[0],
                                  caption=post['caption'])['id']
        else:
            children = [
                self.call('POST', f'{ig_id}/media', token=token, image_url=url, is_carousel_item='true')['id']
                for url in urls
            ]
            for child in children:
                self._wait(child, token)
            container = self.call('POST', f'{ig_id}/media', token=token, media_type='CAROUSEL',
                                  children=','.join(children), caption=post['caption'])['id']
        self._wait(container, token)
        return self.call('POST', f'{ig_id}/media_publish', token=token, creation_id=container)['id']


# --- Verificación ---------------------------------------------------------

REQUIRED_SCOPES = {
    'pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'read_insights',
    'instagram_basic', 'instagram_content_publish', 'instagram_manage_insights',
    'business_management', 'ads_read', 'ads_management',
}


def verify() -> int:
    """Prueba lo que necesita una publicación, sin publicar nada."""
    ok = True

    if not os.environ.get('META_TOKEN'):
        print('FALTA el secret META_TOKEN')
        ok = False
    else:
        graph = Graph(os.environ['META_TOKEN'])
        try:
            granted = {p['permission'] for p in graph.call('GET', 'me/permissions').get('data', [])
                       if p.get('status') == 'granted'}
            missing = sorted(REQUIRED_SCOPES - granted)
            print('ok    permisos del token' if not missing else f"FALTAN permisos en el token: {', '.join(missing)}")
            ok = ok and not missing
        except Exception as error:  # noqa: BLE001
            print(f'ERROR al leer los permisos del token: {error}')
            ok = False
        try:
            page_id, page_token, ig_id = graph.page()
            page = graph.call('GET', page_id, token=page_token, fields='name')
            print(f"ok    página: {page['name']} ({page_id})")
            if ig_id:
                ig = graph.call('GET', ig_id, token=page_token, fields='username')
                print(f"ok    Instagram: @{ig['username']} ({ig_id})")
                limit = graph.call('GET', f'{ig_id}/content_publishing_limit', token=page_token, fields='quota_usage,config')
                print(f'ok    límite de publicación de Instagram: {limit.get("data", [{}])[0]}')
            else:
                print('FALTA la cuenta de Instagram vinculada a la página')
                ok = False
        except Exception as error:  # noqa: BLE001
            print(f'ERROR con la página o Instagram: {error}')
            ok = False

    r2 = ('R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_ENDPOINT')
    absent = [name for name in r2 if not os.environ.get(name)]
    if absent:
        print(f"FALTAN los secrets de R2: {', '.join(absent)}")
        ok = False
    else:
        import boto3
        import requests

        bucket = os.environ.get('R2_BUCKET', 'c2tech-social')
        base = os.environ.get('MEDIA_BASE_URL', 'https://media.c2tech.com.py').rstrip('/')
        key = f"_verificacion/{dt.datetime.now(dt.timezone.utc):%Y%m%d%H%M%S}.txt"
        s3 = boto3.client('s3', endpoint_url=os.environ['R2_ENDPOINT'],
                          aws_access_key_id=os.environ['R2_ACCESS_KEY_ID'],
                          aws_secret_access_key=os.environ['R2_SECRET_ACCESS_KEY'], region_name='auto')
        try:
            s3.put_object(Bucket=bucket, Key=key, Body=b'ok', ContentType='text/plain')
            response = requests.get(f'{base}/{key}', timeout=30)
            if response.status_code == 200 and response.text == 'ok':
                print(f'ok    R2: subida y lectura pública por {base}')
            else:
                print(f'ERROR R2: se subió pero {base}/{key} respondió {response.status_code}')
                ok = False
            s3.delete_object(Bucket=bucket, Key=key)
        except Exception as error:  # noqa: BLE001
            print(f'ERROR R2: {error}')
            ok = False

    return 0 if ok else 1


# --- Programa -------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true', help='sólo valida los posts')
    parser.add_argument('--only', help='publica sólo este post, aunque no haya llegado su hora')
    parser.add_argument('--verify', action='store_true', help='prueba el token y R2 sin publicar nada')
    args = parser.parse_args()

    if args.verify:
        return verify()

    try:
        posts = all_posts()
    except PostError as error:
        print(f'ERROR {error}')
        return 1

    if args.check:
        for post in posts:
            print(f"ok  {post['publish_at']:%Y-%m-%d %H:%M}  {post['kind']:<8}  {post['slug']}")
        return 0

    if not os.environ.get('META_TOKEN'):
        print('Sin META_TOKEN: no hay nada que publicar todavía.')
        return 0

    now = dt.datetime.now(dt.timezone.utc)
    due = []
    for post in posts:
        pending = [n for n in post['networks'] if n not in published_state(post)]
        if not pending:
            continue
        if args.only:
            if post['slug'] == args.only:
                due.append((post, pending))
        elif post['publish_at'] <= now:
            due.append((post, pending))

    if not due:
        print('Nada vencido.')
        return 0

    graph = Graph(os.environ['META_TOKEN'])
    page_id, page_token, ig_id = graph.page()
    failed = False

    for post, pending in due:
        state = published_state(post)
        try:
            urls = upload_images(post)
        except Exception as error:  # noqa: BLE001 — se informa y se sigue con el resto
            print(f"ERROR {post['slug']}: no se pudieron subir las imágenes: {error}")
            failed = True
            continue
        for network in pending:
            try:
                if network == 'facebook':
                    media_id = graph.facebook(page_id, page_token, post, urls)
                else:
                    if not ig_id:
                        raise RuntimeError('la página no tiene una cuenta de Instagram vinculada')
                    media_id = graph.instagram(ig_id, page_token, post, urls)
            except Exception as error:  # noqa: BLE001
                print(f"ERROR {post['slug']} en {network}: {error}")
                failed = True
                continue
            state[network] = {'id': media_id, 'at': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')}
            save_state(post, state)
            print(f"publicado {post['slug']} en {network}: {media_id}")

    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
