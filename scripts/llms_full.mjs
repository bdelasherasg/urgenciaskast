/* llms-full.txt: texto completo de Urgencias Kast para agentes de IA.
   Se arma con el HTML ya publicado (después de scripts/prerender.mjs), de modo que cada ficha
   aparece tal como la lee una persona, con sus avisos de revisión. No agrega texto propio. */
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SITIO = 'https://urgenciaskast.cl';
const leer = (r) => fs.readFileSync(path.join(RAIZ, r), 'utf8');
const ENT = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
const texto = (html) => html.replace(/<(script|style|svg|noscript)[\s\S]*?<\/\1>/g, '')
  .replace(/<\/(p|li|h[1-6]|dt|dd|tr|blockquote|figcaption|div|section|article)>/g, '\n').replace(/<br\s*\/?>/g, '\n')
  .replace(/<h([1-6])[^>]*>/g, (m, n) => '\n' + '#'.repeat(Math.min(+n + 1, 6)) + ' ')
  .replace(/<li[^>]*>/g, '- ').replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, (e) => ENT[e] ?? e)
  .split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n');
const principal = (html) => { const m = html.match(/<main[^>]*>([\s\S]*?)<\/main>/); return m ? m[1] : html; };

const paginas = [['Cómo leer Urgencias Kast', 'como-leer.html'], ['Glosario', 'glosario.html']]
  .filter(([, r]) => fs.existsSync(path.join(RAIZ, r)))
  .map(([t, r]) => `## ${t}\n\nURL: ${SITIO}/${r}\n\n${texto(principal(leer(r)))}`);

const crudas = fs.readdirSync(path.join(RAIZ, 'p')).filter((f) => /^\d+-\d+\.html$/.test(f)).sort().map((f) => {
  const m = leer(`p/${f}`).match(/<!--pre-->([\s\S]*?)<!--\/pre-->/);
  return m && !/Cargando la ficha/.test(m[1]) ? [f, texto(m[1]).split('\n')] : null;
}).filter(Boolean);
// Las explicaciones del método se repiten en todas las fichas y ya están en "Método": se omiten.
// El aviso de revisión se conserva siempre.
const veces = new Map();
crudas.forEach(([, ls]) => new Set(ls).forEach((l) => veces.set(l, (veces.get(l) || 0) + 1)));
const comun = (l) => veces.get(l) > Math.max(10, crudas.length * 0.2) && !/^Revisión pendiente|aún no la revisa/.test(l);
const fichas = crudas.map(([f, ls]) => `## Boletín ${f.replace('.html', '')}\n\nURL: ${SITIO}/p/${f}\n\n${ls.filter((l) => !comun(l)).join('\n')}`);

fs.writeFileSync(path.join(RAIZ, 'llms-full.txt'), `# Urgencias Kast: texto completo

> Texto completo de urgenciaskast.cl para lectura por agentes de IA: método, glosario y cada ficha tal como se publica. Índice breve en ${SITIO}/llms.txt. Producción pública de Lo Común, licencia CC BY-SA 4.0. Las fichas con el aviso "Revisión pendiente · piloto de prueba" no han sido revisadas por el equipo; ante una duda vale lo que dice la fuente enlazada.

# Método

${paginas.join('\n\n')}

# Fichas por proyecto

${fichas.join('\n\n')}
`);
console.log(`llms-full.txt: ${fichas.length} fichas.`);
