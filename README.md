# Urgencias Kast

Sitio de seguimiento de las urgencias que el gobierno pone a sus proyectos de ley.
Producción pública de Ruta Crece: Laboratorio de Relato y Producción Narrativa.

## Cómo funciona

- El sitio es HTML, CSS y JavaScript, sin servidor ni base de datos. Se publica gratis con GitHub Pages.
- Cada 3 horas, GitHub ejecuta `scripts/actualizar.py`, que consulta los datos abiertos del Senado y de la Cámara
  y guarda el resultado en `data/urgencias.json`. El sitio lee ese archivo.
- Si una consulta falla, el archivo anterior se mantiene, para que el sitio nunca quede vacío.

## Tareas habituales (sin programar)

Todas se hacen desde la web de GitHub: abrir el archivo, presionar el lápiz (Edit), cambiar y presionar "Commit changes".

| Quiero… | Archivo |
|---|---|
| Poner el enlace de aportes o el correo de contacto | `assets/config.js` |
| Publicar la lectura política de un proyecto | Crear `data/lecturas/NUMERO-BOLETIN.json` copiando `data/lecturas/00000-03.json` |
| Seguir un boletín que el sitio no encontró solo | Agregarlo en `data/boletines_extra.txt` |
| Sumar las urgencias simples | Agregar `'Simple'` en `assets/config.js` y en `NIVELES` de `scripts/actualizar.py` |
| Forzar una actualización ahora | Pestaña Actions → "Actualizar urgencias" → "Run workflow" |

## Primera puesta en marcha

1. Settings → Pages → Source: "Deploy from a branch", rama `main`, carpeta `/ (root)`.
2. Actions → "Actualizar urgencias" → "Run workflow". Al terminar, el aviso de "datos de muestra" desaparece.
3. Dominio propio: Settings → Pages → Custom domain, y en el proveedor del dominio un registro CNAME hacia `USUARIO.github.io`.
4. Antes de publicar, borrar `data/lecturas/00000-03.json` o reemplazarlo por lecturas reales.

## Licencia

Contenido: Creative Commons Atribución-CompartirIgual 4.0 Internacional (CC BY-SA 4.0).
