#!/usr/bin/env python3
"""Actualiza data/urgencias.json con las urgencias vigentes del Ejecutivo.

Fuentes:
  - Cámara de Diputadas y Diputados: mensajes ingresados por año (datos abiertos).
  - Senado: proyectos con movimiento por fecha y detalle de cada boletín, con su
    historial de urgencias (servicio público wspublico).
  - data/boletines_extra.txt: boletines que se quieran seguir aunque no aparezcan arriba.

Incluye mensajes y mociones: la urgencia la pone el Ejecutivo en ambos casos.
Usa solo la biblioteca estándar de Python. Si no logra obtener ningún proyecto,
no sobrescribe el archivo existente y termina con error, para no publicar un sitio vacío.
"""
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(RAIZ, 'data', 'urgencias.json')
EXTRA = os.path.join(RAIZ, 'data', 'boletines_extra.txt')

# Niveles de urgencia que se publican. Para sumar las simples, agregar 'Simple'
# aquí y en assets/config.js.
NIVELES = ['Discusión inmediata', 'Suma']
# Ley 18.918, art. 27: plazo en la cámara requerida, en días corridos (art. 70), desde que se da cuenta.
PLAZOS = {'Discusión inmediata': 6, 'Suma': 15, 'Simple': 30}
# Ley 18.918, art. 28: plazos en comisión mixta y en cada cámara al tratar su informe.
PLAZOS_MIXTA = {'Discusión inmediata': 2, 'Suma': 5, 'Simple': 10}
INICIO = dt.date(2026, 3, 11)          # inicio del gobierno
DIAS_MOVIMIENTO = 21                    # días hacia atrás para buscar proyectos con movimiento

URL_CAMARA_MENSAJES = 'https://opendata.camara.cl/camaradiputados/WServices/WSLegislativo.asmx/retornarMensajesXAnno?prmAnno={anno}'
URL_SENADO_FECHA = 'https://tramitacion.senado.cl/wspublico/tramitacion.php?fecha={fecha}'
URL_SENADO_BOLETIN = 'https://tramitacion.senado.cl/wspublico/tramitacion.php?boletin={num}'
URL_FICHA_SENADO = 'https://portallegislativo.senado.cl/proyectos-ley?boletin={boletin}'
URL_FICHA_CAMARA = 'https://www.camara.cl/legislacion/ProyectosDeLey/tramitacion.aspx?prmBOLETIN={boletin}'

CABECERAS = {'User-Agent': 'UrgenciasKast/1.0 (seguimiento legislativo; contacto en el sitio)'}
RE_BOLETIN = re.compile(r'\b(\d{3,5})-(\d{2})\b')

errores = []


def bajar(url, intentos=3):
    for i in range(intentos):
        try:
            req = urllib.request.Request(url, headers=CABECERAS)
            with urllib.request.urlopen(req, timeout=45) as r:
                return r.read()
        except Exception as e:  # red, tiempo de espera o error HTTP
            if i == intentos - 1:
                errores.append(f'{url}: {e}')
                return None
            time.sleep(3 * (i + 1))


def fecha_iso(texto):
    texto = (texto or '').strip()
    m = re.match(r'(\d{1,2})/(\d{1,2})/(\d{4})', texto)
    if not m:
        return None
    d, mes, a = map(int, m.groups())
    try:
        return dt.date(a, mes, d).isoformat()
    except ValueError:
        return None


def txt(nodo, etiqueta):
    if nodo is None:
        return ''
    hijo = nodo.find(etiqueta)
    return (hijo.text or '').strip() if hijo is not None and hijo.text else ''


def normalizar_urgencia(t):
    t = (t or '').strip().lower()
    if 'inmediata' in t:
        return 'Discusión inmediata'
    if 'suma' in t:
        return 'Suma'
    if 'simple' in t:
        return 'Simple'
    return ''


def normalizar_camara(t):
    t = (t or '').lower()
    if 'senado' in t:
        return 'Senado'
    if 'diput' in t or t.startswith('c.') or 'cámara' in t or 'camara' in t:
        return 'Cámara de Diputados'
    return ''


def candidatos():
    boletines = set()
    hoy = dt.date.today()
    for anno in sorted({INICIO.year, hoy.year}):
        datos = bajar(URL_CAMARA_MENSAJES.format(anno=anno))
        if datos:
            for num, suf in RE_BOLETIN.findall(datos.decode('utf-8', 'replace')):
                boletines.add(f'{num}-{suf}')
    for i in range(DIAS_MOVIMIENTO):
        d = hoy - dt.timedelta(days=i)
        datos = bajar(URL_SENADO_FECHA.format(fecha=d.strftime('%d/%m/%Y')))
        if datos:
            for num, suf in RE_BOLETIN.findall(datos.decode('latin-1', 'replace')):
                boletines.add(f'{num}-{suf}')
        time.sleep(0.4)
    if os.path.exists(EXTRA):
        with open(EXTRA, encoding='utf-8') as f:
            for linea in f:
                m = RE_BOLETIN.search(linea)
                if m:
                    boletines.add(f'{m.group(1)}-{m.group(2)}')
    return sorted(boletines)


def detalle(boletin):
    num = boletin.split('-')[0]
    datos = bajar(URL_SENADO_BOLETIN.format(num=num))
    if not datos:
        return None
    try:
        raiz = ET.fromstring(datos)
    except ET.ParseError as e:
        errores.append(f'{boletin}: XML inválido ({e})')
        return None
    proy = raiz.find('.//proyecto')
    if proy is None:
        return None
    d = proy.find('descripcion')
    iniciativa = txt(d, 'iniciativa')
    actual = normalizar_urgencia(txt(d, 'urgencia_actual'))

    urgencias = []
    for u in proy.findall('./urgencias/urgencia'):
        urgencias.append({
            'tipo': normalizar_urgencia(txt(u, 'TIPO')) or txt(u, 'TIPO'),
            'ingreso': fecha_iso(txt(u, 'FECHAINGRESO')),
            'retiro': fecha_iso(txt(u, 'FECHARETIRO')),
            'camara': normalizar_camara(txt(u, 'CAMARAINGRESO')),
            'oficio': txt(u, 'MENSAJEINGRESO'),
        })
    urgencias.sort(key=lambda u: u['ingreso'] or '')

    tramites = []
    for t in proy.findall('./tramitacion/tramite'):
        tramites.append({
            'fecha': fecha_iso(txt(t, 'FECHA')),
            'descripcion': txt(t, 'DESCRIPCIONTRAMITE'),
            'etapa': txt(t, 'ETAPDESCRIPCION'),
            'camara': normalizar_camara(txt(t, 'CAMARATRAMITE')),
        })
    tramites.sort(key=lambda t: t['fecha'] or '')

    boletin_oficial = txt(d, 'boletin') or boletin
    m = RE_BOLETIN.search(boletin_oficial)
    if m:
        boletin_oficial = f'{m.group(1)}-{m.group(2)}'

    return {
        'boletin': boletin_oficial,
        'titulo': txt(d, 'titulo'),
        'fecha_ingreso': fecha_iso(txt(d, 'fecha_ingreso')),
        'iniciativa': iniciativa,
        'camara_origen': normalizar_camara(txt(d, 'camara_origen')) or txt(d, 'camara_origen'),
        'urgencia_actual': actual,
        'etapa': txt(d, 'etapa'),
        'subetapa': txt(d, 'subetapa'),
        'estado': txt(d, 'estado'),
        'urgencias': urgencias,
        'tramites': tramites,
        'enlaces': {
            'senado': URL_FICHA_SENADO.format(boletin=boletin_oficial),
            'camara': URL_FICHA_CAMARA.format(boletin=boletin_oficial),
            'mensaje': txt(d, 'link_mensaje_mocion'),
        },
    }


ETAPAS_FUERA = ('tramitación terminada', 'tribunal constitucional', 'aprobacion presidencial', 'aprobación presidencial', 'archivad', 'retirad')


def en_congreso(p):
    estado = (p.get('estado') or '').lower()
    etapa = (p.get('etapa') or '').lower()
    if estado and estado != 'en tramitación' and estado != 'en tramitacion':
        return False
    return not any(x in etapa for x in ETAPAS_FUERA)


def depurar_urgencias(urgencias):
    """Quita duplicados del servicio del Senado.

    - Entradas idénticas (mismo tipo, fecha y oficio).
    - Entradas sin cámara que repiten el tipo y la fecha de otra con cámara: corresponden al
      número del mensaje de ingreso, no a una urgencia distinta.
    """
    vistos, salida = set(), []
    for u in urgencias:
        clave = (u.get('tipo'), u.get('ingreso'), u.get('oficio'))
        if clave in vistos:
            continue
        vistos.add(clave)
        salida.append(u)
    con_camara = {(u['tipo'], u['ingreso']) for u in salida if u.get('camara')}
    salida = [u for u in salida if u.get('camara') or (u['tipo'], u['ingreso']) not in con_camara]
    salida.sort(key=lambda u: (u.get('ingreso') or '', u.get('oficio') or ''))
    return salida


RE_DESPACHO = re.compile(r'oficio\s+de\s+ley|c[aá]mara\s+revisora|c[aá]mara\s+de\s+origen', re.I)


def otra_camara(c):
    return {'Senado': 'Cámara de Diputados', 'Cámara de Diputados': 'Senado'}.get(c, '')


def completar(p, hoy=None):
    hoy = hoy or dt.date.today()
    inicio = INICIO.isoformat()
    p['urgencias'] = depurar_urgencias(p.get('urgencias') or [])
    del_gobierno = [u for u in p['urgencias'] if (u['ingreso'] or '') >= inicio]

    # Renovación: el gobierno vuelve a poner una urgencia del mismo tipo.
    # Cambio de tipo: pasa de una urgencia a otra (por ejemplo, de suma a discusión inmediata).
    renovaciones = cambios = 0
    for a, b in zip(del_gobierno, del_gobierno[1:]):
        if a['tipo'] == b['tipo']:
            renovaciones += 1
        else:
            cambios += 1
    p['renovaciones'] = renovaciones
    p['cambios_tipo'] = cambios
    p['urgencias_gobierno'] = len(del_gobierno)

    actual = p.get('urgencia_actual') or ''
    del_tipo = [u for u in p['urgencias'] if u['tipo'] == actual]
    abiertas = [u for u in del_tipo if not u['retiro']]
    vig = abiertas[-1] if abiertas else (del_tipo[-1] if del_tipo else (del_gobierno[-1] if del_gobierno else None))

    ultimo = next((t for t in reversed(p.get('tramites') or []) if t.get('camara')), None)
    p['camara_actual'] = ultimo['camara'] if ultimo else p.get('camara_origen', '')
    texto_etapa = ((p.get('etapa') or '') + ' ' + (p.get('subetapa') or '')).lower()
    mixta = 'mixta' in texto_etapa

    vigente = {'tipo': actual, 'desde': None, 'vence': None, 'camara': '', 'estado': 'sin_dato', 'plazo_dias': None}
    if vig and vig['ingreso']:
        plazo = (PLAZOS_MIXTA if mixta else PLAZOS).get(actual or vig['tipo'], 0)
        desde = dt.date.fromisoformat(vig['ingreso'])
        vence = desde + dt.timedelta(days=plazo)
        vigente.update({'tipo': actual or vig['tipo'], 'desde': vig['ingreso'], 'vence': vence.isoformat(),
                        'camara': vig.get('camara') or '', 'plazo_dias': plazo, 'oficio': vig.get('oficio') or ''})
        # El proyecto salió de la cámara donde corría la urgencia: el plazo se cuenta de nuevo
        # cuando la otra cámara dé cuenta de una urgencia (art. 27).
        despachado = any(
            (t.get('fecha') or '') >= vig['ingreso'] and RE_DESPACHO.search(t.get('descripcion') or '')
            and (not vig.get('camara') or t.get('camara') == vig.get('camara'))
            for t in (p.get('tramites') or [])
        )
        if not despachado and 'revisora' in (p.get('subetapa') or '').lower():
            despachado = normalizar_camara(p.get('etapa') or '') == vig.get('camara')
        if 'finaliz' in texto_etapa:
            # Ambas cámaras terminaron de votarlo; la cámara de origen lo comunica.
            vigente['estado'] = 'finalizado'
        elif despachado and not mixta:
            vigente['estado'] = 'en_espera'
            if vig.get('camara'):
                p['camara_actual'] = otra_camara(vig['camara'])
        else:
            vigente['estado'] = 'vigente' if vence >= hoy else 'vencida'
        vigente['mixta'] = mixta
    p['urgencia_vigente'] = vigente
    if p.get('fecha_ingreso'):
        p['dias_tramite'] = (hoy - dt.date.fromisoformat(p['fecha_ingreso'])).days
    else:
        p['dias_tramite'] = None
    return p


def orden(p):
    v = p['urgencia_vigente']
    grupo = {'vigente': 0, 'vencida': 1, 'en_espera': 2, 'finalizado': 3}.get(v.get('estado'), 4)
    return (grupo, v.get('vence') or '9999', p['boletin'])


def recalcular():
    """Recalcula los campos derivados del archivo existente, sin consultar fuentes."""
    with open(SALIDA, encoding='utf-8') as f:
        datos = json.load(f)
    for p in datos['proyectos']:
        completar(p)
    datos['proyectos'] = [p for p in datos['proyectos'] if p['urgencias_gobierno']]
    datos['proyectos'].sort(key=orden)
    with open(SALIDA, 'w', encoding='utf-8') as f:
        json.dump(datos, f, ensure_ascii=False, indent=1)
    print(f'Recalculado: {len(datos["proyectos"])} proyectos.')


def principal():
    lista = candidatos()
    print(f'Boletines candidatos: {len(lista)}')
    proyectos = []
    for i, b in enumerate(lista, 1):
        p = detalle(b)
        time.sleep(0.4)
        if not p:
            continue
        if p['urgencia_actual'] not in NIVELES:
            continue
        if not en_congreso(p):
            continue  # ya despachado, publicado, archivado o fuera del Congreso
        p = completar(p)
        if not p['urgencias_gobierno']:
            continue  # urgencia puesta antes de este gobierno
        proyectos.append(p)
        print(f'  [{i}/{len(lista)}] {p["boletin"]} · {p["urgencia_actual"]}')

    if not proyectos:
        print('No se obtuvo ningún proyecto. Se mantiene el archivo anterior.', file=sys.stderr)
        for e in errores[:20]:
            print('  ' + e, file=sys.stderr)
        sys.exit(1)

    proyectos.sort(key=orden)
    zona = dt.timezone(dt.timedelta(hours=-3))
    salida = {
        'actualizado': dt.datetime.now(zona).isoformat(timespec='minutes'),
        'muestra': False,
        'inicio_gobierno': INICIO.isoformat(),
        'niveles': NIVELES,
        'fuentes': ['Senado, servicio wspublico de tramitación', 'Cámara de Diputadas y Diputados, datos abiertos'],
        'plazos': {'normal': PLAZOS, 'comision_mixta': PLAZOS_MIXTA},
        'proyectos': proyectos,
        'errores_de_consulta': len(errores),
    }
    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
    with open(SALIDA, 'w', encoding='utf-8') as f:
        json.dump(salida, f, ensure_ascii=False, indent=1)
    print(f'Listo: {len(proyectos)} proyectos con urgencia. Errores de consulta: {len(errores)}')


if __name__ == '__main__':
    if '--recalcular' in sys.argv:
        recalcular()
    else:
        principal()
