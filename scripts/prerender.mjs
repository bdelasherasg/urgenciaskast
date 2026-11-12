/* Escribe en el HTML inicial de cada ficha (p/BOLETIN.html) exactamente lo que dibuja assets/app.js en el navegador.
   Así los buscadores y los agentes de IA, que no ejecutan JavaScript, leen la misma ficha que una persona:
   con sus rótulos, las franjas de cada herramienta, los avisos y las fuentes. No hay una segunda versión del contenido.
   Si este paso falla, la página queda con el texto "Cargando la ficha…" y el navegador la dibuja como siempre. */
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const leer = (r) => fs.readFileSync(path.join(RAIZ, r), 'utf8');
const guiones = ['assets/config.js', 'assets/glosario.js', 'assets/app.js'].map(leer);
const RE = /<!--pre-->[\s\S]*?<!--\/pre-->/;

async function dibujar(archivo) {
  const html = leer(archivo);
  if (!RE.test(html)) return false;
  const dom = new JSDOM(html, { url: `https://urgenciaskast.cl/${archivo}`, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.fetch = async (u) => {
    const rel = new URL(u, w.location.href).pathname.replace(/^\//, '');
    const ruta = path.join(RAIZ, decodeURIComponent(rel));
    if (!ruta.startsWith(RAIZ) || !fs.existsSync(ruta)) return { ok: false, status: 404, json: async () => { throw new Error('404'); } };
    const texto = fs.readFileSync(ruta, 'utf8');
    return { ok: true, status: 200, json: async () => JSON.parse(texto), text: async () => texto };
  };
  w.scrollTo = () => {};
  guiones.forEach((g) => w.eval(g));
  if (w.document.readyState !== 'loading') w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 25));
    if (w.document.querySelector('#ficha h1')) break;
  }
  const caja = w.document.querySelector('#ficha');
  const listo = caja && caja.querySelector('h1');
  if (listo) fs.writeFileSync(path.join(RAIZ, archivo), html.replace(RE, () => `<!--pre-->${caja.innerHTML}<!--/pre-->`));
  w.close();
  return !!listo;
}

let hechas = 0, fallas = 0;
for (const f of fs.readdirSync(path.join(RAIZ, 'p')).filter((x) => x.endsWith('.html')).sort()) {
  try { (await dibujar(`p/${f}`)) ? hechas++ : fallas++; } catch (e) { fallas++; console.log('No se pudo dibujar', f, e.message); }
}
console.log(`Fichas dibujadas en el HTML inicial: ${hechas}; sin dibujar: ${fallas}.`);
