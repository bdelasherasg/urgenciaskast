#!/usr/bin/env python3
"""Arma data/presupuesto_vigente.json: la Ley de Presupuestos del año anterior, por partida.

Para cada proyecto especial de tipo presupuesto (data/proyectos_especiales.json, por ejemplo «Ley de Presupuestos
2027»), busca en el portal de datos abiertos del Estado (datos.gob.cl, API CKAN) el conjunto más reciente de la Dipres
«Ley de Presupuestos Inicial y Vigente a <mes> de <año anterior> del Gobierno Central - Ley Regular» y guarda:

  - la ley inicial: lo que aprobó el Congreso;
  - la ley vigente al último mes publicado: la inicial más los cambios del año (decretos, leyes especiales, recortes).

Los montos son la suma de los subtítulos de gasto (21 a 35), en miles de pesos y en miles de dólares, tal como los
publica la Dipres: sin consolidar entre partidas (la partida 50, Tesoro Público, incluye los aportes que financian a
las demás) y en moneda de ese año, sin ajustar por inflación. El total es el archivo «a nivel nacional» de la Dipres.

Si la consulta falla o el archivo no trae lo esperado, conserva el archivo anterior. Nunca detiene el flujo.
"""
import csv
import datetime as dt
import io
import json
import os
import re
import sys
import urllib.parse
import urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ESPECIALES = os.path.join(RAIZ, 'data', 'proyectos_especiales.json')
SALIDA = os.path.join(RAIZ, 'data', 'presupuesto_vigente.json')
CKAN = 'https://datos.gob.cl/api/3/action/package_search'
PORTAL = 'https://datos.gob.cl/dataset/'
MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre',
         'noviembre', 'diciembre']
RE_TITULO = re.compile(r'^Ley de Presupuestos Inicial y Vigente a (\w+) de (\d{4}) del Gobierno Central - Ley Regular$', re.I)
SUBTITULOS_GASTO = range(21, 36)
MIN_PARTIDAS = 20


def bajar(url, tiempo=60):
    req = urllib.request.Request(url, headers={'User-Agent': 'urgenciaskast-bot (datos abiertos)'})
    with urllib.request.urlopen(req, timeout=tiempo) as r:
        return r.read()


def elegir_conjunto(resultados, anno):
    """El conjunto «Ley Regular» del año pedido con el mes de corte más reciente."""
    mejor = None
    for p in resultados:
        m = RE_TITULO.match((p.get('title') or '').strip())
        if not m or int(m.group(2)) != anno or m.group(1).lower() not in MESES:
            continue
        mes = MESES.index(m.group(1).lower()) + 1
        if mejor is None or mes > mejor[0]:
            mejor = (mes, p)
    return mejor


def recurso(paquete, nivel):
    for r in paquete.get('resources', []):
        if (r.get('name') or '').strip().lower() == f'a nivel {nivel}':
            return r.get('url')
    return None


def numero(s):
    s = (s or '').strip().replace('.', '').replace(',', '.')
    return int(float(s)) if s and s != '-' else 0


def filas(datos):
    texto = datos.decode('utf-8-sig') if isinstance(datos, bytes) else datos
    lector = csv.DictReader(io.StringIO(texto), delimiter=';')
    lector.fieldnames = [c.strip() for c in lector.fieldnames or []]
    vig = next((c for c in lector.fieldnames if c.lower().startswith('monto ley vigente')), None)
    if not vig or 'Monto Ley Inicial' not in lector.fieldnames:
        raise ValueError(f'columnas inesperadas: {lector.fieldnames}')
    return list(lector), vig


def gasto(filas_, vig):
    """{'pesos': {'inicial', 'vigente'}, 'dolares': {...}} en miles, sumando los subtítulos de gasto."""
    out = {}
    for f in filas_:
        try:
            sub = int(f.get('Subtítulo') or 0)
        except ValueError:
            continue
        if sub not in SUBTITULOS_GASTO:
            continue
        moneda = 'dolares' if (f.get('Moneda') or '').lower().startswith('d') else 'pesos'
        m = out.setdefault(moneda, {'inicial': 0, 'vigente': 0})
        m['inicial'] += numero(f.get('Monto Ley Inicial'))
        m['vigente'] += numero(f.get(vig))
    return out


def por_partida(filas_, vig):
    grupos = {}
    for f in filas_:
        cod = (f.get('Partida') or '').strip()
        if cod.isdigit():
            cod = cod.zfill(2)
            grupos.setdefault(cod, {'nombre': (f.get('Nombre Partida') or '').strip(), 'filas': []})['filas'].append(f)
    return {cod: {'nombre': g['nombre'], **gasto(g['filas'], vig)} for cod, g in sorted(grupos.items())}


def ley_vigente(anno):
    q = f'"Ley de Presupuestos Inicial y Vigente" "{anno}" "Ley Regular"'
    url = CKAN + '?' + urllib.parse.urlencode({'q': q, 'rows': 50, 'sort': 'metadata_modified desc'})
    res = json.loads(bajar(url))
    if not res.get('success'):
        raise ValueError('la API de datos.gob.cl no respondió con éxito')
    elegido = elegir_conjunto(res['result']['results'], anno)
    if not elegido:
        raise ValueError(f'no hay un conjunto «Ley Regular» de {anno}')
    mes, paq = elegido
    u_part, u_nac = recurso(paq, 'partida'), recurso(paq, 'nacional')
    if not u_part or not u_nac:
        raise ValueError(f'«{paq["title"]}» no trae los archivos a nivel partida y nacional')
    fp, vig = filas(bajar(u_part))
    fn, vig_n = filas(bajar(u_nac))
    partidas = por_partida(fp, vig)
    total = gasto(fn, vig_n)
    if len(partidas) < MIN_PARTIDAS or not (total.get('pesos') or {}).get('inicial'):
        raise ValueError(f'«{paq["title"]}» trae {len(partidas)} partidas; se esperaban al menos {MIN_PARTIDAS}')
    return {
        'anno': anno,
        'mes_corte': MESES[mes - 1],
        'unidad': 'miles de pesos y miles de dólares de cada año',
        'fuente': {
            'titulo': f'Dirección de Presupuestos, datos abiertos: {paq["title"]}',
            'url': PORTAL + (paq.get('name') or paq.get('id', '')),
            'archivo_partida': u_part,
            'archivo_nacional': u_nac,
            'publicado': (paq.get('metadata_modified') or '')[:10],
        },
        'total': total,
        'partidas': partidas,
    }


def anno_del_proyecto(e):
    m = re.search(r'\b(20\d{2})\b', e.get('nombre') or '')
    return int(m.group(1)) if m else None


def principal():
    especiales = json.load(open(ESPECIALES, encoding='utf-8'))
    try:
        anterior = json.load(open(SALIDA, encoding='utf-8'))
    except (OSError, ValueError):
        anterior = {}
    leyes = dict(anterior.get('leyes') or {})
    for b, e in especiales.items():
        if e.get('tipo') != 'presupuesto' or not anno_del_proyecto(e):
            continue
        anno = anno_del_proyecto(e) - 1
        try:
            leyes[str(anno)] = ley_vigente(anno)
            ley = leyes[str(anno)]
            print(f'Ley de Presupuestos {anno}, vigente a {ley["mes_corte"]}: {len(ley["partidas"])} partidas '
                  f'({ley["fuente"]["publicado"]}).')
        except Exception as ex:  # noqa: BLE001
            print(f'::warning::No se pudo leer la Ley de Presupuestos {anno} en datos.gob.cl ({ex}); se conserva lo anterior.')
    if leyes != (anterior.get('leyes') or {}):
        with open(SALIDA, 'w', encoding='utf-8') as f:
            json.dump({'actualizado': dt.datetime.now(dt.timezone.utc).isoformat(timespec='minutes'), 'leyes': leyes},
                      f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    try:
        principal()
    except Exception as ex:  # noqa: BLE001
        print(f'::warning::Presupuesto vigente: {ex}')
    sys.exit(0)
