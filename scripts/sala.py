"""Sesiones de Sala de ambas cámaras, tablas cargadas por el equipo y votaciones de Sala, para scripts/agenda.py.

Fuentes automáticas (servicios públicos documentados, que responden desde GitHub):
  - Cámara: datos abiertos, WSSala.retornarSesionesXAnno (fecha, hora, tipo y estado; trae las sesiones citadas).
  - Senado: servicio público de tramitación, sesiones.php?legislatura=N (fecha, hora y tipo; trae las futuras).
  - Cámara: datos abiertos, WSLegislativo.retornarVotacionesXAnno (cada votación de Sala, con su boletín).
Qué proyectos trata cada sesión (la tabla) no lo entrega ninguna fuente automática: lo carga el equipo en el panel
(data/tabla_sala.json). Nada aquí se obtiene saltando los bloqueos de camara.cl o senado.cl.

Las funciones de lectura no consultan la red: reciben el texto de la respuesta, para poder probarlas.
"""
import datetime as dt
import html
import json
import os
import re

CAMARA = 'Cámara de Diputados'
SENADO = 'Senado'
ORGANO = {CAMARA: 'Sala de la Cámara', SENADO: 'Sala del Senado'}
BASE_CAMARA = 'https://opendata.camara.cl/camaradiputados/WServices/'
URL_CAMARA_SALA = BASE_CAMARA + 'WSSala.asmx/retornarSesionesXAnno?prmAnno={anno}'
URL_LEGISLATURA = BASE_CAMARA + 'WSLegislativo.asmx/retornarLegislaturaActual'
URL_VOTACIONES = BASE_CAMARA + 'WSLegislativo.asmx/retornarVotacionesXAnno?prmAnno={anno}'
URL_SENADO_SALA = 'https://tramitacion.senado.cl/wspublico/sesiones.php?legislatura={numero}'
FUENTE = {CAMARA: 'Cámara, datos abiertos (sesiones de Sala)', SENADO: 'Senado, servicio público de tramitación (sesiones de Sala)'}

MESES = {'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
         'septiembre': 9, 'setiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12}
RE_BOLETIN = re.compile(r'^\d{4,6}-\d{2}$')
DIAS_PASADOS = 7


def _campo(bloque, etiqueta):
    m = re.search(rf'<{etiqueta}\b[^>]*>(.*?)</{etiqueta}>', bloque, re.S)
    return html.unescape(m.group(1)).strip() if m else ''


def nueva_sesion_sala(camara, fecha, inicio='', termino='', numero=None, clase='', fuente=''):
    return {'fecha': fecha, 'hora': inicio, 'horario': f'{inicio} a {termino}' if inicio and termino else inicio,
            'camara': camara, 'organo': ORGANO[camara], 'lugar': '', 'materias': [], 'boletines': [], 'estado': 'citada',
            'fuente': fuente or FUENTE[camara], 'tipo': 'sala', 'numero': numero, 'clase': clase, 'tabla': 'por_confirmar'}


def hhmm(h, m):
    return f'{int(h):02d}:{int(m):02d}'


def parse_camara_sala(xml):
    """Sesiones de Sala de la Cámara desde WSSala.retornarSesionesXAnno."""
    salida = []
    for b in re.findall(r'(?s)<Sesion>.*?</Sesion>', xml or ''):
        ini, fin = _campo(b, 'FechaInicio'), _campo(b, 'FechaTermino')
        if not re.match(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}', ini):
            continue
        numero = _campo(b, 'Numero')
        s = nueva_sesion_sala(CAMARA, ini[:10], ini[11:16], fin[11:16] if re.match(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}', fin) else '',
                              int(numero) if numero.isdigit() else None, _campo(b, 'Tipo'))
        s['id_camara'] = _campo(b, 'Id')
        estado = _campo(b, 'Estado').lower()
        if re.search(r'suspend|sin efecto|anulad|cancel|no se realiz', estado):
            s['estado'] = 'sin efecto'
        s['celebrada'] = 'celebrada' in estado
        salida.append(s)
    return salida


def legislatura_actual(xml):
    m = re.search(r'<Numero>(\d+)</Numero>', xml or '')
    return int(m.group(1)) if m else None


def fecha_hora_senado(texto):
    """«Jueves 19 de Noviembre de 2026 15:0» → ('2026-11-19', '15:00')."""
    m = re.search(r'(\d{1,2})\s+de\s+([A-Za-záéíóú]+)\s+de\s+(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?', texto or '')
    if not m or m.group(2).lower() not in MESES:
        return '', ''
    try:
        fecha = dt.date(int(m.group(3)), MESES[m.group(2).lower()], int(m.group(1))).isoformat()
    except ValueError:
        return '', ''
    return fecha, (hhmm(m.group(4), m.group(5)) if m.group(4) else '')


def parse_senado_sala(xml):
    """Sesiones de Sala del Senado desde wspublico/sesiones.php."""
    salida = []
    for b in re.findall(r'(?s)<sesion>.*?</sesion>', xml or ''):
        fecha, inicio = fecha_hora_senado(_campo(b, 'FECHAINICIO'))
        if not fecha:
            continue
        _, termino = fecha_hora_senado(_campo(b, 'FECHATERMINO'))
        numero = _campo(b, 'NUMERO')
        s = nueva_sesion_sala(SENADO, fecha, inicio, termino, int(numero) if numero.isdigit() else None, _campo(b, 'TIPO'))
        s['id_senado'] = _campo(b, 'SESIID')
        salida.append(s)
    return salida


def leer_json(ruta, defecto):
    try:
        with open(ruta, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return defecto


def _inicio(s):
    m = re.search(r'(\d{1,2})[:.](\d{2})', s.get('hora') or s.get('horario') or '')
    return hhmm(m.group(1), m.group(2)) if m else ''


def aplicar_tablas(sesiones, tablas):
    """Une a las sesiones de Sala la tabla que cargó el equipo en el panel (data/tabla_sala.json).

    Se busca la sesión por cámara y número; si la tabla no trae número (la Tabla Semanal de la Cámara), por cámara,
    fecha y hora de inicio, o por cámara y fecha cuando ese día hay una sola sesión. Si la sesión todavía no está en
    las fuentes automáticas, se crea con los datos de la tabla. Devuelve las sesiones creadas."""
    creadas = []
    for t in tablas or []:
        camara = t.get('camara')
        if camara not in ORGANO or not re.match(r'\d{4}-\d{2}-\d{2}$', str(t.get('fecha', ''))):
            continue
        del_dia = [s for s in sesiones + creadas if s.get('tipo') == 'sala' and s['camara'] == camara and s['fecha'] == t['fecha']]
        s = None
        if t.get('numero'):
            s = next((x for x in sesiones + creadas if x.get('tipo') == 'sala' and x['camara'] == camara and x.get('numero') == t['numero']), None)
        if s is None:
            inicio = _inicio({'horario': t.get('horario', '')})
            s = next((x for x in del_dia if inicio and _inicio(x) == inicio), None)
            if s is None and len(del_dia) == 1 and not t.get('numero'):
                s = del_dia[0]
        if s is None:
            m = re.findall(r'(\d{1,2})[:.](\d{2})', t.get('horario', ''))
            s = nueva_sesion_sala(camara, t['fecha'], hhmm(*m[0]) if m else '', hhmm(*m[1]) if len(m) > 1 else '',
                                  t.get('numero'), t.get('clase', ''), 'Tabla cargada por el equipo desde ' + ('camara.cl' if camara == CAMARA else 'senado.cl'))
            creadas.append(s)
        puntos = [p for p in (t.get('puntos') or []) if isinstance(p, dict)]
        bols = []
        for p in puntos:
            for b in p.get('boletines') or []:
                if isinstance(b, str) and RE_BOLETIN.match(b) and b not in bols:
                    bols.append(b)
        s.update({'puntos': puntos, 'boletines': bols, 'materias': [str(p.get('texto', ''))[:500] for p in puntos if p.get('texto')][:10],
                  'tabla': 'cargada', 'tabla_leida': t.get('leido', ''), 'asistida': True})
        if t.get('numero') and not s.get('numero'):
            s['numero'] = t['numero']
        if t.get('clase') and not s.get('clase'):
            s['clase'] = t['clase']
    sesiones.extend(creadas)
    return creadas


RE_INVESTIGADORA = re.compile(r'(?i)investigadora|\bCEI\b')
RE_VOTACION = re.compile(r'(?i)\bvot(ar|aci[oó]n|aciones)\b|hasta (su )?total despacho')
RE_DISCUSION = re.compile(r'(?i)discusi[oó]n|estudio|iniciar|continuar|tratar|analizar|informe|tr[aá]mite')
RE_AUDIENCIA = re.compile(r'(?i)recibir|audiencia|expon|exposici[oó]n|escuchar|invit')


def actividad(s):
    """Etiqueta de la actividad de una sesión, la misma para el sitio y para la versión estática."""
    texto = ' '.join([s.get('organo', '')] + (s.get('materias') or []))
    if s.get('tipo') == 'sala' and not s.get('puntos') and not s.get('boletines'):
        return 'Sala'
    if RE_INVESTIGADORA.search(s.get('organo', '')):
        return 'Investigadora'
    if RE_VOTACION.search(texto):
        return 'Votación'
    if s.get('boletines') and (s.get('tipo') == 'sala' or RE_DISCUSION.search(texto)):
        return 'Discusión'
    if RE_AUDIENCIA.search(texto):
        return 'Audiencia'
    return 'Otra'


def asignar_especiales(sesiones, especiales):
    """Sesiones sin boletín cuyo texto nombra un proyecto especial (por ejemplo, la Ley de Presupuestos)."""
    for s in sesiones:
        if s.get('boletines'):
            continue
        texto = ' '.join([s.get('organo', '')] + (s.get('materias') or []))
        for b, e in (especiales or {}).items():
            if RE_BOLETIN.match(b) and any(p.lower() in texto.lower() for p in e.get('patrones', [])):
                s['boletines'] = [b]
                break


def parse_votaciones(xml, desde):
    """Votaciones de Sala de la Cámara con boletín, desde una fecha, resumidas por día y boletín."""
    grupos = {}
    for b in re.findall(r'(?s)<Votacion>.*?</Votacion>', xml or ''):
        fecha = _campo(b, 'Fecha')
        m = re.search(r'(\d{4,6}-\d{2})', _campo(b, 'Descripcion'))
        if not m or fecha[:10] < desde or not re.match(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}', fecha):
            continue
        clave = (fecha[:10], m.group(1))
        g = grupos.setdefault(clave, {'fecha': fecha[:10], 'boletin': m.group(1), 'votaciones': 0, 'aprobadas': 0, 'rechazadas': 0, 'ultima': None})
        resultado = _campo(b, 'Resultado')
        g['votaciones'] += 1
        g['aprobadas'] += 1 if resultado.lower().startswith('aprob') else 0
        g['rechazadas'] += 1 if resultado.lower().startswith('rechaz') else 0
        hora = fecha[11:16]
        if g['ultima'] is None or hora >= g['ultima']['hora']:
            num = lambda k: int(_campo(b, k) or 0) if _campo(b, k).isdigit() else 0  # noqa: E731
            g['ultima'] = {'hora': hora, 'resultado': resultado, 'si': num('TotalSi'), 'no': num('TotalNo'), 'abstencion': num('TotalAbstencion')}
    return sorted(grupos.values(), key=lambda g: (g['fecha'], g['boletin']), reverse=True)


def clave_sesion(s):
    return (s.get('camara', ''), s.get('organo', ''), s.get('fecha', ''), _inicio(s))


def pasadas(actuales, anteriores, hoy):
    """Sesiones de los últimos días (antes de hoy): las de esta lectura y las que ya estaban en la agenda anterior.
    Cuando una sesión está en ambas, vale la de esta lectura."""
    desde = (hoy - dt.timedelta(days=DIAS_PASADOS)).isoformat()
    hasta = hoy.isoformat()
    vistas, salida = set(), []
    for s in list(actuales) + list(anteriores):
        if not (desde <= s.get('fecha', '') < hasta):
            continue
        k = clave_sesion(s)
        if k in vistas:
            continue
        vistas.add(k)
        salida.append(s)
    salida.sort(key=lambda s: (s['fecha'], _inicio(s) or '99', s.get('camara', ''), s.get('organo', '')))
    return salida


def leer_seguidos(ruta):
    """Boletines de data/boletines_extra.txt (uno por línea; # para comentarios)."""
    salida = []
    try:
        with open(ruta, encoding='utf-8') as f:
            for linea in f:
                m = re.match(r'\s*(\d{4,6}-\d{2})\b', linea)
                if m and m.group(1) not in salida:
                    salida.append(m.group(1))
    except OSError:
        pass
    return salida


def ruta_datos(raiz, nombre):
    return os.path.join(raiz, 'data', nombre)
