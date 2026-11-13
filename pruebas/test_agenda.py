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

    def test_se_descartan_sesiones_fuera_de_la_ventana_o_sin_boletin(self):
        salida = self.leer([sesion(fecha='2026-12-30'), sesion(fecha='2026-11-10'), sesion(boletines=[]), sesion(boletines=['abc'])])
        self.assertEqual(salida, [])


if __name__ == '__main__':
    unittest.main()
