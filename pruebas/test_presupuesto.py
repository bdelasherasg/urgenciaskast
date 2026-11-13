"""Pruebas de scripts/presupuesto.py: la Ley de Presupuestos vigente desde datos.gob.cl.

    python3 -m unittest discover -s pruebas
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'scripts'))
import presupuesto as P  # noqa: E402

CSV_PARTIDA = ('﻿Año;Mes;Moneda;Partida;Nombre Partida;Subtítulo;Nombre Subtítulo;Monto Ley Inicial;Monto Ley Vigente a Septiembre\n'
               '2026;Septiembre;Pesos;09;MINISTERIO DE EDUCACIÓN;09;APORTE FISCAL;16.000.000;16.500.000\n'
               '2026;Septiembre;Pesos;09;MINISTERIO DE EDUCACIÓN;21;GASTOS EN PERSONAL;2.840.546;3.009.136\n'
               '2026;Septiembre;Pesos;09;MINISTERIO DE EDUCACIÓN;24;TRANSFERENCIAS CORRIENTES;13.001.276;12.999.395\n'
               '2026;Septiembre;Dolares;06;MINISTERIO DE RELACIONES EXTERIORES;22;BIENES Y SERVICIOS DE CONSUMO;1.200;1.100\n'
               '2026;Septiembre;Pesos;50;TESORO PÚBLICO;11;VENTA DE ACTIVOS FINANCIEROS;-1.216.034;-1.348.887\n')


def paquete(titulo):
    return {'title': titulo, 'name': titulo.lower().replace(' ', '-'), 'resources': [
        {'name': 'A nivel Nacional', 'url': 'n.csv'}, {'name': 'A nivel Partida', 'url': 'p.csv'}]}


class Lectura(unittest.TestCase):
    def test_solo_suma_los_subtitulos_de_gasto(self):
        filas, vig = P.filas(CSV_PARTIDA.encode('utf-8'))
        partidas = P.por_partida(filas, vig)
        self.assertEqual(partidas['09']['pesos'], {'inicial': 2840546 + 13001276, 'vigente': 3009136 + 12999395})
        self.assertNotIn('dolares', partidas['09'])
        self.assertEqual(partidas['06']['dolares'], {'inicial': 1200, 'vigente': 1100})
        self.assertNotIn('pesos', partidas['06'])
        self.assertEqual(partidas['50'], {'nombre': 'TESORO PÚBLICO'})  # solo ingresos: sin gasto

    def test_numeros_con_punto_de_miles_y_signo(self):
        self.assertEqual(P.numero('16.000.000'), 16000000)
        self.assertEqual(P.numero('-1.216.034'), -1216034)
        self.assertEqual(P.numero(''), 0)

    def test_columnas_inesperadas_fallan(self):
        with self.assertRaises(ValueError):
            P.filas('Año;Mes;Monto\n2026;Enero;1\n')


class Eleccion(unittest.TestCase):
    def test_elige_el_ultimo_mes_de_la_ley_regular_del_anno(self):
        res = [paquete('Ley de Presupuestos Inicial y Vigente a Septiembre de 2026 del Gobierno Central - Total'),
               paquete('Ley de Presupuestos Inicial y Vigente a Agosto de 2026 del Gobierno Central - Ley Regular'),
               paquete('Ley de Presupuestos Inicial y Vigente a Septiembre de 2026 del Gobierno Central - Ley Regular'),
               paquete('Ley de Presupuestos Inicial y Vigente a Diciembre de 2025 del Gobierno Central - Ley Regular'),
               paquete('Ley de Presupuestos Inicial y Vigente a Septiembre de 2026 del Gobierno Central - FET Incendios')]
        mes, p = P.elegir_conjunto(res, 2026)
        self.assertEqual(mes, 9)
        self.assertTrue(p['title'].endswith('Septiembre de 2026 del Gobierno Central - Ley Regular'))
        self.assertEqual(P.recurso(p, 'partida'), 'p.csv')

    def test_sin_conjunto_del_anno(self):
        self.assertIsNone(P.elegir_conjunto([paquete('Ley de Presupuestos Inicial y Vigente a Mayo de 2024 del Gobierno Central - Ley Regular')], 2026))

    def test_anno_del_proyecto(self):
        self.assertEqual(P.anno_del_proyecto({'nombre': 'Ley de Presupuestos 2027'}), 2027)
        self.assertIsNone(P.anno_del_proyecto({'nombre': 'Ley de Presupuestos'}))


if __name__ == '__main__':
    unittest.main()
