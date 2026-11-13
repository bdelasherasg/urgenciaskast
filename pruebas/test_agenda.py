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
