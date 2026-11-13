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
from zoneinfo import ZoneInfo

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITIO = 'https://urgenciaskast.cl'
LOCOMUN = 'https://locomun.cl'


def hoy_chile():
    """Fecha de hoy en Chile: el servidor de GitHub trabaja en UTC y pasadas las 21:00 ya es «mañana» allá."""
    return dt.datetime.now(ZoneInfo('America/Santiago')).date()


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
    for a in ('assets/estilo.css', 'assets/app.js', 'assets/config.js', 'assets/glosario.js', 'assets/analitica.js'):
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
           attr_body='', v='', extra_head=''):
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
<meta name="twitter:title" content="{esc(og_titulo or titulo)}">
<meta name="twitter:description" content="{esc(descripcion)}">
<meta name="twitter:image" content="{SITIO}/assets/compartir.png">
<meta name="robots" content="index, follow, max-image-preview:large">
{extra_head}<meta name="theme-color" content="#e4def7">
<link rel="icon" href="{base}assets/simbolo.svg" type="image/svg+xml">
<link rel="preload" href="{base}assets/fonts/instrument-serif-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="{base}assets/fonts/figtree-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="{base}assets/estilo.css?v={v}">
<script src="{base}assets/config.js?v={v}"></script>
<script src="{base}assets/glosario.js?v={v}"></script>
<script src="{base}assets/app.js?v={v}" defer></script>
<script src="{base}assets/analitica.js?v={v}" defer></script>
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


# ---------- SEO y contenido prerenderizado ----------
# La tabla de proyectos y la agenda las dibuja assets/app.js con los datos. Para que buscadores y agentes de IA,
# que no ejecutan JavaScript, vean esos listados, aquí se incluye una versión simple en el HTML inicial, que app.js
# reemplaza al cargar. Las fichas no se rehacen aquí: scripts/prerender.mjs escribe lo mismo que dibuja app.js.
MESES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
DIAS_L = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
ORG_LC = {'@type': 'Organization', '@id': f'{LOCOMUN}/#organizacion', 'name': 'Lo Común', 'url': f'{LOCOMUN}/'}
CORREO = 'contacto@locomun.cl'


def fecha_larga(iso, dia=False):
    try:
        d = dt.date.fromisoformat(str(iso)[:10])
    except ValueError:
        return ''
    return (DIAS_L[d.weekday()].capitalize() + ' ' if dia else '') + f'{d.day} de {MESES_L[d.month - 1]}' + ('' if dia else f' de {d.year}')


def jsonld(dato):
    return '<script type="application/ld+json">' + json.dumps(dato, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c') + '</script>\n'


def ld_sitio(descripcion):
    return jsonld({'@context': 'https://schema.org', '@graph': [
        {'@type': 'WebSite', '@id': f'{SITIO}/#sitio', 'url': f'{SITIO}/', 'name': 'Urgencias Kast', 'description': descripcion,
         'inLanguage': 'es-CL', 'publisher': {'@id': ORG_LC['@id']}},
        dict(ORG_LC, **{'email': CORREO, 'areaServed': {'@type': 'Country', 'name': 'Chile'}}),
    ]})


def ld_articulo(titulo, descripcion, url, publicado, modificado=None, autor=None, migas=None):
    d = {'@context': 'https://schema.org', '@type': 'Article', 'headline': titulo, 'description': descripcion, 'inLanguage': 'es-CL',
         'mainEntityOfPage': {'@type': 'WebPage', '@id': url}, 'image': f'{SITIO}/assets/compartir.png',
         'author': {'@type': 'Person', 'name': autor} if autor else {'@id': ORG_LC['@id']},
         'publisher': {'@id': ORG_LC['@id'], '@type': 'Organization', 'name': 'Lo Común', 'url': f'{LOCOMUN}/'},
         'isPartOf': {'@id': f'{SITIO}/#sitio'}}
    if publicado:
        d['datePublished'] = publicado
        d['dateModified'] = modificado or publicado
    return jsonld([d, ld_migas(migas)] if migas else d)


def titulo_corto(t, n=60):
    """Primera oración del título, recortada para que el buscador la muestre completa."""
    t = re.sub(r'\s+', ' ', str(t or '')).strip()
    primera = re.split(r'(?<=[a-záéíóúñ0-9])\.\s', t, maxsplit=1)[0].rstrip('.')
    return primera if len(primera) <= n else recortar(primera, n)


def tiene_pagina(b, urg, ag, idx):
    """Hay página de proyecto si se conocen sus datos oficiales o tiene ficha (lo mismo que construir_fichas)."""
    return b in idx or b in (ag.get('proyectos') or {}) or any(x['boletin'] == b for x in urg.get('proyectos', []))


def relacionados(b, urg, ag, idx, F, pub):
    """Bloque visible bajo la ficha: otros proyectos de la misma comisión y fechas de publicación y actualización."""
    organos = {}
    for x in (ag.get('sesiones') or []):
        if x.get('estado') != 'sin efecto' and b in (x.get('boletines') or []):
            organos.setdefault(x.get('organo') or '', []).extend(x['boletines'])
    otros, titulo = [], 'Otros proyectos en la misma comisión'
    for org, bs in organos.items():
        for o in bs:
            if o != b and o not in otros and tiene_pagina(o, urg, ag, idx):
                otros.append(o)
    if not otros:
        etapa = next((x.get('etapa') for x in urg.get('proyectos', []) if x['boletin'] == b), None)
        if etapa:
            otros = [x['boletin'] for x in urg.get('proyectos', []) if x.get('etapa') == etapa and x['boletin'] != b and x['boletin'] in idx]
            titulo = 'Otros proyectos en la misma etapa de tramitación'
    otros.sort(key=lambda o: (o not in idx, o))
    lista = ''.join(f'<li><a href="{esc(o)}.html">{esc(recortar(nombre_proyecto(o, urg, ag, idx), 150))}</a> <small>Boletín {esc(o)}</small></li>' for o in otros[:5])
    fechas = [f'Ficha publicada el {fecha_larga(pub)}.' if pub else '',
              f'Fuentes consultadas el {fecha_larga((F or {}).get("consultado"))}.' if (F or {}).get('consultado') else '',
              f'Datos oficiales de urgencias y tramitación actualizados el {fecha_larga(urg.get("actualizado"))}.' if urg.get('actualizado') else '']
    return ('<div class="envoltura seccion"><section class="tarjeta" aria-labelledby="h-rel"><div class="tarjeta-cuerpo">'
            + (f'<h2 id="h-rel">{titulo}</h2><ul>{lista}</ul>' if lista else '')
            + '<p class="nota">' + ' '.join(x for x in fechas if x) + f' Las correcciones se publican con fecha: escriba a <b>{CORREO}</b> indicando el boletín. '
            '<a href="../agenda.html">Ver la agenda de dos semanas</a>.</p></div></section></div>')


def ld_migas(items):
    return {'@context': 'https://schema.org', '@type': 'BreadcrumbList',
            'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'name': n, 'item': u} for i, (n, u) in enumerate(items)]}


def nombre_proyecto(b, urg, ag, idx):
    f = idx.get(b) or {}
    if f.get('sintesis'):
        return f['sintesis']
    pr = next((x for x in urg.get('proyectos', []) if x['boletin'] == b), None) or (ag.get('proyectos') or {}).get(b) or {}
    return pr.get('titulo') or f'Boletín {b}'


def organo_corto(x):
    """«Comisión de Hacienda» → «Hacienda»; Sala → «Sala»; investigadoras → «Investigadora CEI 12» (igual que assets/app.js)."""
    if x.get('tipo') == 'sala':
        return 'Sala'
    o = str(x.get('organo') or '')
    m = re.search(r'\(CEI\s*(\d+)\)', o)
    if m:
        return f'Investigadora CEI {m.group(1)}'
    o = re.split(r'\s+-{1,2}\s+|\s+–\s+', re.sub(r'(?i)^Comisi[oó]n\s+(de\s+la\s+|del\s+|de\s+)?', '', o))[0]
    return recortar(o[:1].upper() + o[1:], 70)


def filas_de_sesion(x):
    """(boletín, refundidos, texto) de cada cosa que trata una sesión, en orden (igual que assets/app.js)."""
    if x.get('tipo') == 'sala' and x.get('puntos'):
        return [((p.get('boletines') or [''])[0], (p.get('boletines') or [])[1:], recortar(p.get('texto', ''), 200)) for p in x['puntos']]
    if x.get('boletines'):
        return [(b, [], '') for b in x['boletines']]
    if x.get('tipo') == 'sala':
        return [('', [], f"Sesión {str(x.get('numero')) + '.ª' if x.get('numero') else ''}{', ' + x['clase'].lower() if x.get('clase') else ''} · Tabla por confirmar")]
    return [('', [], recortar(' '.join(x.get('materias') or []), 200) or 'Sin materia informada')]


def tabla_estatica(urg, ag, idx):
    """La tabla de actividad de la portada para los próximos 7 días, en HTML simple (assets/app.js la reemplaza)."""
    hoy = hoy_chile()
    lim = (hoy + dt.timedelta(days=6)).isoformat()
    por_b = {x['boletin']: x for x in urg.get('proyectos', [])}
    ses = sorted([x for x in (ag.get('sesiones') or []) if hoy.isoformat() <= x.get('fecha', '') <= lim],
                 key=lambda x: (x['fecha'], x.get('hora') or '99:99', x.get('camara', ''), x.get('organo', '')))
    filas, citados = [], set()
    for x in ses:
        cuando = f'{fecha_larga(x["fecha"], dia=True)}{" · " + esc(x.get("hora")) if x.get("hora") else ""}'
        donde = f'{esc(organo_corto(x))}, {"Senado" if x.get("camara") == "Senado" else "Cámara"}'
        act = 'Sin efecto' if x.get('estado') == 'sin efecto' else esc(x.get('actividad', ''))
        for b, otros, texto in filas_de_sesion(x):
            if b:
                citados.add(b)
                nombre = esc(recortar(nombre_proyecto(b, urg, ag, idx), 200))
                que = (f'<a href="{{{{BASE}}}}p/{esc(b)}.html">{nombre}</a>' if tiene_pagina(b, urg, ag, idx) else nombre) + f' (boletín {esc(b)}{", refundido con " + esc(", ".join(otros)) if otros else ""})'
                v = (por_b.get(b) or {}).get('urgencia_vigente') or {}
                urgencia = f'{esc(v.get("tipo"))}, vence el {fecha_larga(v.get("vence"))}' if v.get('estado') == 'vigente' and (v.get('vence') or '') >= hoy.isoformat() else ''
            else:
                que, urgencia = esc(texto), ''
            filas.append(f'<tr><td>{cuando}</td><td>{donde}</td><td>{que}</td><td>{act}</td><td>{urgencia}</td><td></td></tr>')
    sin = sorted([x for x in urg.get('proyectos', []) if (x.get('urgencia_vigente') or {}).get('estado') == 'vigente'
                  and (x['urgencia_vigente'].get('vence') or '') >= hoy.isoformat() and x['boletin'] not in citados],
                 key=lambda x: x['urgencia_vigente']['vence'])
    if sin:
        filas.append('<tr><td colspan="6"><b>Con urgencia, sin sesión citada</b></td></tr>')
        for x in sin:
            v = x['urgencia_vigente']
            filas.append(f'<tr><td>Sin sesión citada</td><td>{"Senado" if x.get("camara_actual") == "Senado" else "Cámara"}</td>'
                         f'<td><a href="{{{{BASE}}}}p/{esc(x["boletin"])}.html">{esc(recortar(nombre_proyecto(x["boletin"], urg, ag, idx), 200))}</a> (boletín {esc(x["boletin"])})</td>'
                         f'<td></td><td>{esc(v.get("tipo"))}, vence el {fecha_larga(v["vence"])}</td><td></td></tr>')
    return ''.join(filas) or '<tr><td colspan="6" class="vacio">Cargando…</td></tr>'


def agenda_estatica(urg, ag, idx):
    hoy = hoy_chile()
    lim = (hoy + dt.timedelta(days=13)).isoformat()
    ses = [x for x in (ag.get('sesiones') or []) if x.get('estado') != 'sin efecto' and x.get('boletines')
           and hoy.isoformat() <= x['fecha'] <= lim]
    if not ses:
        return '<p class="vacio">Cargando…</p>'
    por_dia = {}
    for x in sorted(ses, key=lambda x: (x['fecha'], x.get('hora', ''))):
        por_dia.setdefault(x['fecha'], []).append(x)
    partes = []
    for f, lista in por_dia.items():
        li = ''.join(
            f'<li><b>{esc(x.get("hora"))}</b> {esc(x.get("camara"))}, {esc(x.get("organo"))}: '
            + '; '.join((f'<a href="{{{{BASE}}}}p/{esc(b)}.html">{esc(recortar(nombre_proyecto(b, urg, ag, idx), 160))}</a> (boletín {esc(b)})'
                         if tiene_pagina(b, urg, ag, idx) else f'boletín {esc(b)}, sin datos oficiales para ese número') for b in x['boletines'])
            + '</li>' for x in lista)
        partes.append(f'<section><h2>{esc(fecha_larga(f, dia=True))}</h2><ul>{li}</ul></section>')
    return '<h2 class="solo-lector">Citaciones confirmadas de las próximas dos semanas</h2>' + ''.join(partes)


RE_META = re.compile(r'<!--meta\s+(\{.*?\})\s*-->', re.S)


def construir_sitio(v):
    analisis = entregas_todas()
    urg = leer_json(ruta('data', 'urgencias.json'), {'proyectos': []})
    ag = leer_json(ruta('data', 'agenda.json'), {'proyectos': {}})
    idx = indice_fichas()
    locales = {a.get('ruta'): a for a in leer_json(ruta('data', 'analisis.json'), {'entregas': []})['entregas']}
    reemplazos = {'{{DESTACADO}}': destacado(analisis), '{{LISTA_ANALISIS}}': lista_analisis(analisis),
                  '{{GLOSARIO}}': glosario_html(), '{{TABLA_ESTATICA}}': tabla_estatica(urg, ag, idx),
                  '{{AGENDA_ESTATICA}}': agenda_estatica(urg, ag, idx)}
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
        extra = ''
        if rel == 'index.html':
            extra = ld_sitio(meta.get('descripcion', ''))
        elif meta.get('og_tipo') == 'article' and rel in locales:
            a = locales[rel]
            extra = (f'<meta property="article:published_time" content="{esc(a.get("fecha"))}">\n'
                     + ld_articulo(meta.get('og_titulo') or meta.get('titulo'), meta.get('descripcion', ''), f'{SITIO}/{rel}', a.get('fecha'), autor=a.get('autor')))
        escribir(ruta(rel), layout(cuerpo, base=base, titulo=meta.get('titulo', 'Urgencias Kast'), descripcion=meta.get('descripcion', ''),
                                   pagina=meta.get('pagina', 'texto'), nav=meta.get('nav', ''), ruta_url=url,
                                   og_tipo=meta.get('og_tipo', 'website'), og_titulo=meta.get('og_titulo'), v=v, extra_head=extra))
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
            desc = recortar(f['sintesis'], 155)
        else:
            urgv = (p.get('urgencia_vigente') or {}).get('tipo')
            desc = f'Boletín {b}' + (f', con urgencia {urgv.lower()}' if urgv else '') + '. Plazos, tramitación y fuentes oficiales, explicados.'
        F = leer_json(ruta('data', 'fichas', f'{b}.json')) if f else None
        pub = f.get('publicado') or ''
        # El contenido lo dibuja assets/app.js; scripts/prerender.mjs lo escribe además entre los marcadores, idéntico.
        cuerpo = ('<div id="ficha"><!--pre--><div class="envoltura"><p class="vacio">Cargando la ficha…</p></div><!--/pre--></div>'
                  + relacionados(b, urg, ag, idx, F, pub))
        extra = ((f'<meta property="article:published_time" content="{esc(pub)}">\n' if pub else '')
                 + ld_articulo(recortar(titulo, 110), desc, f'{SITIO}/p/{b}.html', pub or None, (F or {}).get('consultado'), migas=[('Urgencias Kast', f'{SITIO}/'), (f'Boletín {b}', f'{SITIO}/p/{b}.html')]))
        escribir(ruta('p', f'{b}.html'), layout(cuerpo, base='../', titulo=titulo_corto(titulo) + ' · Urgencias Kast', descripcion=desc,
                                               pagina='ficha', ruta_url=f'p/{b}.html', og_tipo='article', og_titulo=recortar(titulo, 120),
                                               attr_body=f' data-boletin="{esc(b)}"', v=v, extra_head=extra))
    print(f'Páginas por proyecto: {len(boletines)}')
    return urg, ag, idx, sorted(boletines)


def construir_feed(urg, ag, idx):
    hoy = hoy_chile()
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


def construir_mapa(boletines, idx=None):
    idx = idx or {}
    fijas = ['', 'agenda.html', 'como-leer.html', 'glosario.html', 'asesoria.html', 'aportar.html', 'analisis.html', 'analisis/falsabilidad-kast.html']
    urls = [(f'{SITIO}/{u}', '') for u in fijas] + [(f'{SITIO}/p/{b}.html', (idx.get(b) or {}).get('publicado', '')) for b in boletines]
    escribir(ruta('sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
             + ''.join(f'  <url><loc>{u}</loc>' + (f'<lastmod>{m}</lastmod>' if m else '') + '</url>\n' for u, m in urls) + '</urlset>\n')


def construir_llms():
    feed = leer_json(ruta('data', 'feed.json'), {})
    recientes = ''.join(f'- [{recortar(x["sintesis"], 160)}]({x["url"]}) (boletín {x["boletin"]})\n' for x in feed.get('fichas_recientes', []))
    series = ''.join(f'- [{a["serie"]} N.° {a["numero"]}: {a["titulo"]}]({SITIO}/{a["ruta"]}): {recortar(a["resumen"], 200)}\n'
                     for a in (leer_json(ruta('data', 'analisis.json'), {'entregas': []})['entregas']))
    escribir(ruta('llms.txt'), f'''# Urgencias Kast

> Seguimiento gratuito de las urgencias que el Ejecutivo pone a los proyectos de ley y de la agenda legislativa de dos semanas del Congreso Nacional de Chile. Cada proyecto tiene una ficha con resumen con fuente por oración, posiciones de organizaciones, urgencia y tramitación explicadas. Es una producción pública de Lo Común: Laboratorio de Relato y Producción Narrativa ({LOCOMUN}/), bajo licencia CC BY-SA 4.0.

Los datos oficiales se actualizan cada tres horas desde el Senado y la Cámara de Diputadas y Diputados. Las fichas con el aviso "Revisión pendiente · piloto de prueba" las redactó un sistema automático y el equipo aún no las revisa; cada oración enlaza a su fuente, y ante una duda vale lo que dice la fuente.

## Páginas

- [Inicio y tabla de proyectos]({SITIO}/): proyectos en la agenda del Congreso o con urgencia vigente.
- [Agenda de dos semanas]({SITIO}/agenda.html): citaciones de comisiones y proyectos con urgencia por vencer.
- [Cómo leer Urgencias Kast]({SITIO}/como-leer.html): qué es una urgencia, cómo se calculan los plazos y el método de cada ficha.
- [Glosario]({SITIO}/glosario.html): términos de la tramitación legislativa y del método, en lenguaje sencillo.
- [Prueba pública]({SITIO}/analisis.html): serie de análisis de fondo de Lo Común.
- [Asesoría]({SITIO}/asesoria.html): asesoría de Lo Común para parlamentarios, bancadas y partidos.

## Datos en formato JSON

- [Urgencias]({SITIO}/data/urgencias.json): proyectos con urgencia, etapas, trámites y renovaciones.
- [Agenda]({SITIO}/data/agenda.json): citaciones de las próximas dos semanas.
- [Resumen del sitio]({SITIO}/data/feed.json): cifras del día, próximos plazos y fichas recientes.
- [Índice de fichas]({SITIO}/data/fichas/indice.json): síntesis y estado de revisión de cada ficha.
- [Mapa del sitio]({SITIO}/sitemap.xml): todas las páginas, con una ficha por proyecto en /p/BOLETIN.html.

## Fichas recientes

{recientes}
## Prueba pública

{series}
## Contacto

- Correos, correcciones y asesorías: {CORREO}
''')


def principal():
    construir_glosario_js()
    v = version()
    if '--sitio' in sys.argv:
        construir_sitio(v)
    urg, ag, idx, boletines = construir_fichas(v)
    construir_feed(urg, ag, idx)
    construir_mapa(boletines, idx)
    construir_llms()


if __name__ == '__main__':
    principal()
