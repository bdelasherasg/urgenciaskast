"""Pruebas de la lectura de comisiones del Senado (tramitacion.senado.cl), con páginas reales guardadas el 26 de
noviembre de 2026 en pruebas/fixtures."""
import datetime as dt
import os
import sys
import unittest

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, '..', 'scripts'))
import senado_comisiones as C  # noqa: E402


def fixture(nombre):
    with open(os.path.join(AQUI, 'fixtures', nombre), encoding='utf-8') as f:
        return f.read()


class UltimasSesiones(unittest.TestCase):
    def setUp(self):
        self.r = C.parse_ultimas_sesiones(fixture('senado_ultimas_sesiones.html'))

    def test_lee_solo_las_sesiones_con_proyecto(self):
        self.assertEqual(len(self.r), 26)
        self.assertTrue(all(x['boletines'] for x in self.r))
        self.assertFalse(any('Zonas Extremas' in x['organo'] for x in self.r))

    def test_sesion_fracasada(self):
        x = next(x for x in self.r if x['boletines'] == ['15975-25'])
        self.assertEqual(x['hito'], 'Sesión fracasada')
        self.assertEqual((x['fecha'], x['hora']), ('2026-11-24', '15:00'))

    def test_nombre_de_comision_y_acuerdos(self):
        x = next(x for x in self.r if x['boletines'] == ['14838-03'])
        self.assertEqual(x['organo'], 'Comisión de Economía')
        self.assertIn('Acuerdos: Continuar en una próxima sesión', x['resultado'])

    def test_varios_boletines_refundidos(self):
        x = next(x for x in self.r if '18338-06' in x['boletines'])
        self.assertEqual(sorted(x['boletines']), ['17211-06', '17790-06', '18020-06', '18338-06'])

    def test_fusionar_conserva_lo_anterior_y_prefiere_lo_nuevo(self):
        viejo = dict(self.r[0], resultado='versión anterior')
        antiguo = dict(self.r[0], fecha='2026-01-01')
        salida = C.fusionar(self.r, [viejo, antiguo], dt.date(2026, 11, 26))
        self.assertEqual(len(salida), 26)
        self.assertNotIn('versión anterior', [x['resultado'] for x in salida])


class PlazosIndicaciones(unittest.TestCase):
    def test_lee_boletin_fecha_y_lugar(self):
        p = C.parse_plazos(fixture('senado_plazos_indicaciones.html'))
        self.assertEqual([(x['boletin'], x['fecha'], x['hora']) for x in p],
                         [('18585-25', '2026-11-26', '12:00'), ('18860-15', '2026-12-03', '12:00'), ('16553-12', '2026-11-27', '12:00')])
        self.assertEqual(p[2]['donde'], 'Para presentar en secretaría de la comisión de medio ambiente, cambio climático y bienes nacionales')


if __name__ == '__main__':
    unittest.main()
