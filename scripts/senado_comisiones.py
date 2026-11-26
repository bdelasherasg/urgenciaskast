"""Datos de comisiones que el Senado publica en tramitacion.senado.cl, la única parte de su sitio que responde a
lecturas automáticas (www.senado.cl las rechaza):

  - Últimas sesiones de comisiones: qué se trató en cada sesión ya realizada, si fracasó y qué se acordó.
    Se guarda en data/resultados_senado.json con la misma forma que data/resultados_camara.json.
  - Plazos de indicaciones: hasta cuándo se pueden presentar cambios a un proyecto y dónde.

Se copia el texto tal como lo publica el Senado, sin resumirlo ni interpretarlo.
"""
import datetime as dt
import html as htmlmod
import re

URL_ULTIMAS_SESIONES = 'https://tramitacion.senado.cl/appsenado/index.php?mo=comisiones&ac=ultimas_sesiones'
URL_PLAZOS_INDICACIONES = 'https://tramitacion.senado.cl/appsenado/index.php?mo=sesionessala&ac=plazosIndicaciones'
URL_SUBCOMISIONES_PRESUPUESTO = 'https://tramitacion.senado.cl/appsenado/index.php?mo=comisiones&ac=citacionesComision&tipo_consulta=4'
DIAS_RESULTADOS = 150

MESES = {'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
         'septiembre': 9, 'setiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12}
RE_BOLETIN = re.compile(r'(?<![\d.])(?<!\bS )(\d{1,2}\.?\d{3})-(\d{2})(?!\d)')


def limpio(fragmento):
    t = re.sub(r'(?s)<!--.*?-->', ' ', fragmento or '')
    t = re.sub(r'(?i)<br\s*/?>', ' ', t)
    t = htmlmod.unescape(re.sub(r'<[^>]+>', ' ', t))
    return re.sub(r'\s+', ' ', t).strip()


def boletines_en(texto):
    salida = []
    for m in RE_BOLETIN.finditer(texto or ''):
        b = m.group(1).replace('.', '') + '-' + m.group(2)
        if b not in salida:
            salida.append(b)
    return salida


def nombre_comision(titular):
    """«de Constitución, Legislación…» → «Comisión de Constitución, Legislación…»; los demás quedan igual."""
    t = limpio(titular)
    return ('Comisión ' + t) if re.match(r'(?i)^(de|del)\s', t) else t


def parse_ultimas_sesiones(html):
    """Cada sesión es un <header> con fecha, hora, comisión y duración (o «Fracasada»), seguido de una tabla
    con TEMA, MATERIA y ACUERDOS."""
    salida = []
    partes = re.split(r'(?i)<header class="shadow">', html or '')[1:]
    for p in partes:
        m = re.search(r'class="fecha">\s*(\d{2})/(\d{2})/(\d{4})\s*<strong>\s*\[(\d{1,2}):(\d{2})', p)
        t = re.search(r'(?s)<h1 class="titular[^"]*">(.*?)</h1>', p)
        if not m or not t:
            continue
        sin_comentarios = re.sub(r'(?s)<!--.*?-->', '', p.split('</header>')[0])
        fracasada = bool(re.search(r'(?i)class="duracion2">\s*Fracasada', sin_comentarios))
        campos = {}
        for etq, valor in re.findall(r'(?s)<th>\s*([A-ZÁÉÍÓÚ]+)\s*:?\s*</th>\s*<td>(.*?)</td>', p):
            campos[etq.upper()] = limpio(valor)
        tema, materia, acuerdos = campos.get('TEMA', ''), campos.get('MATERIA', ''), campos.get('ACUERDOS', '')
        organo = nombre_comision(t.group(1))
        bols = boletines_en(organo + ' ' + tema)
        if not bols:
            continue   # sesiones sin proyecto de ley (audiencias, temas generales): no van a ninguna ficha
        resultado = materia
        if acuerdos:
            resultado = (resultado + ' Acuerdos: ' if resultado else 'Acuerdos: ') + acuerdos
        salida.append({'fecha': f'{m.group(3)}-{m.group(2)}-{m.group(1)}', 'hora': f'{int(m.group(4)):02d}:{m.group(5)}',
                       'camara': 'Senado', 'organo': organo[:200], 'boletines': bols,
                       'hito': 'Sesión fracasada' if fracasada else 'Sesión realizada',
                       'citacion': tema[:1500], 'resultado': resultado[:2500]})
    return salida


def clave(r):
    return (r.get('fecha', ''), r.get('hora', ''), r.get('organo', ''))


def fusionar(nuevos, anteriores, hoy):
    """Suma lo leído hoy a lo guardado y conserva los últimos DIAS_RESULTADOS días. Si una sesión está en ambos,
    vale la lectura de hoy (el Senado completa la materia y los acuerdos después de la sesión)."""
    desde = (hoy - dt.timedelta(days=DIAS_RESULTADOS)).isoformat()
    vistas, salida = set(), []
    for r in list(nuevos) + list(anteriores):
        k = clave(r)
        if k in vistas or r.get('fecha', '') < desde:
            continue
        vistas.add(k)
        salida.append(r)
    salida.sort(key=lambda r: (r.get('fecha', ''), r.get('hora', '')), reverse=True)
    return salida


def fecha_larga(texto):
    m = re.search(r'(\d{1,2})\s+de\s+([A-Za-záéíóú]+)\s+de\s+(\d{4})', texto or '')
    if not m or m.group(2).lower() not in MESES:
        return ''
    try:
        return dt.date(int(m.group(3)), MESES[m.group(2).lower()], int(m.group(1))).isoformat()
    except ValueError:
        return ''


def oracion(texto):
    """El Senado escribe estas secciones en mayúsculas («PARA PRESENTAR EN SECRETARÍA…»): se pasan a oración."""
    letras = [c for c in texto if c.isalpha()]
    if letras and sum(c.isupper() for c in letras) > 0.8 * len(letras):
        return texto.capitalize()
    return texto


def parse_plazos(html):
    """Tabla de plazos de indicaciones: filas de sección («PARA PRESENTAR EN SECRETARÍA…») y filas con boletín,
    materia, fecha y hora."""
    salida, donde = [], ''
    for fila in re.findall(r'(?s)<tr[^>]*>(.*?)</tr>', html or ''):
        celdas = re.findall(r'(?s)<td[^>]*>(.*?)</td>', fila)
        if len(celdas) == 1:
            donde = limpio(celdas[0])
            continue
        if len(celdas) < 4:
            continue
        bols = boletines_en(limpio(celdas[0]))
        fecha = fecha_larga(limpio(celdas[2]))
        if not bols or not fecha:
            continue
        hora = limpio(celdas[3])
        salida.append({'boletin': bols[0], 'materia': limpio(celdas[1])[:500], 'fecha': fecha,
                       'hora': hora if re.fullmatch(r'\d{1,2}:\d{2}', hora) else '',
                       'donde': oracion(donde)})
    return salida
