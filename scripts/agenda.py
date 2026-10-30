#!/usr/bin/env python3
"""Arma data/agenda.json: lo que se discutirá en el Congreso en las próximas dos semanas.

Dos niveles:
  - Confirmado: citaciones de comisiones publicadas por el Senado y por la Cámara.
  - Probable: proyectos con urgencia vigente que vence dentro del periodo y que aún no
    figuran en una citación publicada. Un vencimiento indica prioridad del Ejecutivo,
    no una fecha segura de discusión, porque el gobierno suele renovar las urgencias.

Para cada boletín citado que no está en data/urgencias.json, consulta su ficha en el
servicio de tramitación del Senado. Si una fuente falla, conserva las sesiones anteriores
de esa fuente que sigan dentro del periodo y lo informa en "fuentes". Nunca detiene el
flujo de actualización.
"""
import datetime as dt
import html as htmlmod
import json
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import actualizar as A  # noqa: E402

RAIZ = A.RAIZ
SALIDA = os.path.join(RAIZ, 'data', 'agenda.json')
URGENCIAS = A.SALIDA
DIAS_VENTANA = 14
MAX_CONSULTAS = 150

URL_SENADO_CITACIONES = 'https://tramitacion.senado.cl/appsenado/index.php?mo=comisiones&ac=citacionesComision&tipo_consulta=1'
URL_CAMARA_CITACIONES = 'https://www.camara.cl/legislacion/comisiones/citaciones_semana.aspx?prmSemana={anno}-{semana:02d}'

MESES = {'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
         'septiembre': 9, 'setiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12}
RE_FECHA = re.compile(r'(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s*,?\s*(\d{1,2})\s+de\s+([a-záéíóú]+)\s+(?:de\s+|del\s+)?(\d{4})', re.I)
RE_BOLETIN = re.compile(r'(?<![\d.])(\d{1,2}\.?\d{3})-(\d{2})(?!\d)')
RE_HORA = re.compile(r'\b(\d{1,2})[:.](\d{2})\b')


def texto(datos):
    if datos is None:
        return ''
    for cod in ('utf-8', 'latin-1'):
        try:
            return datos.decode(cod)
        except UnicodeDecodeError:
            continue
    return datos.decode('utf-8', 'replace')


def a_lineas(html):
    html = re.sub(r'(?is)<(script|style|noscript)\b.*?</\1>', ' ', html)
    html = re.sub(r'(?i)<br\s*/?>|</(p|div|tr|td|th|li|h\d|table|caption|dt|dd|section|article|header|span)>', '\n', html)
    html = re.sub(r'<[^>]+>', ' ', html)
    lineas = [re.sub(r'\s+', ' ', l).strip() for l in htmlmod.unescape(html).split('\n')]
    return [l for l in lineas if l]


def fecha_de(linea):
    m = RE_FECHA.search(linea)
    if not m:
        return None
    mes = MESES.get(m.group(2).lower())
    if not mes:
        return None
    try:
        return dt.date(int(m.group(3)), mes, int(m.group(1))).isoformat()
    except ValueError:
        return None


def boletines_en(texto_):
    return sorted({f"{a.replace('.', '')}-{b}" for a, b in RE_BOLETIN.findall(texto_)})


def nombre_organo(valor):
    v = valor.strip(' :')
    if not v:
        return ''
    if re.match(r'(?i)comisi[oó]n\b', v):
        return v[0].upper() + v[1:]
    return 'Comisión ' + v


def nueva_sesion(fecha, camara, fuente):
    return {'fecha': fecha, 'hora': '', 'horario': '', 'camara': camara, 'organo': '', 'lugar': '',
            'materias': [], 'boletines': [], 'estado': 'citada', 'fuente': fuente}


def cerrar(s):
    s['materias'] = [m[:500] for m in s['materias'] if m][:10]
    s['boletines'] = boletines_en(' '.join(s['materias']))
    h = RE_HORA.search(s['horario'] or '')
    s['hora'] = f'{int(h.group(1)):02d}:{h.group(2)}' if h else ''
    return s


def parse_senado(lineas):
    """Citaciones por fecha del Senado: cada citación tiene filas COMISIÓN, LUGAR, HORARIO y MATERIA."""
    etiquetas = {'COMISIÓN': 'organo', 'COMISION': 'organo', 'LUGAR': 'lugar', 'HORARIO': 'horario',
                 'MATERIA': 'materias', 'MATERIAS': 'materias'}
    sesiones, fecha, actual, campo = [], None, None, None
    for l in lineas:
        f = fecha_de(l)
        if f and len(l) < 70:
            fecha, campo, actual = f, None, None
            continue
        if fecha is None:
            continue
        sup = l.upper()
        clave, resto = None, ''
        for etq, k in etiquetas.items():
            if sup == etq or sup.startswith(etq + ':') or sup.startswith(etq + ' :'):
                clave, resto = k, (l.split(':', 1)[1].strip() if ':' in l else '')
                break
        if clave:
            if clave == 'organo':
                actual = nueva_sesion(fecha, 'Senado', 'Senado, citaciones por fecha')
                sesiones.append(actual)
            campo = clave
            if resto and actual is not None:
                asignar(actual, campo, resto)
            continue
        if actual is None:
            continue
        if 'SIN EFECTO' in sup or 'SUSPENDID' in sup:
            actual['estado'] = 'sin efecto'
            continue
        if campo:
            asignar(actual, campo, l)
    return [cerrar(s) for s in sesiones if s['organo']]


def asignar(s, campo, valor):
    if campo == 'materias':
        s['materias'].append(valor)
    elif campo == 'organo':
        if not s['organo']:
            s['organo'] = nombre_organo(valor)
    elif not s[campo]:
        s[campo] = valor


def parse_camara(lineas):
    """Citaciones semanales de la Cámara. Conserva solo las citaciones que mencionan un boletín,
    para no publicar texto que no se pueda vincular a un proyecto oficial."""
    sesiones, fecha, actual = [], None, None
    for l in lineas:
        f = fecha_de(l)
        if f and len(l) < 90:
            fecha, actual = f, None
            continue
        if fecha is None:
            continue
        if re.match(r'(?i)^comisi[oó]n\b', l) and len(l) < 160 and not RE_BOLETIN.search(l):
            actual = nueva_sesion(fecha, 'Cámara de Diputados', 'Cámara, citaciones de la semana')
            actual['organo'] = nombre_organo(l)
            sesiones.append(actual)
            continue
        if actual is None:
            continue
        if re.search(r'(?i)sin efecto|suspendid', l):
            actual['estado'] = 'sin efecto'
        if not actual['horario'] and RE_HORA.search(l) and len(l) < 80:
            actual['horario'] = l
            continue
        if len(actual['materias']) < 10 and len(l) > 3:
            actual['materias'].append(l)
    return [cerrar(s) for s in sesiones if s['organo']]


def en_ventana(s, desde, hasta):
    return s.get('fecha') and desde <= s['fecha'] <= hasta


def leer_json(ruta, defecto):
    try:
        with open(ruta, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return defecto


def principal():
    hoy = dt.date.today()
    desde, hasta = hoy.isoformat(), (hoy + dt.timedelta(days=DIAS_VENTANA - 1)).isoformat()
    anterior = leer_json(SALIDA, {})
    urg = leer_json(URGENCIAS, {'proyectos': []})
    por_boletin = {p['boletin']: p for p in urg.get('proyectos', [])}
    fuentes, sesiones = {}, []

    # Senado
    n_err = len(A.errores)
    datos = A.bajar(URL_SENADO_CITACIONES)
    nuevas = parse_senado(a_lineas(texto(datos))) if datos else []
    if nuevas:
        fuentes['senado'] = {'estado': 'ok', 'consultado': dt.datetime.now().isoformat(timespec='minutes'), 'citaciones': len(nuevas), 'url': URL_SENADO_CITACIONES}
        sesiones += nuevas
    else:
        prev = [s for s in anterior.get('sesiones', []) if s.get('camara') == 'Senado' and en_ventana(s, desde, hasta)]
        sesiones += prev
        fuentes['senado'] = {'estado': 'sin_actualizar', 'detalle': '; '.join(A.errores[n_err:])[:300] or 'Sin citaciones reconocibles en la página.',
                             'conservadas': len(prev), 'url': URL_SENADO_CITACIONES}

    # Cámara: semana en curso y siguiente
    nuevas_c, urls = [], []
    for d in (hoy, hoy + dt.timedelta(days=7)):
        anno, semana, _ = d.isocalendar()
        url = URL_CAMARA_CITACIONES.format(anno=anno, semana=semana)
        urls.append(url)
        datos = A.bajar(url)
        if datos:
            nuevas_c += [s for s in parse_camara(a_lineas(texto(datos))) if s['boletines']]
        time.sleep(0.5)
    if nuevas_c:
        fuentes['camara'] = {'estado': 'ok', 'consultado': dt.datetime.now().isoformat(timespec='minutes'), 'citaciones': len(nuevas_c), 'url': urls[0]}
        sesiones += nuevas_c
    else:
        prev = [s for s in anterior.get('sesiones', []) if s.get('camara') == 'Cámara de Diputados' and en_ventana(s, desde, hasta)]
        sesiones += prev
        fuentes['camara'] = {'estado': 'sin_actualizar', 'detalle': 'Sin citaciones con boletín reconocibles en la página.',
                             'conservadas': len(prev), 'url': urls[0]}

    sesiones = [s for s in sesiones if en_ventana(s, desde, hasta)]
    sesiones.sort(key=lambda s: (s['fecha'], s.get('hora') or '99', s['camara'], s['organo']))

    # Datos oficiales de cada boletín citado que no tiene urgencia vigente
    citados = sorted({b for s in sesiones for b in s['boletines']})
    proyectos = {}
    previos = anterior.get('proyectos', {})
    consultas = 0
    for b in citados:
        if b in por_boletin:
            continue
        if consultas >= MAX_CONSULTAS:
            if b in previos:
                proyectos[b] = previos[b]
            continue
        p = A.detalle(b)
        consultas += 1
        time.sleep(0.4)
        if p:
            p = A.completar(p, hoy)
            p['tramites'] = p['tramites'][-20:]
            proyectos[p['boletin']] = p
        elif b in previos:
            proyectos[b] = previos[b]

    # Probables: urgencias que vencen en el periodo y no figuran en una citación vigente
    confirmados = {b for s in sesiones if s['estado'] != 'sin efecto' for b in s['boletines']}
    probables = []
    for p in urg.get('proyectos', []):
        v = p.get('urgencia_vigente') or {}
        if v.get('estado') == 'vigente' and v.get('vence') and desde <= v['vence'] <= hasta and p['boletin'] not in confirmados:
            probables.append({'boletin': p['boletin'], 'vence': v['vence'], 'tipo': v.get('tipo'), 'camara': p.get('camara_actual')})
    probables.sort(key=lambda x: (x['vence'], x['boletin']))

    zona = dt.timezone(dt.timedelta(hours=-3))
    salida = {
        'actualizado': dt.datetime.now(zona).isoformat(timespec='minutes'),
        'desde': desde,
        'hasta': hasta,
        'fuentes': fuentes,
        'sesiones': sesiones,
        'probables': probables,
        'proyectos': proyectos,
    }
    with open(SALIDA, 'w', encoding='utf-8') as f:
        json.dump(salida, f, ensure_ascii=False, indent=1)
    print(f'Agenda: {len(sesiones)} citaciones, {len(citados)} boletines citados, {len(probables)} probables. Fuentes: '
          + ', '.join(f'{k}={v["estado"]}' for k, v in fuentes.items()))


if __name__ == '__main__':
    try:
        principal()
    except Exception as e:  # la agenda nunca detiene la actualización de urgencias
        print(f'No se pudo armar la agenda: {e}', file=sys.stderr)
