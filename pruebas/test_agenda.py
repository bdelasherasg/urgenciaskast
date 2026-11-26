"""Pruebas de la agenda: citaciones de la Cámara cargadas por el equipo en el panel.

    python3 -m unittest discover -s pruebas
"""
import datetime as dt
import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'scripts'))
import agenda  # noqa: E402


def sesion(**extra):
    base = {'fecha': '2026-11-17', 'horario': '15:00', 'organo': 'Comisión de Educación', 'lugar': 'Sala 1',
            'boletines': ['18461-04'], 'materias': ['Continuar la votación en particular.']}
    base.update(extra)
    return base


class CitacionesAsistidas(unittest.TestCase):
    def leer(self, sesiones, leido='2026-11-13T10:00'):
        with tempfile.TemporaryDirectory() as carpeta:
            ruta = os.path.join(carpeta, 'citaciones.json')
            with open(ruta, 'w', encoding='utf-8') as f:
                json.dump({'leido': leido, 'sesiones': sesiones}, f)
            anterior, agenda.CITACIONES_ASISTIDAS = agenda.CITACIONES_ASISTIDAS, ruta
            try:
                return agenda.citaciones_asistidas('2026-11-13', '2026-11-26', dt.date(2026, 11, 13))[0]
            finally:
                agenda.CITACIONES_ASISTIDAS = anterior

    def test_la_sesion_sin_efecto_llega_marcada(self):
        salida = self.leer([sesion(estado='sin efecto')])
        self.assertEqual(len(salida), 1)
        self.assertEqual(salida[0]['estado'], 'sin efecto')

    def test_una_sesion_normal_queda_citada(self):
        salida = self.leer([sesion()])
        self.assertEqual(salida[0]['estado'], 'citada')
        self.assertTrue(salida[0]['asistida'])
        self.assertEqual(salida[0]['hora'], '15:00')

    def test_se_descartan_sesiones_fuera_de_la_ventana(self):
        salida = self.leer([sesion(fecha='2026-12-30'), sesion(fecha='2026-11-10')])
        self.assertEqual(salida, [])

    def test_las_sesiones_sin_proyecto_de_ley_tambien_se_muestran(self):
        salida = self.leer([sesion(boletines=[], materias=['Recibir al Subsecretario.']), sesion(boletines=['abc'])])
        self.assertEqual(len(salida), 2)
        self.assertEqual([s['boletines'] for s in salida], [[], []])

    def test_vigencia_de_la_carga(self):
        self.assertEqual(len(self.leer([sesion()], leido='2026-10-25T10:00')), 1)   # 19 días
        self.assertEqual(self.leer([sesion()], leido='2026-10-20T10:00'), [])        # 24 días


if __name__ == '__main__':
    unittest.main()


class SenadoSinRestosDePlantilla(unittest.TestCase):
    """El Senado publica bloques comentados con marcadores %%...%% que no deben llegar a las materias."""

    HTML = ('<p>martes 17 de noviembre de 2026</p><table>'
            '<tr><td>COMISIÓN:</td><td>Hacienda</td></tr>'
            '<tr><td>HORARIO:</td><td>09:00 a 10:00</td></tr>'
            '<tr><td>MATERIA:</td><td><p>1.- Informe de Estabilidad Financiera (IEF) del Banco Central de Chile.</p>'
            '<!-- <div>%%CITACION_FECHA.COMINOMBRE%% [<a href="x">ver</a>]</div> --></td></tr></table>')

    def test_las_materias_quedan_limpias(self):
        sesiones = agenda.parse_senado(agenda.a_lineas(self.HTML))
        self.assertEqual(len(sesiones), 1)
        self.assertEqual(sesiones[0]['materias'],
                         ['1.- Informe de Estabilidad Financiera (IEF) del Banco Central de Chile.'])

    def test_un_marcador_suelto_tambien_se_descarta(self):
        self.assertEqual(agenda.a_lineas('<p>Materia real</p><p>%%CITACION_FECHA.COMINOMBRE%% []</p><p>--></p>'),
                         ['Materia real'])


class SinSesionesRepetidas(unittest.TestCase):
    """Cuando camara.cl o el Senado rechazan la lectura, la agenda conserva las comisiones anteriores, pero nunca
    las sesiones de Sala: esas llegan siempre por su propia fuente. Antes se sumaba una copia en cada ejecución."""

    def correr(self, veces, anterior):
        import shutil
        sala_xml = ('<r><Sesion><Id>4860</Id><Numero>100</Numero><Tipo>Ordinaria</Tipo><FechaInicio>2026-11-30T12:00:00</FechaInicio>'
                    '<FechaTermino></FechaTermino><Estado>Citada</Estado></Sesion></r>')
        carpeta = tempfile.mkdtemp()
        rutas = {k: os.path.join(carpeta, k + '.json') for k in ('agenda', 'urgencias', 'citaciones', 'tabla', 'votaciones', 'especiales', 'resultados_senado')}
        with open(rutas['agenda'], 'w', encoding='utf-8') as f:
            json.dump(anterior, f)
        respaldo = {k: getattr(agenda, k) for k in ('SALIDA', 'URGENCIAS', 'CITACIONES_ASISTIDAS', 'TABLA_SALA', 'VOTACIONES_SALA', 'ESPECIALES', 'RESULTADOS_SENADO')}
        respaldo_a = (agenda.A.bajar, agenda.A.hoy_chile, agenda.A.en_paralelo)
        agenda.SALIDA, agenda.URGENCIAS, agenda.CITACIONES_ASISTIDAS = rutas['agenda'], rutas['urgencias'], rutas['citaciones']
        agenda.TABLA_SALA, agenda.VOTACIONES_SALA, agenda.ESPECIALES = rutas['tabla'], rutas['votaciones'], rutas['especiales']
        agenda.RESULTADOS_SENADO = rutas['resultados_senado']
        agenda.A.bajar = lambda url, *a, **k: sala_xml.encode() if 'retornarSesionesXAnno' in url else None
        agenda.A.hoy_chile = lambda: dt.date(2026, 11, 26)
        agenda.A.en_paralelo = lambda *a, **k: {}
        try:
            for _ in range(veces):
                agenda.principal()
            with open(rutas['agenda'], encoding='utf-8') as f:
                return json.load(f)
        finally:
            for k, v in respaldo.items():
                setattr(agenda, k, v)
            agenda.A.bajar, agenda.A.hoy_chile, agenda.A.en_paralelo = respaldo_a
            shutil.rmtree(carpeta)

    def test_la_sala_no_se_duplica_cuando_fallan_las_comisiones(self):
        sala = {'fecha': '2026-11-30', 'hora': '12:00', 'camara': 'Cámara de Diputados', 'organo': 'Sala de la Cámara', 'tipo': 'sala',
                'numero': 100, 'boletines': [], 'materias': [], 'estado': 'citada'}
        sala_senado = dict(sala, camara='Senado', organo='Sala del Senado', numero=90, fecha='2026-12-01', hora='15:00')
        comision = {'fecha': '2026-12-01', 'hora': '10:00', 'horario': '10:00', 'camara': 'Senado', 'organo': 'Comisión de Hacienda',
                    'boletines': ['18643-05'], 'materias': ['x'], 'estado': 'citada'}
        salida = self.correr(3, {'sesiones': [sala, sala, sala_senado, comision], 'legislatura': 374})
        salas = [s for s in salida['sesiones'] if s.get('tipo') == 'sala']
        self.assertEqual(len([s for s in salas if s['camara'] == 'Cámara de Diputados']), 1)
        self.assertEqual(len([s for s in salas if s['camara'] == 'Senado']), 1)   # su fuente no respondió: se conserva, una vez
        self.assertEqual(len([s for s in salida['sesiones'] if s['organo'] == 'Comisión de Hacienda']), 1)

    def test_una_sesion_de_sala_iniciada_con_atraso_no_se_cuenta_dos_veces(self):
        import sala as S
        citada = {'camara': 'Cámara de Diputados', 'organo': 'Sala de la Cámara', 'tipo': 'sala', 'numero': 98, 'fecha': '2026-11-24', 'hora': '10:00'}
        iniciada = dict(citada, hora='10:02')
        self.assertEqual(len(S.pasadas([iniciada], [citada], dt.date(2026, 11, 26))), 1)
