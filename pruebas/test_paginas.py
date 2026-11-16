"""Pruebas de las páginas: aviso para boletines citados sin datos oficiales.

    python3 -m unittest discover -s pruebas
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'scripts'))
import paginas  # noqa: E402


class BoletinSinDatos(unittest.TestCase):
    def setUp(self):
        self.urg = {'proyectos': [{'boletin': '18331-17', 'titulo': 'Modifica la ley del INDH'}]}
        self.ag = {'proyectos': {}, 'sesiones': [{
            'fecha': '2026-11-16', 'hora': '17:15', 'camara': 'Cámara de Diputados',
            'organo': 'Comisión de Derechos Humanos', 'boletines': ['18331-17', '18574-17']}]}
        self.idx = {}

    def test_agenda_avisa_posible_errata(self):
        html = paginas.agenda_estatica(self.urg, self.ag, self.idx)
        self.assertIn('boletín 18574-17, sin datos oficiales para ese número', html)
        self.assertIn('errata en el número de la citación', html)
        self.assertIn('esta fila se actualiza', html)

    def test_tabla_estatica_avisa_posible_errata(self):
        html = paginas.tabla_estatica(self.urg, self.ag, self.idx)
        self.assertIn('Boletín 18574-17', html.replace('boletín', 'Boletín'))
        self.assertIn('Sin datos oficiales para este número. Puede deberse a una errata', html)

    def test_boletin_con_datos_no_lleva_aviso(self):
        self.ag['sesiones'][0]['boletines'] = ['18331-17']
        html = paginas.agenda_estatica(self.urg, self.ag, self.idx)
        self.assertNotIn('errata', html)

    def test_aviso_igual_en_el_sitio(self):
        with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'app.js'), encoding='utf-8') as f:
            js = f.read()
        self.assertIn(paginas.AVISO_SIN_DATOS, js)


if __name__ == '__main__':
    unittest.main()
