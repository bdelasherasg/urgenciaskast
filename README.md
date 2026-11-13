# Urgencias Kast

Sitio público de seguimiento legislativo: los proyectos que el Ejecutivo apura con urgencias y la agenda del
Congreso para las próximas dos semanas, con fichas verificadas y lenguaje claro.
Una producción de Lo Común: Laboratorio de Relato y Producción Narrativa. Dirección: https://urgenciaskast.cl

## No borrar

- **`CNAME`** (raíz de `main`): fija el dominio `urgenciaskast.cl`. La acción de actualización nunca lo toca.
- **Registro TXT de verificación de GitHub** en Cloudflare: mantiene el dominio verificado.

## Cómo funciona

Todo es HTML, CSS y JavaScript estático, publicado con GitHub Pages desde la rama `main`. Cada 3 horas, y cada vez
que se publica una ficha o se edita una página, la acción **Actualizar urgencias** (`.github/workflows/actualizar.yml`):

1. `scripts/actualizar.py`: consulta el Senado y la Cámara y escribe `data/urgencias.json`. Quita urgencias
   duplicadas, separa renovaciones de cambios de tipo y calcula plazos según la Ley 18.918 (artículos 27, 28 y 70).
2. `scripts/agenda.py`: arma `data/agenda.json` con las citaciones de comisiones de ambas cámaras para dos semanas
   (confirmado) y los plazos de urgencia que vencen sin citación (probable).
3. Copia `https://locomun.cl/contenido/feed.json` en `data/locomun.json` (estudios y publicaciones de Lo Común).
4. `scripts/paginas.py --sitio`: genera las páginas desde `fuente/`, una página por proyecto en `p/` (con título y
   descripción propios para compartir), `data/feed.json` (resumen que muestra locomun.cl) y `sitemap.xml`.

Si una fuente falla, se conservan los datos anteriores y el sitio sigue funcionando.

## Contenido

| Qué | Dónde |
|---|---|
| Textos de las páginas | `fuente/*.html` (se publican solos al guardar) |
| Fichas verificadas de proyectos | `data/fichas/BOLETIN.json`, que publica el panel de revisión |
| Serie Prueba pública | `data/analisis.json` y `fuente/analisis/` |
| Glosario | `data/glosario.json` |
| Correo y enlace de aportes | `assets/config.js` |
| Dirección que recibe los pedidos de análisis ampliado | `assets/config.js` (`pedidosUrl`) |
| Boletines que se quieran seguir siempre | `data/boletines_extra.txt` |

Ninguna ficha se publica sin revisión humana: los borradores se redactan y se aprueban en el repositorio privado
`urgenciaskast-revision`, cuyo panel escribe aquí solo después de completar la lista de verificación.

## Pedido de análisis ampliado gratuito

Las fichas básicas ofrecen el análisis ampliado (posiciones de organizaciones y encuadre de prensa) intercalado con los
avisos de asesoría: una tarjeta después del resumen y un aviso antes de la invitación. El formulario pide nombre,
correo, la autorización para avisar cuando la ficha se actualice (obligatoria) y, opcionalmente, la suscripción al
boletín de novedades. Lo envía al panel de Lo Común (`pedidosUrl` en `assets/config.js`), que lo guarda en el
repositorio privado; el sitio no guarda datos personales. Si `pedidosUrl` queda vacío, la oferta no se muestra.

## Licencia

Contenido y datos: Creative Commons Atribución-CompartirIgual 4.0 Internacional (CC BY-SA 4.0).

## Citaciones de la Cámara: carga semanal en el panel

El sitio de la Cámara de Diputados responde 403 (Forbidden) a las lecturas automáticas desde GitHub Actions. Mientras eso ocurra, `scripts/agenda.py` usa el archivo `data/citaciones_camara.json`, que escribe el panel de revisión (sección «Citaciones Cámara») cuando una persona pega allí la página semanal de citaciones de camara.cl. Formato:

```json
{"leido": "2026-10-31T01:10", "fuente": "https://www.camara.cl/legislacion/comisiones/citaciones_semana.aspx?prmSemana=2026-44",
 "sesiones": [{"fecha": "2026-11-03", "horario": "15:00 a 17:00", "organo": "Comisión de ...", "lugar": "",
               "boletines": ["18788-07"], "materias": ["..."]}]}
```

Reglas: el archivo solo se usa si `leido` tiene menos de 8 días y la lectura directa de la Cámara falló. Cada citación necesita fecha ISO dentro de las próximas dos semanas y boletines con formato válido. Las sesiones se marcan "Cargada por el equipo" y el chip de la agenda pide confirmar en camara.cl. Si la lectura directa vuelve a funcionar, el archivo se ignora.

Las fechas («hoy», la ventana de dos semanas, lo que ya pasó) se calculan con la hora de Chile y no con la del servidor de GitHub, que trabaja en UTC. Pruebas: `python3 -m unittest discover -s pruebas`.
