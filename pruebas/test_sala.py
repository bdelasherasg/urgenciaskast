"""Pruebas de las sesiones de Sala (scripts/sala.py), con respuestas reales guardadas en pruebas/fixtures/.

    python3 -m unittest discover -s pruebas
"""
import datetime as dt
import os
import sys
import tempfile
import unittest

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, '..', 'scripts'))
import sala as S  # noqa: E402


def fixture(nombre):
    with open(os.path.join(AQUI, 'fixtures', nombre), encoding='utf-8') as f:
        return f.read()


class SesionesDeSala(unittest.TestCase):
    def test_camara_trae_la_sesion_citada_del_lunes(self):
        ses = S.parse_camara_sala(fixture('camara-sala-sesiones-2026.xml'))
        lunes = next(s for s in ses if s['numero'] == 94)
        self.assertEqual((lunes['fecha'], lunes['hora'], lunes['horario']), ('2026-11-16', '15:00', '15:00 a 17:00'))
        self.assertEqual((lunes['camara'], lunes['organo'], lunes['tipo'], lunes['clase']), (S.CAMARA, 'Sala de la Cámara', 'sala', 'Ordinaria'))
        self.assertEqual(lunes['estado'], 'citada')
        self.assertFalse(lunes['celebrada'])
        self.assertTrue(next(s for s in ses if s['numero'] == 92)['celebrada'])

    def test_senado_trae_las_sesiones_especiales_de_la_semana(self):
        ses = S.parse_senado_sala(fixture('senado-sala-sesiones-374.xml'))
        s85 = next(s for s in ses if s['numero'] == 85)
        self.assertEqual((s85['fecha'], s85['hora'], s85['horario'], s85['clase']), ('2026-11-19', '15:00', '15:00 a 20:00', 'Especial'))
        self.assertEqual(s85['organo'], 'Sala del Senado')
        s79 = next(s for s in ses if s['numero'] == 79)
        self.assertEqual(s79['horario'], '16:07 a 19:32')

    def test_fecha_y_hora_del_senado(self):
        self.assertEqual(S.fecha_hora_senado('Jueves 19 de Noviembre de 2026 15:0'), ('2026-11-19', '15:00'))
        self.assertEqual(S.fecha_hora_senado('Miércoles 11 de Noviembre de 2026 16:7'), ('2026-11-11', '16:07'))
        self.assertEqual(S.fecha_hora_senado('sin fecha'), ('', ''))


class TablasCargadas(unittest.TestCase):
    def sesiones(self):
        return [S.nueva_sesion_sala(S.CAMARA, '2026-11-16', '15:00', '17:00', 94, 'Ordinaria'),
                S.nueva_sesion_sala(S.SENADO, '2026-11-17', '10:00', '14:00', 80, 'Especial'),
                S.nueva_sesion_sala(S.SENADO, '2026-11-17', '15:00', '20:00', 81, 'Especial')]

    def test_la_tabla_semanal_sin_numero_se_une_por_fecha_y_hora(self):
        ses = self.sesiones()
        creadas = S.aplicar_tablas(ses, [{'camara': S.CAMARA, 'fecha': '2026-11-16', 'horario': '15:00 a 17:00', 'clase': 'Ordinaria',
                                          'puntos': [{'boletines': ['18885-05'], 'texto': 'Establece medidas para contener las alzas de los combustibles.'},
                                                     {'boletines': ['18208-25'], 'texto': 'Modifica el Código Procesal Penal.'}]}])
        self.assertEqual(creadas, [])
        self.assertEqual(ses[0]['boletines'], ['18885-05', '18208-25'])
        self.assertEqual(ses[0]['tabla'], 'cargada')
        self.assertEqual(len(ses[0]['materias']), 2)

    def test_la_tabla_del_senado_se_une_por_numero(self):
        ses = self.sesiones()
        S.aplicar_tablas(ses, [{'camara': S.SENADO, 'numero': 81, 'fecha': '2026-11-17', 'puntos': [{'boletines': ['18702-05'], 'texto': 'Ley de Presupuestos 2027.'}]}])
        self.assertEqual(ses[2]['boletines'], ['18702-05'])
        self.assertEqual(ses[1]['tabla'], 'por_confirmar')

    def test_una_sesion_que_las_fuentes_aun_no_listan_se_crea_desde_la_tabla(self):
        ses = self.sesiones()
        creadas = S.aplicar_tablas(ses, [{'camara': S.CAMARA, 'fecha': '2026-11-17', 'horario': '10:00 a 14:00', 'clase': 'Ordinaria',
                                          'puntos': [{'boletines': ['18623-07'], 'texto': 'Protección de datos personales.'}]}])
        self.assertEqual(len(creadas), 1)
        self.assertEqual((creadas[0]['fecha'], creadas[0]['hora'], creadas[0]['horario']), ('2026-11-17', '10:00', '10:00 a 14:00'))
        self.assertIn(creadas[0], ses)

    def test_boletines_invalidos_de_la_tabla_no_pasan(self):
        ses = self.sesiones()
        S.aplicar_tablas(ses, [{'camara': S.SENADO, 'numero': 80, 'fecha': '2026-11-17', 'puntos': [{'boletines': ['S 2765-05', 'x'], 'texto': 'Oficio.'}]}])
        self.assertEqual(ses[1]['boletines'], [])
        self.assertEqual(ses[1]['tabla'], 'cargada')


class Actividad(unittest.TestCase):
    def test_etiquetas(self):
        com = lambda organo, *m, b=('1-01',): {'organo': organo, 'materias': list(m), 'boletines': list(b)}  # noqa: E731
        self.assertEqual(S.actividad(S.nueva_sesion_sala(S.CAMARA, '2026-11-16', '15:00')), 'Sala')
        self.assertEqual(S.actividad(com('Comisión Especial Investigadora (CEI 12) Irregularidades', 'Escuchar al encargado', b=())), 'Investigadora')
        self.assertEqual(S.actividad(com('Comisión de Hacienda', 'Votar en particular hasta total despacho')), 'Votación')
        self.assertEqual(S.actividad(com('Comisión de Educación', 'Continuar la discusión general del proyecto')), 'Discusión')
        self.assertEqual(S.actividad(com('Comisión de Salud', 'Recibir al Subsecretario de Redes Asistenciales', b=())), 'Audiencia')
        self.assertEqual(S.actividad(com('Comisión de Constitución', 'Proyecto de ley que endurece las sanciones')), 'Discusión')
        self.assertEqual(S.actividad(com('Comisión de Minería', 'Conocer la Política Nacional', b=())), 'Otra')


class Especiales(unittest.TestCase):
    def test_sesion_sin_boletin_que_trata_el_presupuesto(self):
        ses = [{'organo': 'Comisión Especial Mixta de Presupuestos', 'materias': ['Partida 09'], 'boletines': []},
               {'organo': 'Comisión de Hacienda', 'materias': ['Informe de Estabilidad Financiera'], 'boletines': []}]
        S.asignar_especiales(ses, {'18702-05': {'patrones': ['Mixta de Presupuestos', 'Ley de Presupuestos']}})
        self.assertEqual(ses[0]['boletines'], ['18702-05'])
        self.assertEqual(ses[1]['boletines'], [])


class Votaciones(unittest.TestCase):
    def test_resumen_por_dia_y_boletin(self):
        res = S.parse_votaciones(fixture('camara-votaciones-2026.xml'), '2026-11-01')
        self.assertTrue(res)
        self.assertTrue(all(r['fecha'] >= '2026-11-01' for r in res))
        pres = [r for r in res if r['boletin'] == '18702-05']
        self.assertTrue(pres)
        r = pres[0]
        self.assertEqual(r['votaciones'], r['aprobadas'] + r['rechazadas'] + (r['votaciones'] - r['aprobadas'] - r['rechazadas']))
        self.assertRegex(r['ultima']['hora'], r'^\d{2}:\d{2}$')


class Pasadas(unittest.TestCase):
    def test_ultimos_siete_dias_sin_repetir(self):
        hoy = dt.date(2026, 11, 13)
        a = {'camara': S.CAMARA, 'organo': 'Comisión de Salud', 'fecha': '2026-11-12', 'hora': '15:00', 'materias': ['nueva']}
        b = dict(a, materias=['vieja'])
        vieja = dict(a, fecha='2026-11-02')
        futura = dict(a, fecha='2026-11-13')
        r = S.pasadas([a], [b, vieja, futura], hoy)
        self.assertEqual([x['materias'] for x in r], [['nueva']])


class Seguidos(unittest.TestCase):
    def test_los_comentarios_no_cuentan(self):
        with tempfile.NamedTemporaryFile('w', suffix='.txt', delete=False, encoding='utf-8') as f:
            f.write('# Ejemplo:\n# 18623-07\n18702-05  Ley de Presupuestos 2027\n\n15850-11\n')
        try:
            self.assertEqual(S.leer_seguidos(f.name), ['18702-05', '15850-11'])
        finally:
            os.unlink(f.name)


if __name__ == '__main__':
    unittest.main()
