#!/usr/bin/env python3
"""Genera las páginas estáticas de Urgencias Kast.

    python scripts/paginas.py          páginas por proyecto, índice de fichas, feed y mapa del sitio
    python scripts/paginas.py --sitio  además, todas las páginas a partir de fuente/

Las páginas por proyecto (p/BOLETIN.html) llevan su propio título y descripción, para que
el enlace se vea bien al compartirlo. El contenido lo dibuja assets/app.js con los datos.
data/feed.json resume el sitio para que otros sitios de Lo Común lo muestren.
"""
import datetime as dt
import glob
import hashlib
import html
import json
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITIO = 'https://urgenciaskast.cl'
LOCOMUN = 'https://locomun.cl'


def ruta(*p):
    return os.path.join(RAIZ, *p)


def leer_json(r, defecto=None):
    try:
        with open(r, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return defecto


def escribir(r, texto):
    os.makedirs(os.path.dirname(r), exist_ok=True)
    with open(r, 'w', encoding='utf-8') as f:
        f.write(texto)


def esc(s):
    return html.escape(str(s or ''), quote=True)


def version():
    h = hashlib.sha1()
    for a in ('assets/estilo.css', 'assets/app.js', 'assets/config.js', 'assets/glosario.js'):
        try:
            with open(ruta(a), 'rb') as f:
                h.update(f.read())
        except OSError:
            pass
    return h.hexdigest()[:8]


SIMBOLO = ('<svg viewBox="0 0 48 48" aria-hidden="true"><polyline points="5,41 15,35 23,19 33,25 43,6" fill="none" '
           'stroke="#f6f0e2" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
           '<circle cx="5" cy="41" r="3.6" fill="#f6f0e2"/><circle cx="15" cy="35" r="3.6" fill="#f6f0e2"/>'
           '<circle cx="23" cy="19" r="3.6" fill="#f6f0e2"/><circle cx="33" cy="25" r="3.6" fill="#f6f0e2"/>'
           '<circle cx="43" cy="6" r="4.6" fill="#f2b42a"/></svg>')

NAV = [('agenda', 'agenda.html', 'Agenda'), ('urgencias', 'index.html#urgencias', 'Urgencias'),
       ('analisis', 'analisis.html', 'Prueba pública'), ('como-leer', 'como-leer.html', 'Cómo leer'),
       ('glosario', 'glosario.html', 'Glosario')]


def layout(cuerpo, *, base, titulo, descripcion, pagina, nav='', ruta_url='', og_tipo='website', og_titulo=None,
           attr_body='', v=''):
    menu = ''.join(f'<a href="{base}{href}"{" aria-current=\"page\"" if clave == nav else ""}>{texto}</a>' for clave, href, texto in NAV)
    menu += f'<a class="destacado" href="{base}asesoria.html"{" aria-current=\"page\"" if nav == "asesoria" else ""}>Asesoría</a>'
    return f'''<!doctype html>
<html lang="es" data-base="{base}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{esc(titulo)}</title>
<meta name="description" content="{esc(descripcion)}">
<link rel="canonical" href="{SITIO}/{ruta_url}">
<meta property="og:site_name" content="Urgencias Kast">
<meta property="og:title" content="{esc(og_titulo or titulo)}">
<meta property="og:description" content="{esc(descripcion)}">
<meta property="og:type" content="{og_tipo}">
<meta property="og:url" content="{SITIO}/{ruta_url}">
<meta property="og:image" content="{SITIO}/assets/compartir.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="es_CL">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#e4def7">
<link rel="icon" href="{base}assets/simbolo.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&amp;family=Montserrat:wght@500;600;700&amp;family=Figtree:wght@400;500;600&amp;display=swap">
<link rel="stylesheet" href="{base}assets/estilo.css?v={v}">
<script src="{base}assets/config.js?v={v}"></script>
<script src="{base}assets/glosario.js?v={v}"></script>
<script src="{base}assets/app.js?v={v}" defer></script>
</head>
<body data-pagina="{pagina}"{attr_body}>
<a class="saltar" href="#contenido">Ir al contenido</a>
<header class="cabecera">
  <div class="envoltura">
    <div class="marca"><a class="marca-logo" href="{base}index.html" aria-label="Urgencias Kast, inicio">{SIMBOLO}</a><span class="marca-textos"><a class="marca-nombre" href="{base}index.html">Urgencias Kast</a><a class="marca-firma" href="{LOCOMUN}" target="_blank" rel="noopener" title="Ir a locomun.cl (se abre en otra pestaña)">Una producción de Lo Común · Laboratorio Político y Estratégico</a></span></div>
    <nav class="menu" aria-label="Principal">{menu}</nav>
  </div>
</header>
<main id="contenido">
{cuerpo}
</main>
<footer class="pie">
  <div class="envoltura">
    <div class="firma-pie">{SIMBOLO}<div><p><b style="color:var(--t-base)">Urgencias Kast</b> es una producción pública de Lo Común: Laboratorio de Relato y Producción Narrativa.</p><p>No recibe financiamiento de actores políticos. Se sostiene con aportes voluntarios.</p><p>Contenido bajo licencia <a style="display:inline" href="https://creativecommons.org/licenses/by-sa/4.0/deed.es" rel="license">CC BY-SA 4.0</a>.</p></div></div>
    <nav aria-label="El sitio"><strong>El sitio</strong><a href="{base}agenda.html">Agenda de dos semanas</a><a href="{base}index.html#urgencias">Proyectos con urgencia</a><a href="{base}como-leer.html">Cómo leer Urgencias Kast</a><a href="{base}glosario.html">Glosario</a></nav>
    <nav aria-label="Lo Común"><strong>Lo Común</strong><a href="{base}asesoria.html">Asesoría</a><a href="{base}analisis.html">Prueba pública</a><a href="{base}aportar.html">Aportar</a><a href="{LOCOMUN}" rel="noopener">Sitio de Lo Común</a></nav>
    <div><strong>Datos y contacto</strong><a href="{base}data/urgencias.json">Urgencias (JSON)</a><a href="{base}data/agenda.json">Agenda (JSON)</a><p style="margin-top:8px">Correcciones y contacto: <b data-correo style="color:var(--crema)"></b></p></div>
  </div>
</footer>
</body>
</html>
'''


RE_META = re.compile(r'<!--meta\s+(\{.*?\})\s*-->', re.S)


def construir_sitio(v):
    analisis = entregas_todas()
    reemplazos = {'{{DESTACADO}}': destacado(analisis), '{{LISTA_ANALISIS}}': lista_analisis(analisis),
                  '{{GLOSARIO}}': glosario_html()}
    for fuente in sorted(glob.glob(ruta('fuente', '**', '*.html'), recursive=True)):
        rel = os.path.relpath(fuente, ruta('fuente')).replace(os.sep, '/')
        with open(fuente, encoding='utf-8') as f:
            texto = f.read()
        m = RE_META.search(texto)
        meta = json.loads(m.group(1)) if m else {}
        cuerpo = RE_META.sub('', texto).strip()
        for k, val in reemplazos.items():
            cuerpo = cuerpo.replace(k, val)
        base = '/' if rel == '404.html' else '../' * rel.count('/')
        cuerpo = cuerpo.replace('{{BASE}}', base)
        url = '' if rel == 'index.html' else rel
        escribir(ruta(rel), layout(cuerpo, base=base, titulo=meta.get('titulo', 'Urgencias Kast'), descripcion=meta.get('descripcion', ''),
                                   pagina=meta.get('pagina', 'texto'), nav=meta.get('nav', ''), ruta_url=url,
                                   og_tipo=meta.get('og_tipo', 'website'), og_titulo=meta.get('og_titulo'), v=v))
        print('Página', rel)


def entregas_todas():
    """Entregas de la serie: las alojadas aquí (data/analisis.json) y las que publica locomun.cl
    (data/locomun.json, copia del feed de Lo Común que la acción renueva cada tres horas)."""
    locales = leer_json(ruta('data', 'analisis.json'), {'entregas': []})['entregas']
    externas = (leer_json(ruta('data', 'locomun.json'), {}) or {}).get('publicaciones') or []
    todas = [dict(a) for a in locales]
    for e in externas:
        if not e.get('titulo') or not str(e.get('url', '')).startswith('https://'):
            continue
        if any(a.get('serie') == e.get('serie') and a.get('numero') == e.get('numero') for a in todas):
            continue
        todas.append({'serie': e.get('serie', 'Prueba pública'), 'numero': e.get('numero', ''), 'titulo': e['titulo'],
                      'autor': e.get('autor', ''), 'fecha': e.get('fecha', ''), 'fecha_texto': e.get('fecha_texto', ''),
                      'minutos': e.get('minutos'), 'resumen': e.get('resumen', ''), 'url': e['url']})
    todas.sort(key=lambda a: (a.get('fecha') or '', str(a.get('numero'))), reverse=True)
    return todas


def enlace_entrega(a):
    return ('{{BASE}}' + esc(a['ruta'])) if a.get('ruta') else esc(a['url'])


def tarjeta_entrega(a):
    externo = not a.get('ruta')
    rel = ' rel="noopener"' if externo else ''
    meta = ' · '.join(x for x in [a.get('autor'), a.get('fecha_texto'), f'Lectura de {a["minutos"]} minutos' if a.get('minutos') else '',
                                  'en locomun.cl' if externo else ''] if x)
    return (f'<article class="tarjeta destacado-analisis"><div class="lado"><p class="num-bloque">{esc(a["serie"])} · N.° {esc(a["numero"])}</p>'
            f'<h3><a href="{enlace_entrega(a)}"{rel}>{esc(a["titulo"])}</a></h3>'
            f'<p class="nota" style="color:var(--tinta-suave)">{esc(meta)}</p></div>'
            f'<div class="lado"><p>{esc(a["resumen"])}</p><a class="boton boton-indigo" href="{enlace_entrega(a)}"{rel}>Leer el análisis</a></div></article>')


def destacado(entregas):
    if not entregas:
        return ''
    anteriores = ''
    if len(entregas) > 1:
        enlaces = []
        for a in entregas[1:4]:
            rel = '' if a.get('ruta') else ' rel="noopener"'
            enlaces.append(f'<a href="{enlace_entrega(a)}"{rel}>N.° {esc(a["numero"])}, {esc(recortar(a["titulo"], 70))}</a>')
        anteriores = ('<p class="nota" style="margin-top:14px">Entregas anteriores: ' + ' · '.join(enlaces)
                      + ' · <a href="{{BASE}}analisis.html">Ver la serie</a></p>')
    return tarjeta_entrega(entregas[0]) + anteriores


def lista_analisis(entregas):
    return ''.join(tarjeta_entrega(a) for a in entregas)


def glosario_datos():
    return leer_json(ruta('data', 'glosario.json'), {'grupos': []})


def glosario_html():
    partes = []
    for g in glosario_datos()['grupos']:
        filas = ''.join(f'<div class="termino-def" id="{esc(k)}"><dt>{esc(v[0])}</dt><dd>{esc(v[1])}</dd></div>' for k, v in g['terminos'].items())
        partes.append(f'<article class="tarjeta"><div class="tarjeta-cuerpo prosa glosario"><h2>{esc(g["titulo"])}</h2><dl>{filas}</dl></div></article>')
    return ''.join(partes)


def construir_glosario_js():
    plano = {}
    for g in glosario_datos()['grupos']:
        plano.update(g['terminos'])
    escribir(ruta('assets', 'glosario.js'), '/* Generado desde data/glosario.json por scripts/paginas.py. */\nwindow.UK_GLOSARIO = '
             + json.dumps(plano, ensure_ascii=False, indent=1) + ';\n')


def recortar(s, n):
    s = re.sub(r'\s+', ' ', str(s or '')).strip()
    return s if len(s) <= n else s[:n - 1].rsplit(' ', 1)[0] + '…'


def indice_fichas():
    idx = {}
    for r in sorted(glob.glob(ruta('data', 'fichas', '*.json'))):
        if os.path.basename(r) == 'indice.json':
            continue
        f = leer_json(r)
        if f and f.get('version') == 2 and f.get('boletin'):
            idx[f['boletin']] = {'sintesis': f.get('sintesis', ''), 'nivel': f.get('nivel', ''), 'publicado': f.get('publicado', ''),
                                 'materia': f.get('materia', ''), 'revision': f.get('estado_revision', 'aprobada')}
    escribir(ruta('data', 'fichas', 'indice.json'), json.dumps(idx, ensure_ascii=False, indent=1) + '\n')
    return idx


def construir_fichas(v):
    urg = leer_json(ruta('data', 'urgencias.json'), {'proyectos': []})
    ag = leer_json(ruta('data', 'agenda.json'), {'proyectos': {}})
    idx = indice_fichas()
    proyectos = {p['boletin']: p for p in urg.get('proyectos', [])}
    for b, p in (ag.get('proyectos') or {}).items():
        proyectos.setdefault(b, p)
    boletines = set(proyectos) | set(idx)
    # Conserva las páginas ya publicadas aunque el proyecto salga del seguimiento: un enlace compartido no debe romperse.
    boletines |= {os.path.basename(r)[:-5] for r in glob.glob(ruta('p', '*.html'))}
    for b in sorted(boletines):
        p = proyectos.get(b) or {}
        f = idx.get(b) or {}
        titulo = f.get('sintesis') or p.get('titulo') or f'Boletín {b}'
        if f.get('sintesis'):
            desc = f'Boletín {b}. Resumen verificado, posiciones de las organizaciones y plazos de la urgencia, explicados.'
        else:
            urgv = (p.get('urgencia_vigente') or {}).get('tipo')
            desc = f'Boletín {b}' + (f', con urgencia {urgv.lower()}' if urgv else '') + '. Plazos, tramitación y fuentes oficiales, explicados.'
        cuerpo = '<div id="ficha"><div class="envoltura"><p class="vacio">Cargando la ficha…</p></div></div>'
        escribir(ruta('p', f'{b}.html'), layout(cuerpo, base='../', titulo=recortar(titulo, 88) + ' · Urgencias Kast', descripcion=desc,
                                               pagina='ficha', ruta_url=f'p/{b}.html', og_tipo='article', og_titulo=recortar(titulo, 120),
                                               attr_body=f' data-boletin="{esc(b)}"', v=v))
    print(f'Páginas por proyecto: {len(boletines)}')
    return urg, ag, idx, sorted(boletines)


def construir_feed(urg, ag, idx):
    hoy = dt.date.today()
    lim = (hoy + dt.timedelta(days=6)).isoformat()
    ps = urg.get('proyectos', [])

    def titulo(b):
        p = next((x for x in ps if x['boletin'] == b), None) or (ag.get('proyectos') or {}).get(b) or {}
        return p.get('titulo', '')

    vig = [p for p in ps if (p.get('urgencia_vigente') or {}).get('estado') == 'vigente' and (p['urgencia_vigente'].get('vence') or '') >= hoy.isoformat()]
    vig.sort(key=lambda p: p['urgencia_vigente']['vence'])
    sesiones = [s for s in (ag.get('sesiones') or []) if s.get('estado') != 'sin efecto' and s.get('boletines') and s['fecha'] <= lim]
    analisis = leer_json(ruta('data', 'analisis.json'), {'entregas': []})['entregas']  # solo las alojadas aquí
    feed = {
        'sitio': SITIO,
        'descripcion': 'Resumen de Urgencias Kast para otros sitios de Lo Común. Se actualiza cada tres horas.',
        'actualizado': urg.get('actualizado'),
        'conteos': {
            'urgencias_vigentes': len(vig),
            'discusion_inmediata': sum(1 for p in vig if p['urgencia_vigente'].get('tipo') == 'Discusión inmediata'),
            'vencen_7_dias': sum(1 for p in vig if p['urgencia_vigente']['vence'] <= lim),
            'citaciones_7_dias': len(sesiones),
        },
        'proximos_vencimientos': [{
            'boletin': p['boletin'], 'titulo': p['titulo'], 'sintesis': (idx.get(p['boletin']) or {}).get('sintesis', ''),
            'urgencia': p['urgencia_vigente'].get('tipo'), 'vence': p['urgencia_vigente']['vence'], 'url': f'{SITIO}/p/{p["boletin"]}.html'}
            for p in vig[:6]],
        'agenda': [{
            'fecha': s['fecha'], 'hora': s.get('hora', ''), 'camara': s.get('camara', ''), 'organo': s.get('organo', ''),
            'proyectos': [{'boletin': b, 'titulo': titulo(b), 'sintesis': (idx.get(b) or {}).get('sintesis', ''), 'url': f'{SITIO}/p/{b}.html'} for b in s['boletines']]}
            for s in sesiones[:12]],
        'fichas_recientes': sorted([{'boletin': b, 'sintesis': f['sintesis'], 'publicado': f.get('publicado', ''), 'url': f'{SITIO}/p/{b}.html'}
                                    for b, f in idx.items()], key=lambda x: x['publicado'], reverse=True)[:6],
        'analisis': [{k: a[k] for k in ('serie', 'numero', 'titulo', 'autor', 'fecha', 'resumen')} | {'url': f'{SITIO}/{a["ruta"]}'} for a in analisis],
    }
    escribir(ruta('data', 'feed.json'), json.dumps(feed, ensure_ascii=False, indent=1) + '\n')


def construir_mapa(boletines):
    fijas = ['', 'agenda.html', 'como-leer.html', 'glosario.html', 'asesoria.html', 'aportar.html', 'analisis.html', 'analisis/falsabilidad-kast.html']
    urls = [f'{SITIO}/{u}' for u in fijas] + [f'{SITIO}/p/{b}.html' for b in boletines]
    escribir(ruta('sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
             + ''.join(f'  <url><loc>{u}</loc></url>\n' for u in urls) + '</urlset>\n')


def principal():
    construir_glosario_js()
    v = version()
    if '--sitio' in sys.argv:
        construir_sitio(v)
    urg, ag, idx, boletines = construir_fichas(v)
    construir_feed(urg, ag, idx)
    construir_mapa(boletines)


if __name__ == '__main__':
    principal()
