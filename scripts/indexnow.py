#!/usr/bin/env python3
"""Avisa a los buscadores que usan IndexNow (Bing, Yandex, Seznam, Naver) de las páginas que cambiaron en el último commit.
Es gratuito y no requiere cuenta. Un fallo no detiene la publicación."""
import json
import subprocess
import urllib.request

SITIO = 'https://urgenciaskast.cl'
CLAVE = '8056ca8fc823a6d305f2ee65556d94f4'
EXCLUIR = ('fuente/', '404.html', 'proyecto.html')


def main():
    try:
        cambios = subprocess.run(['git', 'diff', '--name-only', 'HEAD~1', 'HEAD'], capture_output=True, text=True, check=True).stdout.split()
    except Exception as e:
        print('IndexNow: sin historial', e)
        return
    urls = []
    for f in cambios:
        if not f.endswith('.html') or f.startswith(EXCLUIR[0]) or f in EXCLUIR[1:]:
            continue
        urls.append(SITIO + '/' + ('' if f == 'index.html' else f))
    urls = urls[:1000]
    if not urls:
        print('IndexNow: sin páginas nuevas.')
        return
    datos = json.dumps({'host': 'urgenciaskast.cl', 'key': CLAVE, 'keyLocation': f'{SITIO}/{CLAVE}.txt', 'urlList': urls}).encode()
    req = urllib.request.Request('https://api.indexnow.org/IndexNow', data=datos, headers={'Content-Type': 'application/json; charset=utf-8'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print(f'IndexNow: {len(urls)} URL enviadas, respuesta {r.status}.')
    except Exception as e:
        print('IndexNow no disponible:', e)


if __name__ == '__main__':
    main()
