#!/usr/bin/env python3
"""Actualiza data/urgencias.json con las urgencias vigentes del Ejecutivo.

Fuentes:
  - Cámara de Diputadas y Diputados: mensajes ingresados por año (datos abiertos).
  - Senado: proyectos con movimiento por fecha y detalle de cada boletín, con su
    historial de urgencias (servicio público wspublico).
  - data/boletines_extra.txt: boletines que se quieran seguir aunque no aparezcan arriba.

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
PLAZOS = {'Discusión inmediata': 6, 'Suma': 15, 'Simple': 30}
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


def completar(p):
    inicio = INICIO.isoformat()
    del_gobierno = [u for u in p['urgencias'] if (u['ingreso'] or '') >= inicio]
    p['renovaciones'] = max(0, len(del_gobierno) - 1)
    vigentes = [u for u in p['urgencias'] if not u['retiro'] and u['tipo'] == p['urgencia_actual']]
    vig = vigentes[-1] if vigentes else (del_gobierno[-1] if del_gobierno else None)
    if vig and vig['ingreso']:
        desde = dt.date.fromisoformat(vig['ingreso'])
        vence = desde + dt.timedelta(days=PLAZOS.get(p['urgencia_actual'], 0))
        p['urgencia_vigente'] = {'tipo': p['urgencia_actual'], 'desde': vig['ingreso'], 'vence': vence.isoformat()}
    else:
        p['urgencia_vigente'] = {'tipo': p['urgencia_actual'], 'desde': None, 'vence': None}
    if p['fecha_ingreso']:
        p['dias_tramite'] = (dt.date.today() - dt.date.fromisoformat(p['fecha_ingreso'])).days
    else:
        p['dias_tramite'] = None
    ultimo = next((t for t in reversed(p['tramites']) if t['camara']), None)
    p['camara_actual'] = ultimo['camara'] if ultimo else p['camara_origen']
    return p


def principal():
    lista = candidatos()
    print(f'Boletines candidatos: {len(lista)}')
    proyectos = []
    for i, b in enumerate(lista, 1):
        p = detalle(b)
        time.sleep(0.4)
        if not p:
            continue
        if not p['iniciativa'].lower().startswith('mensaje'):
            continue
        if p['urgencia_actual'] not in NIVELES:
            continue
        p = completar(p)
        if not any((u['ingreso'] or '') >= INICIO.isoformat() for u in p['urgencias']):
            continue  # urgencia puesta antes de este gobierno
        proyectos.append(p)
        print(f'  [{i}/{len(lista)}] {p["boletin"]} · {p["urgencia_actual"]}')

    if not proyectos:
        print('No se obtuvo ningún proyecto. Se mantiene el archivo anterior.', file=sys.stderr)
        for e in errores[:20]:
            print('  ' + e, file=sys.stderr)
        sys.exit(1)

    proyectos.sort(key=lambda p: (p['urgencia_vigente']['vence'] or '9999', p['boletin']))
    zona = dt.timezone(dt.timedelta(hours=-3))
    salida = {
        'actualizado': dt.datetime.now(zona).isoformat(timespec='minutes'),
        'muestra': False,
        'inicio_gobierno': INICIO.isoformat(),
        'niveles': NIVELES,
        'fuentes': ['Senado, servicio wspublico de tramitación', 'Cámara de Diputadas y Diputados, datos abiertos'],
        'proyectos': proyectos,
        'errores_de_consulta': len(errores),
    }
    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
    with open(SALIDA, 'w', encoding='utf-8') as f:
        json.dump(salida, f, ensure_ascii=False, indent=1)
    print(f'Listo: {len(proyectos)} proyectos con urgencia. Errores de consulta: {len(errores)}')


if __name__ == '__main__':
    principal()
