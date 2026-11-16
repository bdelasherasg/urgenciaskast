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
        for texto in (paginas.AVISO_CAUSAS, paginas.AVISO_CORRECCION, paginas.AVISO_PROPONE_UNO, paginas.AVISO_PROPONE_VARIOS,
                      paginas.AVISO_YA_CITADO, paginas.AVISO_Y_OTROS):
            with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'app.js'), encoding='utf-8') as f:
                self.assertIn(texto, f.read())


class CandidatosDeErrata(unittest.TestCase):
    def setUp(self):
        otros = ['Regula la prevención de incendios forestales en zonas rurales', 'Sube la multa por no usar sillas de retención infantil',
                 'Crea el delito de reclutar adolescentes para bandas criminales', 'Fija reglas para cobrar las deudas del crédito universitario',
                 'Amplía el seguro de acompañamiento de hijos con enfermedades graves', 'Regula las neurotecnologías y protege datos neuronales',
                 'Obliga a controlar el consumo de drogas del personal policial', 'Prohíbe la maternidad subrogada y anula esos contratos',
                 'Extiende el permiso postnatal parental de madres y padres', 'Crea una ley propia para el fútbol amateur y su seguridad',
                 'Reforma la ley de bases del medio ambiente y su evaluación', 'Agrega prevención de la infertilidad a las tareas de las matronas']
        proyectos = [{'boletin': f'1{i:04d}-0{i % 9 + 1}', 'titulo': t, 'camara_actual': 'Cámara de Diputados'} for i, t in enumerate(otros)]
        proyectos += [
            {'boletin': '18331-17', 'camara_actual': 'Cámara de Diputados',
             'titulo': 'Modifica la ley N° 20.405, del Instituto Nacional de Derechos Humanos, en materia de transparencia y gobierno corporativo'},
            {'boletin': '18754-17', 'camara_actual': 'Cámara de Diputados', 'titulo': 'Reforma el Instituto Nacional de Derechos Humanos'}]
        self.urg = {'proyectos': proyectos}
        self.ag = {'proyectos': {}, 'sesiones': [{
            'fecha': '2026-11-16', 'hora': '17:15', 'camara': 'Cámara de Diputados', 'organo': 'Comisión de Derechos Humanos',
            'boletines': ['18331-17', '18574-17'],
            'materias': ['continuar con la discusión en general de los proyectos de ley refundidos relativos a la reforma del '
                         'Instituto Nacional de Derechos Humanos (boletines N° 18574-17 y 18331-17).',
                         'Para este objeto, se acordó recibir al exministro de Justicia y a la directora de un centro universitario.']}]}

    def test_propone_los_proyectos_de_la_materia_aunque_el_numero_difiera_en_cualquier_cifra(self):
        r = paginas.candidatos_errata('18574-17', self.urg, self.ag, {})
        self.assertEqual({c['boletin'] for c in r['candidatos']}, {'18754-17', '18331-17'})

    def test_marca_el_que_ya_figura_en_la_citacion(self):
        r = paginas.candidatos_errata('18574-17', self.urg, self.ag, {})
        ya = {c['boletin']: c['ya_citado'] for c in r['candidatos']}
        self.assertTrue(ya['18331-17'])
        self.assertFalse(ya['18754-17'])

    def test_no_propone_proyectos_de_otra_materia(self):
        r = paginas.candidatos_errata('18574-17', self.urg, self.ag, {})
        self.assertFalse(any('incendios' in c['titulo'] or 'medio ambiente' in c['titulo'] for c in r['candidatos']))

    def test_el_numero_citado_en_otro_sufijo_no_influye(self):
        self.ag['sesiones'][0]['boletines'] = ['18331-17', '99999-99']
        self.ag['sesiones'][0]['materias'][0] = self.ag['sesiones'][0]['materias'][0].replace('18574-17', '99999-99')
        r = paginas.candidatos_errata('99999-99', self.urg, self.ag, {})
        self.assertIn('18754-17', {c['boletin'] for c in r['candidatos']})

    def test_materia_sin_descripcion_no_propone_nada(self):
        self.ag['sesiones'][0]['materias'] = ['Tabla de la sesión.']
        r = paginas.candidatos_errata('18574-17', self.urg, self.ag, {})
        self.assertEqual(r['candidatos'], [])
        self.assertEqual(paginas.aviso_html('18574-17', self.urg, self.ag, {}), paginas.esc(paginas.AVISO_SIN_DATOS))

    def test_aviso_con_enlaces_y_marca(self):
        html = paginas.aviso_html('18574-17', self.urg, self.ag, {})
        self.assertIn('podría corresponder a uno de estos proyectos:', html)
        self.assertIn('<a href="{{BASE}}p/18754-17.html">18754-17</a>', html)
        self.assertIn('(ya figura en esta citación)', html)
        self.assertIn('esta fila se actualiza', html)

    def test_con_un_solo_candidato_el_texto_va_en_singular(self):
        self.ag['sesiones'][0]['materias'][0] = 'continuar la discusión de la reforma del Instituto Nacional de Derechos Humanos que reduce su Consejo'
        self.urg['proyectos'] = [p for p in self.urg['proyectos'] if p['boletin'] != '18331-17']
        html = paginas.aviso_html('18574-17', self.urg, self.ag, {})
        self.assertIn('podría corresponder al proyecto <a', html)


if __name__ == '__main__':
    unittest.main()
