/* Urgencias Kast · lógica del sitio (JavaScript sin dependencias).
   Todo texto que viene de los datos se escapa antes de insertarlo. */
(function () {
  'use strict';

  var CFG = window.UK_CONFIG || {};
  var GLO = window.UK_GLOSARIO || {};
  var BASE = document.documentElement.getAttribute('data-base') || '';
  var DIA = 24 * 60 * 60 * 1000;
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var MESES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var DIAS_L = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

  /* ---------- utilidades ---------- */
  function $(s, c) { return (c || document).querySelector(s); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fecha(iso) {
    if (!iso) return null;
    var p = String(iso).slice(0, 10).split('-');
    if (p.length < 3) return null;
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }
  function hoy() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function isoDe(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function dias(iso) { var d = fecha(iso); return d ? Math.round((d - hoy()) / DIA) : null; }
  function fCorta(iso) { var d = fecha(iso); return d ? d.getDate() + ' ' + MESES[d.getMonth()] + ' ' + d.getFullYear() : 'sin fecha'; }
  function fLarga(iso) { var d = fecha(iso); return d ? d.getDate() + ' de ' + MESES_L[d.getMonth()] + ' de ' + d.getFullYear() : ''; }
  function fDia(iso) { var d = fecha(iso); return d ? cap(DIAS_L[d.getDay()]) + ' ' + d.getDate() + ' de ' + MESES_L[d.getMonth()] : ''; }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function t(clave, texto) {
    var g = GLO[clave];
    if (!g) return esc(texto || clave);
    return '<button type="button" class="termino" data-t="' + esc(clave) + '">' + esc(texto || g[0]) + '</button>';
  }
  function cargar(ruta) {
    return fetch(BASE + ruta, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('No se pudo cargar ' + ruta);
      return r.json();
    });
  }
  function cargarOpc(ruta) { return cargar(ruta).catch(function () { return null; }); }
  function urlFicha(b) { return BASE + 'p/' + encodeURIComponent(b) + '.html'; }
  function urlAsesoria(ancla) { return BASE + 'asesoria.html' + (ancla ? '#' + ancla : ''); }
  function claveTipo(tipo) { return tipo === 'Discusión inmediata' ? 'discusion' : (tipo === 'Suma' ? 'suma' : 'simple'); }
  function chipUrg(tipo, claro, conTermino) {
    if (!tipo) return '';
    var c = 'chip ' + (claro ? 'chip-claro ' : '') + (tipo === 'Discusión inmediata' ? 'chip-di' : (tipo === 'Suma' ? 'chip-suma' : 'chip-simple'));
    return '<span class="' + c + '"><span class="punto"></span>' + (conTermino ? t(claveTipo(tipo), tipo) : esc(tipo)) + '</span>';
  }
  function estadoUrg(p) {
    var v = (p && p.urgencia_vigente) || {};
    var n = dias(v.vence);
    if (v.estado === 'vigente' && n !== null && n >= 0) {
      if (n === 0) return { txt: 'Vence hoy', corto: 'Vence hoy', pronto: true };
      if (n === 1) return { txt: 'Vence mañana', corto: 'Vence mañana', pronto: true };
      return { txt: 'Vence en ' + n + ' días · ' + fCorta(v.vence), corto: 'Vence en ' + n + ' días', pronto: n <= 3 };
    }
    if (v.estado === 'vigente' || v.estado === 'vencida') return { txt: 'Plazo vencido el ' + fCorta(v.vence) + ', sin urgencia nueva registrada', corto: 'Plazo vencido', pronto: true };
    if (v.estado === 'en_espera') return { txt: 'Pasó a la otra cámara: el plazo corre cuando allí se dé cuenta de una urgencia', corto: 'En espera en la otra cámara' };
    if (v.estado === 'finalizado') return { txt: 'El Congreso terminó de votarlo', corto: 'Votación terminada' };
    return { txt: 'Sin plazo informado', corto: 'Sin plazo informado' };
  }
  function camaraCorta(c) { return c === 'Cámara de Diputados' ? 'Cámara' : (c || ''); }
  function tramiteDe(etapa) {
    var e = (etapa || '').toLowerCase();
    if (e.indexOf('primer trámite') > -1) return 'Primer trámite';
    if (e.indexOf('segundo trámite') > -1) return 'Segundo trámite';
    if (e.indexOf('tercer trámite') > -1) return 'Tercer trámite';
    if (e.indexOf('mixta') > -1) return 'Comisión mixta';
    if (e.indexOf('insistencia') > -1) return 'Insistencia';
    if (e.indexOf('finaliz') > -1) return 'Trámite de finalización';
    return cap(etapa || '');
  }
  function etapaExplicada(p) {
    var e = (p.etapa || '').toLowerCase();
    if (e.indexOf('primer trámite') > -1) return t('primer') + ': se discute en la cámara donde ingresó.';
    if (e.indexOf('segundo trámite') > -1) return t('segundo') + ': lo revisa la otra cámara.';
    if (e.indexOf('tercer trámite') > -1) return t('tercer') + ': la cámara de origen vota los cambios de la otra.';
    if (e.indexOf('mixta') > -1) return 'En ' + t('mixta', 'comisión mixta') + ': ambas cámaras buscan un acuerdo.';
    if (e.indexOf('insistencia') > -1) return t('insistencia') + ': una cámara mantiene su versión con quórum especial.';
    if (e.indexOf('finaliz') > -1) return t('finalizacion') + ': el Congreso terminó de votarlo.';
    return esc(p.etapa || '');
  }
  function nombreProyecto(b, U, A, IDX) {
    var i = IDX && IDX[b];
    var p = buscar(b, U, A);
    return { sintesis: i ? i.sintesis : '', oficial: p ? p.titulo : '', p: p };
  }
  function buscar(b, U, A) {
    var p = null;
    if (U) (U.proyectos || []).some(function (x) { if (x.boletin === b) { p = x; return true; } return false; });
    if (!p && A && A.proyectos && A.proyectos[b]) p = A.proyectos[b];
    return p;
  }
  // Solo hay página de proyecto si se conocen sus datos oficiales o tiene ficha: un número citado que el Senado no
  // reconoce (por ejemplo, un error de la citación) se muestra sin enlace, para no mandar a una página inexistente.
  function hayPagina(b, U, A, IDX) { return !!((IDX && IDX[b]) || buscar(b, U, A)); }
  function plural(n, uno, varios) { return n + ' ' + (n === 1 ? uno : varios); }
  function recortar(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; }

  /* ---------- explicaciones de términos ---------- */
  function iniciarGlosario() {
    var globo = null, origen = null;
    function cerrar() { if (globo) { globo.remove(); globo = null; } if (origen) origen.setAttribute('aria-expanded', 'false'); origen = null; }
    function abrir(btn) {
      var clave = btn.getAttribute('data-t'), d = GLO[clave];
      if (!d) return;
      cerrar();
      globo = document.createElement('div');
      globo.className = 'globo'; globo.setAttribute('role', 'tooltip');
      globo.innerHTML = '<b></b><span></span><br><a href="' + BASE + 'glosario.html#' + encodeURIComponent(clave) + '">Ver en el glosario</a>';
      globo.querySelector('b').textContent = d[0];
      globo.querySelector('span').textContent = d[1];
      document.body.appendChild(globo);
      var r = btn.getBoundingClientRect(), w = globo.offsetWidth;
      var izq = Math.min(Math.max(16, r.left + window.scrollX), window.scrollX + document.documentElement.clientWidth - w - 16);
      globo.style.left = izq + 'px';
      globo.style.top = (r.bottom + window.scrollY + 8) + 'px';
      origen = btn; btn.setAttribute('aria-expanded', 'true');
    }
    document.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.termino') : null;
      if (b) { e.preventDefault(); e.stopPropagation(); if (origen === b) cerrar(); else abrir(b); return; }
      if (!e.target.closest || !e.target.closest('.globo')) cerrar();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrar(); });
    window.addEventListener('resize', cerrar);
  }

  /* ---------- portada ---------- */
  function portada(U, A, IDX) {
    var ps = U.proyectos || [];
    var vigentes = ps.filter(function (p) { var n = dias(p.urgencia_vigente && p.urgencia_vigente.vence); return p.urgencia_vigente && p.urgencia_vigente.estado === 'vigente' && n !== null && n >= 0; });
    var di = vigentes.filter(function (p) { return p.urgencia_vigente.tipo === 'Discusión inmediata'; });
    var semana = vigentes.filter(function (p) { return dias(p.urgencia_vigente.vence) <= 7; });
    var limite = isoDe(new Date(hoy().getTime() + 6 * DIA));
    var citas = A ? (A.sesiones || []).filter(function (s) { return s.estado !== 'sin efecto' && s.fecha >= isoDe(hoy()) && s.fecha <= limite; }) : [];

    if (U.actualizado) {
      var d = new Date(U.actualizado);
      $('#actualizado').innerHTML = '<span class="vivo" aria-hidden="true"></span>Datos oficiales actualizados el ' + d.getDate() + ' de ' + MESES_L[d.getMonth()] + ' a las ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }
    var cifras = [
      [vigentes.length, 'Proyectos con ' + t('urgencia') + ' vigente', 'Los que el gobierno apura hoy: una cámara debe despacharlos dentro de un plazo.'],
      [di.length, 'Con ' + t('discusion', 'discusión inmediata'), 'El plazo más corto, seis días. Es la máxima prioridad del gobierno.'],
      [semana.length, 'Plazos que vencen en 7 días', 'Proyectos que esta semana deberían votarse o recibir una nueva urgencia.'],
      (A && Object.keys(A.fuentes || {}).some(function (k) { return A.fuentes[k].estado === 'ok'; })) ? [citas.length, 'Sesiones de Sala y comisión en 7 días', 'Citadas por el Senado y la Cámara, con proyectos de ley, audiencias y comisiones investigadoras.']
        : [ps.filter(function (p) { return p.urgencia_vigente && p.urgencia_vigente.estado === 'en_espera'; }).length, 'Proyectos en espera en la otra cámara', 'Pasaron de cámara y esperan que allí se dé cuenta de una urgencia.']
    ];
    $('#cifras').innerHTML = cifras.map(function (c) {
      return '<div class="cifra vidrio"><strong>' + c[0] + '</strong><span class="que">' + c[1] + '</span><span class="por">' + c[2] + '</span></div>';
    }).join('');

    // Reloj del próximo plazo. Si varios proyectos vencen el mismo día, se muestran todos.
    var proximo = vigentes.slice().sort(function (a, b) { return a.urgencia_vigente.vence < b.urgencia_vigente.vence ? -1 : 1; })[0];
    var caja = $('#reloj');
    if (proximo && caja) {
      var mismoDia = vigentes.filter(function (p) { return p.urgencia_vigente.vence === proximo.urgencia_vigente.vence; });
      var item = function (p) {
        return '<div class="chips">' + chipUrg(p.urgencia_vigente.tipo) + ' <span class="chip">Boletín ' + esc(p.boletin) + '</span> <span class="chip">' + esc(camaraCorta(p.camara_actual)) + '</span></div>' +
          sesionPlazo(p, A);
      };
      if (mismoDia.length === 1) {
        var nom = nombreProyecto(proximo.boletin, U, A, IDX);
        $('#reloj-titulo').innerHTML = '<a href="' + urlFicha(proximo.boletin) + '">' + esc(recortar(nom.sintesis || nom.oficial, 170)) + '</a>';
        $('#reloj-meta').outerHTML = '<div id="reloj-meta">' + item(proximo) + '</div>';
      } else {
        var ceja = caja.querySelector('.eyebrow'); if (ceja) ceja.textContent = 'Próximos plazos que vencen';
        $('#reloj-titulo').textContent = mismoDia.length + ' proyectos vencen el mismo día';
        $('#reloj-meta').outerHTML = '<ul class="reloj-lista" id="reloj-meta">' + mismoDia.map(function (p) {
          var n = nombreProyecto(p.boletin, U, A, IDX);
          return '<li><a href="' + urlFicha(p.boletin) + '">' + esc(recortar(n.sintesis || n.oficial, 170)) + '</a>' + item(p) + '</li>';
        }).join('') + '</ul>';
      }
      // Al menos los próximos tres vencimientos; si en el día del tercero vencen más, se suman todos los de ese día.
      var orden = vigentes.slice().sort(function (a, b) { return a.urgencia_vigente.vence < b.urgencia_vigente.vence ? -1 : (a.urgencia_vigente.vence > b.urgencia_vigente.vence ? 1 : 0); });
      var corte = orden[Math.min(2, orden.length - 1)].urgencia_vigente.vence;
      var seleccion = orden.filter(function (p) { return p.urgencia_vigente.vence <= corte; });
      var venceTxt = function (p) {
        var d = dias(p.urgencia_vigente.vence);
        return (d === 0 ? 'Vence hoy' : (d === 1 ? 'Vence mañana' : 'Vence en ' + d + ' días')) + ' · ' + esc(fDia(p.urgencia_vigente.vence));
      };
      var tituloDe = function (p) { var n = nombreProyecto(p.boletin, U, A, IDX); return esc(recortar(n.sintesis || n.oficial, 170)); };
      // Si hay más de uno, todos van en un carrusel que solo avanza con las flechas o al deslizar: de a tres en
      // escritorio y de a uno en celular. El contador sigue al primer proyecto visible.
      var fin;
      var fijarFin = function (p) { fin = fecha(p.urgencia_vigente.vence); fin.setHours(23, 59, 59); };
      fijarFin(proximo);
      var marcar;
      if (seleccion.length > 1) {
        var N = seleccion.length;
        caja.firstElementChild.insertAdjacentHTML('beforeend',
          '<div class="reloj-carrusel" role="region" aria-roledescription="carrusel" aria-label="Próximos plazos que vencen">' +
          '<p class="eyebrow">Próximos ' + N + ' plazos que vencen</p><div class="rc-pista">' + seleccion.map(function (p, i) {
            return '<article class="rc-lamina" aria-roledescription="lámina" aria-label="' + (i + 1) + ' de ' + N + '"><span class="reloj-vence">' + venceTxt(p) + '</span>' +
              '<a class="rc-titulo" href="' + urlFicha(p.boletin) + '">' + tituloDe(p) + '</a>' + item(p) + '</article>';
          }).join('') + '</div>' +
          '<div class="rc-nav"><button type="button" class="rc-flecha" data-d="-1" aria-label="Anteriores">‹</button>' +
          '<span class="rc-puntos" aria-hidden="true"></span><span class="rc-pos" aria-live="polite"></span>' +
          '<button type="button" class="rc-flecha" data-d="1" aria-label="Siguientes">›</button></div></div>');
        caja.classList.add('con-carrusel');
        var pista = caja.querySelector('.rc-pista'), laminas = pista.children, nav = caja.querySelector('.rc-nav');
        var movil = window.matchMedia('(max-width: 760px)'), estado = '';
        var porPagina = function () { return movil.matches ? 1 : 3; };
        var paso = function () { return laminas[1].offsetLeft - laminas[0].offsetLeft || pista.clientWidth; };
        var pagina = 0;
        marcar = function () {
          var ps = porPagina(), paginas = Math.ceil(N / ps);
          var alFinal = pista.scrollLeft >= pista.scrollWidth - pista.clientWidth - 2;
          var primero = alFinal ? Math.max(0, N - ps) : Math.max(0, Math.min(N - 1, Math.round(pista.scrollLeft / paso())));
          pagina = alFinal ? paginas - 1 : Math.floor(primero / ps);
          var clave = ps + ':' + pagina + ':' + primero;
          if (clave === estado) return;
          estado = clave;
          nav.hidden = paginas < 2;
          var puntos = caja.querySelector('.rc-puntos');
          if (puntos.children.length !== paginas) puntos.innerHTML = new Array(paginas + 1).join('<i></i>');
          [].forEach.call(puntos.children, function (el, k) { el.classList.toggle('activo', k === pagina); });
          var ultimo = Math.min(N, primero + ps);
          caja.querySelector('.rc-pos').textContent = (ps === 1 || ultimo === primero + 1 ? (primero + 1) : (primero + 1) + '–' + ultimo) + ' de ' + N;
          caja.querySelector('.rc-flecha[data-d="-1"]').disabled = pagina === 0;
          caja.querySelector('.rc-flecha[data-d="1"]').disabled = pagina === paginas - 1;
          fijarFin(seleccion[primero]); if (typeof tic === 'function') tic();
        };
        var ir = function (pg) {
          var ps = porPagina(), i = Math.max(0, Math.min(N - 1, pg * ps));
          var suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          pista.scrollTo({ left: laminas[i].offsetLeft - laminas[0].offsetLeft, behavior: suave ? 'smooth' : 'auto' });
        };
        [].forEach.call(caja.querySelectorAll('.rc-flecha'), function (bt) { bt.addEventListener('click', function () { ir(pagina + Number(bt.dataset.d)); }); });
        pista.addEventListener('scroll', function () { window.requestAnimationFrame(marcar); }, { passive: true });
        if (movil.addEventListener) movil.addEventListener('change', function () { pista.scrollLeft = 0; estado = ''; marcar(); });
      }
      var tic = function () {
        var ms = Math.max(0, fin - new Date());
        $('#r-d').textContent = Math.floor(ms / DIA);
        $('#r-h').textContent = String(Math.floor(ms % DIA / 3600000)).padStart(2, '0');
        $('#r-m').textContent = String(Math.floor(ms % 3600000 / 60000)).padStart(2, '0');
        $('#r-s').textContent = String(Math.floor(ms % 60000 / 1000)).padStart(2, '0');
      };
      if (marcar) marcar();
      tic(); setInterval(tic, 1000);
    } else if (caja) { caja.hidden = true; }

    tablaActividad(U, A, IDX);
  }

  // Línea de estado del reloj: si el proyecto tiene una sesión citada para discutirlo y si cae dentro del plazo.
  // Rojo: sin sesión citada. Amarillo: citado para después del vencimiento. Verde: citado dentro del plazo.
  function sesionPlazo(p, A) {
    var b = p.boletin, vence = p.urgencia_vigente.vence, desde = isoDe(hoy());
    var ses = (A && A.sesiones || []).filter(function (s) {
      if (s.estado === 'sin efecto' || !s.fecha || s.fecha < desde) return false;
      if ((s.boletines || []).indexOf(b) > -1) return true;
      return (s.puntos || []).some(function (pt) { return (pt.boletines || []).indexOf(b) > -1; });
    }).sort(function (x, y) { return (x.fecha + (x.hora || '')) < (y.fecha + (y.hora || '')) ? -1 : 1; });
    if (!ses.length) return '<p class="reloj-sesion neon-rojo"><span class="punto"></span>Sin fecha de discusión: no hay sesión citada para este proyecto.</p>';
    var s = ses.filter(function (x) { return x.fecha <= vence; })[0] || ses[0];
    var cuando = fDia(s.fecha).toLowerCase() + (/^\d{1,2}:\d{2}$/.test(s.hora || '') ? ' a las ' + s.hora : '');
    var donde = s.organo ? ' · ' + esc(s.organo) + (s.camara ? ', ' + esc(camaraCorta(s.camara)) : '') : '';
    if (s.fecha > vence) return '<p class="reloj-sesion neon-amarillo"><span class="punto"></span>Discusión citada para el ' + esc(cuando) + ', después de que vence el plazo' + donde + '.</p>';
    return '<p class="reloj-sesion neon-verde"><span class="punto"></span>Discusión citada para el ' + esc(cuando) + ', dentro del plazo' + donde + '.</p>';
  }

  /* ---------- tabla de actividad de la portada ----------
     Una fila por cada cosa que se trata en una sesión de Sala o de comisión, de ambas cámaras, ordenada por la fecha
     y la hora reales. Al final, los proyectos con urgencia vigente que no tienen sesión citada. Los vencimientos de
     urgencia no ordenan la tabla. Los filtros quedan en la dirección de la página, para compartir una vista. */
  var VOTACIONES = [], ESPECIALES = {}, LEYES_PRESUPUESTO = {}, VOTOS_PARTIDA = {};
  // Montos de data/presupuesto_vigente.json, que vienen en miles de pesos o de dólares.
  function pesosMiles(m) {
    var p = (m || 0) * 1000, a = Math.abs(p);
    if (a >= 1e12) return '$' + (p / 1e12).toFixed(2).replace('.', ',') + ' billones';
    if (a >= 1e9) return '$' + Math.round(p / 1e9).toLocaleString('es-CL') + ' mil millones';
    return '$' + Math.round(p / 1e6).toLocaleString('es-CL') + ' millones';
  }
  function dolaresMiles(m) { return 'US$ ' + Math.round((m || 0) / 1000).toLocaleString('es-CL') + ' millones'; }
  // Plazo de un proyecto que no tiene urgencia sino un plazo fijado por la Constitución (por ejemplo, el Presupuesto).
  function plazoEspecial(b) { var e = ESPECIALES[b]; return e && e.plazo && dias(e.plazo) !== null && dias(e.plazo) >= 0 ? e : null; }
  function urgHTML(f) {
    var p = f.p || {}, v = p.urgencia_vigente || {};
    if (f.activa) { var e = estadoUrg(p); return chipUrg(v.tipo, true) + '<span class="vence' + (e.pronto ? ' pronto' : '') + '">' + esc(e.corto) + '</span>'; }
    var pe = f.b && plazoEspecial(f.b);
    if (pe) {
      var n = dias(pe.plazo);
      return '<span class="chip chip-claro" title="' + esc(pe.plazo_fuente || '') + '">Plazo constitucional</span><span class="vence' + (n <= 3 ? ' pronto' : '') + '">' +
        (n === 0 ? 'Vence hoy' : (n === 1 ? 'Vence mañana' : 'Vence en ' + n + ' días')) + ' · ' + esc(fCorta(pe.plazo)) + '</span>';
    }
    if (v.tipo && (v.estado === 'vigente' || v.estado === 'vencida' || v.estado === 'en_espera')) return '<span class="sin-urg">' + esc(estadoUrg(p).corto) + '</span>';
    return f.b ? '<span class="sin-urg">Sin urgencia</span>' : '';
  }
  function fichaHTML(f) {
    if (!f.b || !f.conPagina) return '';
    var rev = f.i && f.i.revision === 'pendiente' ? '<span class="en-revision">en revisión</span>' : '';
    var et = f.i && f.i.nivel === 'completa' ? '<span class="et-ficha et-completa">Análisis</span>' : (f.i ? '<span class="et-ficha">Resumen</span>' : '<span class="et-ficha et-datos">Datos</span>');
    return et + rev + '<span class="flecha" aria-hidden="true">→</span>';
  }
  // «Comisión de Hacienda» → «Hacienda»; «Comisión Especial Investigadora (CEI 12) …» → «Investigadora CEI 12».
  function organoCorto(s) {
    if (s.tipo === 'sala') return 'Sala';
    var o = String(s.organo || '');
    var cei = /\(CEI\s*(\d+)\)/.exec(o);
    if (cei) return 'Investigadora CEI ' + cei[1];
    return recortar(o.replace(/^Comisi[oó]n\s+(de\s+la\s+|del\s+|de\s+)?/i, '').split(/\s+-{1,2}\s+|\s+–\s+/)[0].replace(/^./, function (c) { return c.toUpperCase(); }), 70);
  }
  function cuandoTxt(fechaIso, hora) {
    var n = dias(fechaIso), d = fecha(fechaIso);
    var dia = n === 0 ? 'Hoy' : (n === 1 ? 'Mañana' : (n === -1 ? 'Ayer' : cap(DIAS_L[d.getDay()]).slice(0, 3) + ' ' + d.getDate() + ' ' + MESES[d.getMonth()]));
    return { dia: dia, hora: hora || '' };
  }
  function resultadoDe(f) {
    if (!f.b) return '';
    if (f.s.tipo === 'sala' && f.s.camara === 'Cámara de Diputados') {
      var v = VOTACIONES.filter(function (x) { return x.fecha === f.fecha && x.boletin === f.b; })[0];
      if (v && v.ultima) return 'Votado en Sala: ' + String(v.ultima.resultado || '').toLowerCase() + ' ' + v.ultima.si + '-' + v.ultima.no + (v.votaciones > 1 ? ' (' + plural(v.votaciones, 'votación', 'votaciones') + ')' : '');
    }
    var r = RESULTADOS.filter(function (x) { return x.fecha === f.fecha && (x.boletines || []).indexOf(f.b) > -1; })[0];
    return r ? (r.hito || '') : '';
  }

  // Filas de una sesión: en la Sala con tabla, una por punto (con los boletines refundidos juntos); en una comisión,
  // una por proyecto citado; sin proyecto, una con la materia; Sala sin tabla, una que lo dice.
  function filasDeSesion(s, U, A, IDX, pasada) {
    var base = { s: s, fecha: s.fecha, hora: s.hora || '', camara: s.camara, pasada: pasada, sinEfecto: s.estado === 'sin efecto', actividad: s.actividad || '' };
    function fila(b, otros, texto, extra) {
      var p = b ? buscar(b, U, A) : null, i = b && IDX ? IDX[b] : null;
      var v = (p || {}).urgencia_vigente || {};
      var f = Object.assign({}, base, { b: b || '', otros: otros || [], p: p, i: i, extra: extra || '', conPagina: b ? hayPagina(b, U, A, IDX) : false,
        titulo: b ? ((i && i.sintesis) || (p && p.titulo) || texto || ('Boletín ' + b)) : texto });
      f.activa = v.estado === 'vigente' && dias(v.vence) !== null && dias(v.vence) >= 0;
      if (pasada) f.resultado = resultadoDe(f);
      return f;
    }
    if (s.tipo === 'sala' && s.puntos && s.puntos.length) {
      return s.puntos.map(function (pt, k) {
        var bs = pt.boletines || [];
        var f = fila(bs[0], bs.slice(1), recortar(pt.texto || '', 200), pt.boletin_senado ? 'Boletín ' + pt.boletin_senado : '');
        f.orden = k;
        return f;
      });
    }
    var bols = (s.boletines && s.boletines.length) ? s.boletines : (s._votados || []);
    if (bols.length) return bols.map(function (b, k) { var f = fila(b, [], ''); f.orden = k; return f; });
    if (s.tipo === 'sala') return [Object.assign(fila('', [], 'Sesión ' + (s.numero ? s.numero + '.ª' : '') + (s.clase ? ', ' + s.clase.toLowerCase() : '') + (pasada ? ' · Sin tabla registrada' : ' · Tabla por confirmar')), { orden: 0, porConfirmar: !pasada })];
    return [Object.assign(fila('', [], recortar((s.materias || []).join(' '), 200) || 'Sin materia informada'), { orden: 0 })];
  }

  // Sesión de Sala ya realizada de la Cámara sin tabla cargada: lo que trató se conoce por sus votaciones. Cada
  // votación del día va a la sesión cuyo horario contiene la hora de la última votación (o a la primera del día).
  function asignarVotaciones(sesiones) {
    var porDia = {};
    sesiones.forEach(function (s) {
      if (s.tipo === 'sala' && s.camara === 'Cámara de Diputados' && !(s.puntos && s.puntos.length) && !(s.boletines && s.boletines.length)) (porDia[s.fecha] = porDia[s.fecha] || []).push(s);
    });
    VOTACIONES.forEach(function (v) {
      var del = porDia[v.fecha];
      if (!del || !v.ultima) return;
      var h = v.ultima.hora;
      var s = del.filter(function (x) { var m = String(x.horario || '').match(/(\d{2}:\d{2})\s*a\s*(\d{2}:\d{2})/); return m && h >= m[1] && h <= m[2]; })[0] || del[0];
      (s._votados = s._votados || []).push(v.boletin);
    });
  }

  function filasActividad(U, A, IDX) {
    var hoyIso = isoDe(hoy()), futuras = [], pasadas = [];
    if (A) asignarVotaciones(A.pasadas || []);
    if (A) {
      (A.sesiones || []).forEach(function (s) { if (s.fecha >= hoyIso) futuras = futuras.concat(filasDeSesion(s, U, A, IDX, false)); });
      (A.pasadas || []).forEach(function (s) { if (s.fecha < hoyIso) pasadas = pasadas.concat(filasDeSesion(s, U, A, IDX, true)); });
    }
    var citados = {};
    futuras.forEach(function (f) { if (f.b && !f.sinEfecto) citados[f.b] = 1; f.otros.forEach(function (b) { citados[b] = 1; }); });
    var sinSesion = (U.proyectos || []).filter(function (p) {
      var v = p.urgencia_vigente || {};
      return v.estado === 'vigente' && dias(v.vence) !== null && dias(v.vence) >= 0 && !citados[p.boletin];
    }).map(function (p) {
      return { b: p.boletin, otros: [], p: p, i: IDX && IDX[p.boletin], titulo: (IDX && IDX[p.boletin] && IDX[p.boletin].sintesis) || p.titulo, activa: true, sinSesion: true,
        camara: p.camara_actual, conPagina: hayPagina(p.boletin, U, A, IDX), fecha: '', hora: '', extra: '' };
    });
    return { futuras: futuras, pasadas: pasadas, sinSesion: sinSesion };
  }

  function tablaActividad(U, A, IDX) {
    var cuerpo = $('#tabla-cuerpo');
    if (!cuerpo) return;
    var datos = filasActividad(U, A, IDX);
    var F = { q: $('#f-texto'), periodo: $('#f-periodo'), camara: $('#f-camara'), donde: $('#f-donde'), actividad: $('#f-actividad'), urgencia: $('#f-urgencia'), ley: $('#f-ley') };
    var DEF = { q: '', periodo: '7', camara: '', donde: '', actividad: '', urgencia: '', ley: '' };
    var porUrgencia = false;

    // Comisiones presentes en los datos, para el filtro «Dónde».
    var organos = {};
    datos.futuras.concat(datos.pasadas).forEach(function (f) { if (f.s.tipo !== 'sala') organos[organoCorto(f.s)] = 1; });
    Object.keys(organos).sort(function (a, b) { return a.localeCompare(b, 'es'); }).forEach(function (o) {
      var op = document.createElement('option'); op.value = 'c:' + o; op.textContent = o; F.donde.appendChild(op);
    });

    // Filtros desde la dirección de la página.
    var params = new URLSearchParams(location.search);
    Object.keys(DEF).forEach(function (k) {
      var v = params.get(k);
      if (v == null) return;
      if (k === 'ley') F.ley.checked = v === '1';
      else if (F[k].tagName === 'SELECT' && !Array.prototype.some.call(F[k].options, function (o) { return o.value === v; })) return;
      else F[k].value = v;
    });
    function guardarEnDireccion() {
      var p = new URLSearchParams();
      Object.keys(DEF).forEach(function (k) {
        var v = k === 'ley' ? (F.ley.checked ? '1' : '') : F[k].value;
        if (v && v !== DEF[k]) p.set(k, v);
      });
      var qs = p.toString();
      try { history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash); } catch (e) { /* sin historial */ }
    }

    function pasa(f) {
      var q = (F.q.value || '').toLowerCase().trim(), d = F.donde.value, u = F.urgencia.value, v = (f.p || {}).urgencia_vigente || {};
      if (F.camara.value && f.camara !== F.camara.value) return false;
      if (F.ley.checked && !f.b) return false;
      if (u === 'sin' && f.activa) return false;
      if (u && u !== 'sin' && !(f.activa && v.tipo === u)) return false;
      if (f.sinSesion) { if (d || F.actividad.value) return false; }
      else {
        if (d === 'sala' && f.s.tipo !== 'sala') return false;
        if (d === 'comisiones' && f.s.tipo === 'sala') return false;
        if (d.indexOf('c:') === 0 && (f.s.tipo === 'sala' || organoCorto(f.s) !== d.slice(2))) return false;
        if (F.actividad.value && f.actividad !== F.actividad.value) return false;
      }
      if (q) {
        var txt = [f.titulo, f.b, f.otros.join(' '), f.p && f.p.titulo, f.s && f.s.organo, f.s && (f.s.materias || []).join(' '), f.extra].join(' ').toLowerCase();
        if (txt.indexOf(q) === -1) return false;
      }
      return true;
    }
    function clave(f) { return f.fecha + (f.hora || '99:99') + f.camara + ((f.s && f.s.organo) || '') + String(1000 + (f.orden || 0)); }
    function claveUrg(f) { var v = (f.p || {}).urgencia_vigente || {}, pe = !f.activa && f.b && plazoEspecial(f.b); return (f.activa ? v.vence : (pe ? pe.plazo : '9999-12-31')) + clave(f); }

    function filaHTML(f, nuevoDia) {
      var href = f.conPagina ? urlFicha(f.b) : '';
      var cls = [nuevoDia ? 'nuevo-dia' : '', f.sinEfecto ? 'sin-efecto' : '', f.pasada ? 'pasada' : '', f.sinSesion ? 'sin-sesion' : ''].filter(Boolean).join(' ');
      var cuando = f.sinSesion ? '<span class="cuando-dia">Sin sesión citada</span>'
        : (function () { var c = cuandoTxt(f.fecha, f.hora); return '<span class="cuando-dia">' + esc(c.dia) + '</span>' + (c.hora ? '<span class="cuando-hora">' + esc(c.hora) + '</span>' : ''); })();
      var donde = f.sinSesion ? '<span class="sub">' + esc(camaraCorta(f.camara) || '') + '</span>'
        : '<span class="donde-org" title="' + esc(f.s.organo) + '">' + esc(organoCorto(f.s)) + '</span><span class="sub">' + esc(camaraCorta(f.camara)) + '</span>';
      // El título oficial queda al pasar el cursor (y en la ficha): en la fila, solo la síntesis y el boletín.
      var oficial = f.i && f.i.sintesis && f.p && f.p.titulo ? ' title="Título oficial: ' + esc(recortar(f.p.titulo, 300)) + '"' : '';
      var titulo = f.b && href ? '<a href="' + href + '"' + oficial + '>' + esc(recortar(f.titulo, 200)) + '</a>' : '<span class="' + (f.b ? 'que-sin-pagina' : 'que-materia') + '">' + esc(recortar(f.titulo, 220)) + '</span>';
      var bol = f.b ? '<span class="bol-num">Boletín ' + esc(f.b) + (f.otros.length ? ', refundido con ' + esc(f.otros.join(', ')) : '') + (href ? '' : ' · sin datos oficiales para este número') + '</span>'
        : (f.extra ? '<span class="bol-num">' + esc(f.extra) + '</span>' : '');
      var act = f.sinEfecto ? '<span class="et-act et-sin-efecto">Sin efecto</span>'
        : f.sinSesion ? '' : (f.pasada ? (f.resultado ? '<span class="resultado">' + esc(f.resultado) + '</span>' : '<span class="sin-urg">Sin resultado informado</span>')
          : (f.porConfirmar ? '<span class="et-act">Sala</span>' : '<span class="et-act">' + esc(f.actividad) + '</span>'));
      return '<tr' + (cls ? ' class="' + cls + '"' : '') + (href ? ' data-href="' + href + '"' : '') + '>' +
        '<td class="c-cuando" data-l="Cuándo">' + cuando + '</td>' +
        '<td class="c-donde" data-l="Dónde">' + donde + '</td>' +
        '<td class="c-que" data-l="Qué se trata">' + titulo + bol + '</td>' +
        '<td class="c-act" data-l="' + (f.pasada ? 'Resultado' : 'Actividad') + '">' + act + '</td>' +
        '<td class="c-urg" data-l="Urgencia">' + urgHTML(f) + '</td>' +
        '<td class="c-ficha" data-l="Ficha">' + fichaHTML(f) + '</td></tr>';
    }

    function pintar() {
      var per = F.periodo.value, hoyIso = isoDe(hoy());
      var hasta = per === 'hoy' ? hoyIso : isoDe(new Date(hoy().getTime() + ((per === '14' ? 14 : 7) - 1) * DIA));
      var lista;
      if (per === 'pasados') lista = datos.pasadas.filter(pasa).sort(function (a, b) { return a.fecha === b.fecha ? clave(a).localeCompare(clave(b)) : (a.fecha < b.fecha ? 1 : -1); });
      else lista = datos.futuras.filter(function (f) { return f.fecha <= hasta && pasa(f); }).sort(function (a, b) { return porUrgencia ? claveUrg(a).localeCompare(claveUrg(b)) : clave(a).localeCompare(clave(b)); });
      var resto = per === 'pasados' ? [] : datos.sinSesion.filter(pasa).sort(function (a, b) { return a.p.urgencia_vigente.vence < b.p.urgencia_vigente.vence ? -1 : 1; });

      var sesiones = {}, proyectos = {};
      lista.forEach(function (f) { sesiones[f.fecha + f.hora + f.camara + f.s.organo] = 1; if (f.b) proyectos[f.b] = 1; });
      $('#n-urgencias').textContent = plural(lista.length, 'actividad', 'actividades') + ' en ' + plural(Object.keys(sesiones).length, 'sesión', 'sesiones') +
        ' · ' + plural(Object.keys(proyectos).length, 'proyecto distinto', 'proyectos distintos') + (resto.length ? ' · ' + resto.length + ' con urgencia y sin sesión citada' : '');

      var html = '', dia = null;
      lista.forEach(function (f, k) { html += filaHTML(f, !porUrgencia && k > 0 && f.fecha !== dia); dia = f.fecha; });
      if (resto.length) {
        html += '<tr class="separador"><td colspan="6"><b>Con urgencia, sin sesión citada</b> Proyectos que el gobierno apura y que aún no aparecen en una citación ni en una tabla de Sala, ordenados por el vencimiento de su plazo.</td></tr>';
        resto.forEach(function (f) { html += filaHTML(f, false); });
      }
      cuerpo.innerHTML = html || '<tr><td colspan="6" class="vacio">' + (per === 'pasados' ? 'No hay sesiones registradas en los últimos 7 días con esos filtros.' : 'No hay actividad con esos filtros.') + '</td></tr>';
      guardarEnDireccion();
    }

    cuerpo.addEventListener('click', function (e) {
      if (e.target.closest('a')) return;
      var tr = e.target.closest('tr[data-href]');
      if (tr) location.href = tr.getAttribute('data-href');
    });
    var thUrg = document.querySelector('.tabla-proyectos th[data-orden="urg"]');
    if (thUrg) thUrg.querySelector('button').addEventListener('click', function () {
      porUrgencia = !porUrgencia;
      var thCuando = document.querySelector('.tabla-proyectos th[data-orden="cuando"]');
      thUrg.setAttribute('aria-sort', porUrgencia ? 'ascending' : 'none');
      if (thCuando) thCuando.setAttribute('aria-sort', porUrgencia ? 'none' : 'ascending');
      pintar();
    });
    var thC = document.querySelector('.tabla-proyectos th[data-orden="cuando"]');
    if (thC) thC.querySelector('button').addEventListener('click', function () {
      porUrgencia = false; thC.setAttribute('aria-sort', 'ascending'); if (thUrg) thUrg.setAttribute('aria-sort', 'none'); pintar();
    });
    [F.periodo, F.camara, F.donde, F.actividad, F.urgencia, F.ley].forEach(function (x) { x.addEventListener('change', pintar); });
    F.q.addEventListener('input', pintar);
    pintar();
  }

  /* ---------- agenda ---------- */
  // Agrupa por día y por cámara los plazos de urgencia que vencen sin citación publicada.
  function agregarProbables(porDia, probables, U, A, filtro) {
    var grupos = {};
    probables.forEach(function (pr) {
      if (filtro && !filtro(pr)) return;
      var p = buscar(pr.boletin, U, A);
      var cam = p ? p.camara_actual : (pr.camara || '');
      var k = pr.vence + '|' + cam;
      if (!grupos[k]) {
        grupos[k] = { _probable: true, fecha: pr.vence, hora: 'Plazo', camara: cam, organo: 'Vencen urgencias sin citación publicada', boletines: [], estado: 'citada' };
        (porDia[pr.vence] = porDia[pr.vence] || []).push(grupos[k]);
      }
      grupos[k].boletines.push(pr.boletin);
    });
    Object.keys(grupos).forEach(function (k) { if (grupos[k].boletines.length === 1) grupos[k].organo = 'Vence la urgencia, aún sin citación publicada'; });
  }
  function sesionHTML(s, U, A, IDX, probable) {
    var materias = '';
    if (s.boletines && s.boletines.length) {
      materias = '<ul>' + s.boletines.map(function (b) {
        var nom = nombreProyecto(b, U, A, IDX);
        var p = nom.p;
        var urg = p && p.urgencia_vigente && p.urgencia_vigente.estado === 'vigente' ? ' ' + chipUrg(p.urgencia_vigente.tipo, !probable) : '';
        var titulo = nom.sintesis || nom.oficial || 'Proyecto de ley';
        if (!hayPagina(b, U, A, IDX)) return '<li><span class="bol">' + esc(b) + '</span>' + esc(titulo) + ' <small>(sin datos oficiales para este número de boletín)</small></li>';
        return '<li><a href="' + urlFicha(b) + '"><span class="bol">' + esc(b) + '</span>' + esc(recortar(titulo, 190)) + '</a>' + urg + '</li>';
      }).join('') + (s._mas ? '<li class="mas"><a href="' + BASE + 'agenda.html#d' + s._dia + '">' + plural(s._mas, 'proyecto más', 'proyectos más') + ' con plazo ese día</a></li>' : '') + '</ul>';
    } else if (s.materias && s.materias.length) {
      materias = '<ul><li class="materia-libre">' + esc(recortar(s.materias.join(' '), 240)) + '</li></ul>';
    } else if (s.tipo === 'sala') {
      materias = '<ul><li class="materia-libre">' + (s.numero ? 'Sesión ' + esc(s.numero) + '.ª' + (s.clase ? ', ' + esc(s.clase.toLowerCase()) : '') + '. ' : '') + 'Tabla por confirmar.</li></ul>';
    }
    var meta = '<div class="meta">' + (s.camara ? '<span class="chip' + (probable ? '' : ' chip-claro') + '">' + esc(camaraCorta(s.camara)) + '</span>' : '') +
      (s.estado === 'sin efecto' ? '<span class="chip chip-claro">Sin efecto</span>' : '') +
      (s.asistida ? '<span class="chip chip-claro" title="La Cámara no entrega sus citaciones al sistema automático. El equipo de Lo Común las copió desde camara.cl. Confirme la fecha en camara.cl.">Cargada por el equipo</span>' : '') +
      (probable ? '<span class="chip">' + t('probable', 'Probable') + '</span>' : '') + '</div>';
    return '<article class="sesion' + (s.estado === 'sin efecto' ? ' sin-efecto' : '') + (probable ? ' probable' : '') + '">' +
      '<span class="hora">' + esc(s.hora || (probable ? 'Plazo' : '')) + '</span>' +
      '<div><div class="organo">' + esc(s.organo) + '</div>' + meta + materias + '</div></article>';
  }
  function diaHTML(f, sesiones, U, A, IDX, mas) {
    var n = dias(f);
    var etiqueta = n === 0 ? '<span class="hoy">Hoy</span>' : (n === 1 ? '<span class="hoy">Mañana</span>' : '<span>' + esc(DIAS_L[fecha(f).getDay()]) + '</span>');
    var d = fecha(f);
    return '<section class="dia"><div class="dia-fecha">' + etiqueta + '<strong>' + d.getDate() + ' ' + MESES[d.getMonth()] + '</strong></div>' +
      '<div class="sesiones">' + sesiones.map(function (s) { return sesionHTML(s, U, A, IDX, s._probable); }).join('') +
      (mas ? '<a class="nota" href="' + BASE + 'agenda.html#d' + f + '">Y ' + mas + ' sesiones más ese día</a>' : '') + '</div></section>';
  }

  function agenda(U, A, IDX) {
    var cont = $('#agenda');
    if (!A) { cont.innerHTML = '<p class="vacio">La agenda aún no está disponible. Vuelva en unos minutos.</p>'; return; }
    var fC = $('#a-camara'), fU = $('#a-urgencia'), fT = $('#a-texto');
    var est = [];
    Object.keys(A.fuentes || {}).forEach(function (k) {
      var f = A.fuentes[k];
      var nombre = k === 'senado' ? 'Senado' : 'Cámara';
      est.push('<span class="chip">' + nombre + ': ' + (f.estado === 'ok' ? plural(f.citaciones, 'citación', 'citaciones') + ', consultadas el ' + esc(fCorta(f.consultado)) : f.estado === 'asistida' ? plural(f.citaciones, 'citación cargada', 'citaciones cargadas') + ' por el equipo desde camara.cl el ' + esc(fCorta(f.consultado)) + ' (el sitio de la Cámara no entrega los datos al sistema; confirme en camara.cl)' : (f.conservadas ? 'sin actualizar; se muestran las últimas citaciones obtenidas' : 'citaciones no disponibles por ahora; se muestran los plazos de urgencia')) + '</span>');
    });
    $('#estado-fuentes').innerHTML = est.join('');
    $('#rango').textContent = 'Del ' + fLarga(A.desde) + ' al ' + fLarga(A.hasta);
    function pintar() {
      var q = (fT.value || '').toLowerCase().trim();
      var porDia = {};
      (A.sesiones || []).forEach(function (s) {
        if (fC.value && s.camara !== fC.value) return;
        if (fU.checked && !(s.boletines || []).some(function (b) { var p = buscar(b, U, A); return p && p.urgencia_vigente && p.urgencia_vigente.estado === 'vigente'; })) return;
        if (q) {
          var txt = (s.organo + ' ' + (s.materias || []).join(' ') + ' ' + (s.boletines || []).map(function (b) { var n = nombreProyecto(b, U, A, IDX); return b + ' ' + n.sintesis + ' ' + n.oficial; }).join(' ')).toLowerCase();
          if (txt.indexOf(q) === -1) return;
        }
        (porDia[s.fecha] = porDia[s.fecha] || []).push(s);
      });
      agregarProbables(porDia, A.probables || [], U, A, function (pr) {
        var p = buscar(pr.boletin, U, A);
        if (fC.value && p && p.camara_actual !== fC.value) return false;
        if (q) { var n = nombreProyecto(pr.boletin, U, A, IDX); if ((pr.boletin + ' ' + n.sintesis + ' ' + n.oficial).toLowerCase().indexOf(q) === -1) return false; }
        return true;
      });
      var fechas = Object.keys(porDia).sort();
      cont.innerHTML = fechas.length ? '<div class="agenda-dias">' + fechas.map(function (f) {
        var lista = porDia[f].sort(function (a, b) { return (a._probable ? 1 : 0) - (b._probable ? 1 : 0) || String(a.hora || '99').localeCompare(String(b.hora || '99')); });
        return '<div id="d' + f + '">' + diaHTML(f, lista, U, A, IDX, 0) + '</div>';
      }).join('') + '</div>' : '<p class="vacio">No hay sesiones con esos filtros.</p>';
      if (location.hash && location.hash.length > 2) { var el = document.getElementById(location.hash.slice(1)); if (el) el.scrollIntoView(); }
    }
    [fC, fU].forEach(function (s) { s.addEventListener('change', pintar); });
    fT.addEventListener('input', pintar);
    pintar();
  }

  /* ---------- ficha ---------- */
  var EXPLICA = [
    [/ingreso de proyecto/i, 'El proyecto entra al Congreso.'],
    [/cuenta del mensaje.*urgencia|retira.*urgencia|hace presente la urgencia/i, null],
    [/cuenta de proyecto.*pasa a comisi/i, 'La Sala toma conocimiento del proyecto y lo envía a comisión.'],
    [/cuenta de primer informe|cuenta de segundo informe|cuenta de informe/i, 'La Sala recibe el informe de la comisión.'],
    [/primer informe de comisi[oó]n de hacienda|informe de comisi[oó]n de hacienda/i, 'La Comisión de Hacienda revisa las normas que afectan el gasto o los ingresos públicos.'],
    [/primer informe de comisi/i, 'La comisión entrega su primer informe: votó la idea de legislar y propone un texto.'],
    [/segundo informe/i, 'La comisión revisó las indicaciones y entrega su segundo informe.'],
    [/aprobado en general y particular/i, 'La Sala aprueba la idea de legislar y el texto completo en una sola votación.'],
    [/discusi[oó]n general.*aprobado/i, 'La Sala aprueba la idea de legislar.'],
    [/discusi[oó]n general/i, 'La Sala discute la idea de legislar.'],
    [/discusi[oó]n particular/i, 'La Sala vota el texto artículo por artículo.'],
    [/plazo de indicaciones|plazo para presentar indicaciones/i, 'Se abre un plazo para proponer cambios al texto.'],
    [/oficio de ley a c[aá]mara revisora/i, 'La cámara de origen terminó y envía el proyecto a la otra cámara.'],
    [/comisi[oó]n mixta/i, 'Una comisión con integrantes de ambas cámaras busca un acuerdo.'],
    [/c[aá]mara de origen/i, 'El proyecto vuelve a la cámara donde ingresó.']
  ];
  function explicarTramite(d) {
    for (var i = 0; i < EXPLICA.length; i++) if (EXPLICA[i][0].test(d)) return EXPLICA[i][1];
    return '';
  }

  function ficha(U, A, IDX) {
    var b = document.body.getAttribute('data-boletin') || new URLSearchParams(location.search).get('b') || '';
    var main = $('#ficha');
    // Solo pide la ficha verificada si el índice dice que existe, para no generar errores 404.
    (IDX && IDX[b] ? cargarOpc('data/fichas/' + encodeURIComponent(b) + '.json') : Promise.resolve(null)).then(function (F) {
      var p = buscar(b, U, A);
      if (!p && !F) {
        main.innerHTML = '<div class="envoltura pagina-cabeza"><p class="eyebrow">Boletín ' + esc(b) + '</p><h1>Este proyecto no está en seguimiento</h1>' +
          '<p class="bajada">No tiene urgencia vigente ni figura en la agenda de las próximas dos semanas. Puede revisar su tramitación en el ' +
          '<a href="https://portallegislativo.senado.cl/proyectos-ley?boletin=' + encodeURIComponent(b) + '" rel="noopener">sitio del Senado</a>.</p>' +
          '<p><a class="boton" href="' + BASE + 'index.html">Ver los proyectos con urgencia</a></p></div>';
        return;
      }
      pintarFicha(b, p, F, U, A, IDX, main);
    });
  }

  function pintarFicha(b, p, F, U, A, IDX, main) {
    var completa = F && F.nivel === 'completa';
    var fuentes = [], porId = {};
    function agregarFuente(f) { fuentes.push(f); porId[f.id] = fuentes.length; return fuentes.length; }
    (F && F.fuentes || []).forEach(agregarFuente);
    var urls = fuentes.map(function (f) { return f.url; });
    var nSenado = null;
    if (p && p.enlaces) {
      if (p.enlaces.senado && urls.indexOf(p.enlaces.senado) === -1) nSenado = agregarFuente({ id: '_senado', titulo: 'Senado, ficha de tramitación del boletín ' + b, url: p.enlaces.senado, fecha: 'Consulta automática', nota: 'Etapas, trámites y urgencias.' });
      else if (p.enlaces.senado) nSenado = urls.indexOf(p.enlaces.senado) + 1;
      if (p.enlaces.camara) agregarFuente({ id: '_camara', titulo: 'Cámara de Diputadas y Diputados, tramitación del boletín ' + b, url: p.enlaces.camara, fecha: 'Consulta automática', nota: '' });
      if (p.enlaces.mensaje) agregarFuente({ id: '_texto', titulo: 'Texto del ' + ((p.iniciativa || '').toLowerCase().indexOf('moci') === 0 ? 'proyecto (moción)' : 'mensaje presidencial'), url: p.enlaces.mensaje, fecha: '', nota: 'Documento original del proyecto.' });
    }
    function refs(ids) {
      return (ids || []).map(function (id) {
        var n = porId[id]; if (!n) return '';
        return '<a class="ref" href="#f' + n + '" title="' + esc(fuentes[n - 1].titulo) + '">' + n + '</a>';
      }).join('');
    }
    function oraciones(lista) {
      return (lista || []).map(function (o) {
        if (o.pendiente) return '<p class="pendiente"><span class="et et-pend">Dato pendiente</span> ' + esc(o.texto) + '</p>';
        return esc(o.texto) + refs(o.fuentes);
      }).join(' ');
    }
    function franja(herr, nombre, por, limite, para) {
      return '<div class="franja"><details><summary><span class="herr"><span>' + herr + '</span><span>' + nombre + '</span></span><span class="abrir"><span class="abrir-txt"></span></span></summary>' +
        '<div class="franja-grilla"><div><b>Por qué la usamos</b><p>' + por + '</p></div><div><b>Qué no puede decir</b><p>' + limite + '</p></div><div><b>Para qué sirve</b><p>' + para + '</p></div></div></details></div>';
    }
    function masCta(texto) {
      return '<div class="mas-cta"><p>' + texto + '</p><a href="' + urlAsesoria('solicitar') + '">Solicitar asesoría</a></div>';
    }
    // En las fichas con análisis ampliado, el resumen avisa qué trae de más y enlaza a cada bloque.
    function avisoAmpliado() {
      if (!completa) return '';
      var nPos = (F.posiciones || []).length, nMarcos = ((F.encuadre || {}).marcos || []).length, items = [];
      if (F.posiciones) items.push(nPos
        ? '<li><a href="#posiciones"><b>Qué han dicho las organizaciones:</b></a> ' + nPos + (nPos === 1 ? ' posición pública' : ' posiciones públicas') + ' de gremios, empresas u organizaciones sociales, cada una con su fecha y su fuente.</li>'
        : '<li><a href="#posiciones"><b>Qué han dicho las organizaciones:</b></a> en la prensa revisada no encontramos declaraciones públicas de organizaciones sobre este proyecto, y lo registramos así.</li>');
      items.push(nMarcos
        ? '<li><a href="#encuadre"><b>Cómo se habla del proyecto:</b></a> qué problema, qué causa y qué solución destaca cada lado del debate, y qué palabras usa.</li>'
        : '<li><b>Cómo se habla del proyecto:</b> la prensa revisada aún no trae notas suficientes para comparar cómo lo presenta cada lado.</li>');
      return '<div class="aviso-ampliado"><p class="eyebrow">Análisis ampliado</p><p>Esta ficha incluye el análisis ampliado. Además del resumen del proyecto, que sigue abajo, trae:</p><ul>' + items.join('') + '</ul>' +
        '<p class="aviso-ampliado-nota">Se elabora con las notas de una lista fija de medios nacionales, y cada afirmación enlaza a su fuente.</p></div>';
    }
    // Oferta del análisis ampliado gratuito: se intercala con los avisos de asesoría en las fichas básicas.
    // Si ya se pidió y la prensa no menciona el proyecto, la ficha lo dice en breve y permite pedirlo de nuevo.
    var sinPrensa = !!(F && F.resumen && !completa && F.ampliado && F.ampliado.estado === 'sin_prensa');
    var ofrecerAmpliado = !!(F && F.resumen && !completa && CFG.pedidosUrl);
    function ofertaAmpliado(grande) {
      if (sinPrensa) {
        if (!grande) return '';
        return '<aside class="tarjeta oferta-ampliado sin-prensa" aria-labelledby="h-sin-prensa"><div class="tarjeta-cuerpo">' +
          '<p class="eyebrow">Análisis ampliado</p><h2 id="h-sin-prensa">Se solicitó un análisis ampliado y no había suficientes menciones en prensa</h2>' +
          '<p>Si considera que el proyecto se ha vuelto contingente en los últimos días u horas, solicite el análisis ampliado nuevamente.</p>' +
          (ofrecerAmpliado ? '<div class="acciones"><button type="button" class="boton" data-ampliado>Solicitar análisis ampliado nuevamente</button></div>' : '') +
          '</div></aside>';
      }
      if (!ofrecerAmpliado) return '';
      var boton = '<button type="button" class="' + (grande ? 'boton' : 'enlace-ampliado') + '" data-ampliado>Solicitar análisis ampliado gratuito</button>';
      if (!grande) return '<div class="mas-cta cta-ampliado"><p>¿Este proyecto trata un tema contingente? Pida gratis el análisis ampliado: qué dicen las organizaciones y cómo se habla del proyecto en la prensa.</p>' + boton + '</div>';
      return '<aside class="tarjeta oferta-ampliado" aria-labelledby="h-oferta"><div class="tarjeta-cuerpo">' +
        '<p class="eyebrow">Gratuito</p><h2 id="h-oferta">Si considera que este proyecto trata un tema contingente, solicite un análisis ampliado gratuito</h2>' +
        '<p>Esta ficha es básica: explica qué dice el proyecto. El análisis ampliado agrega <b>qué han dicho las organizaciones</b> sobre él y <b>cómo se habla del proyecto</b> en la prensa. Se publica en esta misma ficha.</p>' +
        '<div class="acciones">' + boton + '</div></div></aside>';
    }

    var mocion = p && (p.iniciativa || '').toLowerCase().indexOf('moci') === 0;
    // Proyectos especiales (data/proyectos_especiales.json): el Presupuesto no lleva urgencias sino un plazo
    // constitucional, y su detalle por partida se enlaza a PresupuestoKast.cl.
    var esp = ESPECIALES[b] || null, esPres = !!(esp && esp.tipo === 'presupuesto'), pe = plazoEspecial(b);
    var e = p ? estadoUrg(p) : null;
    var v = p ? p.urgencia_vigente || {} : {};
    var citas = A ? (A.sesiones || []).filter(function (s) { return s.estado !== 'sin efecto' && (s.boletines || []).indexOf(b) > -1; }) : [];
    var titulo = (F && F.sintesis) || (p && p.titulo) || ('Boletín ' + b);
    document.title = recortar(titulo, 90) + ' · Urgencias Kast';

    var bloques = [], n = 0, indice = [];
    function bloque(id, nombre, html) { n++; indice.push('<li><a href="#' + id + '">' + n + '. ' + esc(nombre) + '</a></li>'); bloques.push(html.replace('{{N}}', n)); }

    // 1. Resumen
    if (F && F.resumen) {
      var R = F.resumen;
      var ap = esPres ? [
        ['problema', 'Qué es y qué plazo tiene'], ['propone', 'Cuánto propone gastar'], ['cambia', 'Qué cambia respecto de la ley vigente'],
        ['afecta', 'Qué partidas se rechazaron o modificaron'], ['costo', 'Gasto total y endeudamiento'], ['estado', 'En qué va']
      ] : [
        ['problema', mocion ? 'Problema que declara la moción' : 'Problema que declara el ' + t('mensaje', 'mensaje')],
        ['propone', 'Qué propone'], ['cambia', 'Qué cambia en la ley vigente'], ['afecta', 'A quién afecta, según el texto'],
        ['costo', 'Costo fiscal, según el ' + t('informe_financiero', 'informe financiero')], ['estado', 'Estado de tramitación']
      ];
      bloque('resumen', 'Qué propone el proyecto', '<article class="tarjeta" id="resumen" aria-labelledby="h-resumen">' +
        franja('Herramienta', t('resumen_estructurado'),
          'Es el formato de los artículos científicos: los mismos apartados, en el mismo orden, para todos los proyectos. Así se pueden comparar y nada importante queda fuera. Se basa en Haynes y colaboradores (1990) y en las guías de resumen en lenguaje sencillo de Cochrane.',
          'No evalúa ni opina. Cada oración repite lo que dice un documento y enlaza a él. Si un documento no estaba disponible, lo decimos en lugar de suponer su contenido.',
          'Para explicar el proyecto en un minuto a un parlamentario, un directorio, una asamblea o una redacción, y para saber qué documento abrir si se necesita el detalle.') +
        '<div class="tarjeta-cuerpo"><p class="num-bloque">Bloque {{N}} · <span class="et et-hecho">' + t('hecho', 'Hecho') + '</span></p><h2 id="h-resumen">Qué propone el proyecto</h2>' + avisoAmpliado() +
        ap.filter(function (a) { return R[a[0]] && R[a[0]].length; }).map(function (a) {
          return '<div class="apartado"><h3>' + a[1] + '</h3><div><p>' + oraciones(R[a[0]]) + '</p></div></div>';
        }).join('') +
        masCta('¿Qué se juega en este proyecto para su bancada o su partido, y qué posición conviene tomar? La lectura política de Lo Común lo responde con las posturas en juego, el costo de cada alternativa y su fundamento por escrito.') +
        '</div></article>');
    } else {
      bloque('resumen', 'Resumen del proyecto', '<article class="tarjeta" id="resumen" aria-labelledby="h-resumen"><div class="tarjeta-cuerpo preparacion">' +
        '<p class="num-bloque">Bloque {{N}}</p><h2 id="h-resumen">Resumen en preparación</h2>' +
        '<p>Este proyecto todavía no tiene un ' + t('resumen_estructurado') + '. Lo publicamos cuando el borrador automático pasa la comprobación de fuentes y de legibilidad.</p>' +
        (p && p.enlaces && p.enlaces.mensaje ? '<p>Mientras tanto, puede leer el <a href="' + esc(p.enlaces.mensaje) + '" rel="noopener">texto original del proyecto</a> o los informes de la ' + t('atp') + ' de la Biblioteca del Congreso.</p>' : '') +
        '<p class="aviso">¿Necesita este análisis antes? <a href="' + urlAsesoria('solicitar') + '">Lo Común puede prepararlo para su equipo</a>.</p>' +
        '</div></article>');
    }

    if (esp && esp.detalle && (esp.partidas || []).length) {
      var dt = esp.detalle, url = function (u) { return /^https:\/\//.test(u || '') ? u : ''; };
      // Ley de Presupuestos del año anterior por partida (datos abiertos de la Dipres, scripts/presupuesto.py).
      var annoP = +((String(esp.nombre || '').match(/\b(20\d{2})\b/) || [])[1] || 0), ley = annoP ? LEYES_PRESUPUESTO[annoP - 1] : null;
      var enlaceP = function (x) { return '<a href="' + esc(url(String(dt.partida || '').replace('{nn}', x[0]))) + '" rel="noopener"><span class="bol">' + esc(x[0]) + '</span>' + esc(x[1]) + '</a>'; };
      // En la tabla, miles de millones de pesos (cabe en un teléfono); los dólares, debajo y en millones.
      var montoP = function (m, k) {
        if (!m) return '—';
        var mm = m.pesos ? Math.round(m.pesos[k] / 1e6).toLocaleString('es-CL') : '';
        return mm + (m.dolares && m.dolares[k] ? '<span class="usd">' + (mm ? '+ ' : '') + dolaresMiles(m.dolares[k]) + '</span>' : '');
      };
      // Votaciones de la Sala de la Cámara contadas por partida (datos abiertos, scripts/sala.py).
      var vp = VOTOS_PARTIDA[b], tablaVotos = vp && vp.partidas ? '<h3>Votaciones de la Sala de la Cámara, por partida</h3>' +
        '<p>La Sala de la Cámara ha votado ' + esc(vp.total) + ' veces este proyecto. Cada votación recae sobre una indicación, una votación separada o un reclamo de admisibilidad dentro de una partida.</p>' +
        '<div class="tabla-caja"><table class="tabla-partidas"><thead><tr><th>Partida</th><th>Votaciones</th></tr></thead><tbody>' +
        esp.partidas.filter(function (x) { return vp.partidas[x[0]]; }).map(function (x) {
          var g = vp.partidas[x[0]];
          return '<tr><td>' + enlaceP(x) + '</td><td>' + esc(g.votaciones) + '<span class="usd">' + esc(g.aprobadas) + ' aprobadas · ' + esc(g.rechazadas) + ' rechazadas</span></td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<p class="nota" style="color:var(--tinta-suave)">Una votación rechazada no significa que la partida se rechazó: puede ser una indicación que no prosperó. ' +
        (vp.sin_partida ? esc(vp.sin_partida) + ' votaciones no corresponden a una partida (por ejemplo, la votación en general). ' : '') +
        'Fuente: <a href="' + esc(url(vp.fuente)) + '" rel="noopener">Cámara de Diputadas y Diputados, datos abiertos</a>.</p>' : '';
      var tablaLey = ley && ley.partidas ? '<h3>La Ley de Presupuestos ' + esc(ley.anno) + ', partida por partida</h3>' +
        '<p>Para comparar con el proyecto: lo que aprobó el Congreso para ' + esc(ley.anno) + ' (ley inicial) y lo que rige a ' + esc(ley.mes_corte) +
        ' de ' + esc(ley.anno) + ' (ley vigente), que suma los cambios del año, como decretos, leyes especiales y recortes.</p>' +
        '<p class="nota" style="color:var(--tinta-suave)">En miles de millones de pesos de ' + esc(ley.anno) + ' (1.000 equivale a 1 billón). Algunas partidas tienen además gasto en dólares.</p>' +
        '<div class="tabla-caja"><table class="tabla-partidas"><thead><tr><th>Partida</th><th>Aprobada</th><th>Vigente a ' + esc(ley.mes_corte) + '</th></tr></thead><tbody>' +
        esp.partidas.map(function (x) {
          var m = ley.partidas[x[0]];
          return '<tr><td>' + enlaceP(x) + '</td><td>' + montoP(m, 'inicial') + '</td><td>' + montoP(m, 'vigente') + '</td></tr>';
        }).join('') +
        (ley.total ? '<tr><td><b>Total del Gobierno Central</b></td><td><b>' + montoP(ley.total, 'inicial') + '</b></td><td><b>' + montoP(ley.total, 'vigente') + '</b></td></tr>' : '') +
        '</tbody></table></div>' +
        '<p class="nota" style="color:var(--tinta-suave)">Montos en pesos y dólares de ' + esc(ley.anno) + ', sin ajustar por inflación: no se restan directamente de las cifras del proyecto. ' +
        'Cada monto suma los gastos de la partida tal como los publica la Dipres, sin consolidar: la partida Tesoro Público incluye los aportes que financian a las demás, y las transferencias entre servicios se cuentan en ambos. Por eso las partidas no suman el total, y las cifras de ' + esc(dt.sitio) + ', que sí consolidan, son menores. ' +
        'Fuente: <a href="' + esc(url(ley.fuente && ley.fuente.url)) + '" rel="noopener">' + esc(ley.fuente && ley.fuente.titulo) + '</a>' +
        (ley.fuente && ley.fuente.publicado ? ', publicado el ' + esc(fCorta(ley.fuente.publicado)) : '') + '.</p>' : '';
      bloque('partidas', 'El detalle, partida por partida', '<article class="tarjeta" id="partidas" aria-labelledby="h-partidas"><div class="tarjeta-cuerpo">' +
        '<p class="num-bloque">Bloque {{N}}</p><h2 id="h-partidas">El detalle, partida por partida</h2>' +
        '<p>Aquí mostramos, de forma oportuna y cómoda, lo que la Ley de Presupuestos ' + esc(annoP - 1 || '') + ' fijó para cada partida y cuántas veces votó la Cámara en cada una. No es una auditoría ni reemplaza los documentos oficiales: es un punto de partida para ubicarse.</p>' +
        '<p>Para el detalle recomendamos consultar <a href="' + esc(url(dt.url)) + '" rel="noopener">' + esc(dt.sitio) + '</a>, un sitio independiente, hecho por otras personas, que lee los documentos oficiales línea por línea, compara el proyecto con la ley vigente en pesos del mismo año y sigue las indicaciones y votaciones. Respetamos su trabajo, pero no tenemos relación con él. Cada partida de las tablas enlaza a su página allí.</p>' +
        (tablaLey || '<ul class="partidas">' + esp.partidas.map(function (x) { return '<li>' + enlaceP(x) + '</li>'; }).join('') + '</ul>') + tablaVotos +
        '<h3>Para ir más a fondo</h3>' +
        '<p>Estas pantallas de ' + esc(dt.sitio) + ' amplían lo que ve arriba:</p>' +
        '<ul class="enlaces-detalle">' +
        (url(dt.url) ? '<li><a href="' + esc(dt.url) + '" rel="noopener">Inicio</a>: cuánto propone gastar el Ejecutivo en cada partida y cuánto cambia respecto de la ley vigente.</li>' : '') +
        (url(dt.votaciones) ? '<li><a href="' + esc(dt.votaciones) + '" rel="noopener">Votaciones</a>: qué se votó en cada partida y con qué resultado, hasta la última votación.</li>' : '') +
        (url(dt.indicaciones) ? '<li><a href="' + esc(dt.indicaciones) + '" rel="noopener">Indicaciones</a>: lo que el Ejecutivo y los parlamentarios proponen cambiar, y qué monto mueve cada cambio.</li>' : '') +
        '</ul>' +
        '<p class="nota" style="color:var(--tinta-suave)">' + esc(dt.sitio) + ' es un proyecto independiente. Urgencias Kast y Lo Común no tienen relación con quienes lo hacen ni responden por sus cifras; lo recomendamos porque respetamos su trabajo. Si una cifra de aquí difiere de la de allá, vale la de las fuentes oficiales que cada sitio cita.</p>' +
        '</div></article>');
    }

    bloques.push(ofertaAmpliado(true));

    // 2. Posiciones
    if (completa && F.posiciones) {
      var cls = { 'A favor': 'p-favor', 'En contra': 'p-contra', 'Con reparos': 'p-reparos' };
      bloque('posiciones', 'Qué han dicho las organizaciones', '<article class="tarjeta" id="posiciones" aria-labelledby="h-pos">' +
        franja('Herramienta', t('posiciones', 'Registro de posiciones públicas'),
          'Un proyecto se decide en el Congreso, pero se discute fuera de él. Registrar qué piden gremios, empresas, sindicatos y organizaciones sociales muestra qué intereses están en juego. Es la primera parte del mapa de actores que usan los estudios de ciencia política.',
          'Solo registra lo que una organización dijo en público, con fecha. Que no encontremos una declaración no significa que esa organización no tenga posición. No incluye a parlamentarios ni a particulares.',
          'Para saber qué organizaciones se han pronunciado, qué argumentos traen y con quién conviene conversar antes de que el proyecto se vote.') +
        '<div class="tarjeta-cuerpo"><p class="num-bloque">Bloque {{N}} · <span class="et et-hecho">' + t('hecho', 'Hecho') + '</span></p><h2 id="h-pos">Qué han dicho las organizaciones</h2>' +
        '<p>Posiciones de gremios y organizaciones de la sociedad civil, según lo que publicaron o declararon a la prensa.</p><div class="posiciones">' +
        F.posiciones.map(function (x) {
          return '<div class="posicion"><div><h4>' + esc(x.organizacion) + '</h4><span class="tipo-org">' + esc([x.tipo, x.vocero ? 'vocería: ' + x.vocero : ''].filter(Boolean).join(' · ')) + '</span></div>' +
            '<span class="postura ' + (cls[x.postura] || 'p-reparos') + '">' + esc(x.postura) + '</span><p>' + esc(x.argumento) + '</p>' +
            '<span class="cita">' + esc(cap(x.fecha)) + refs(x.fuentes) + '</span></div>';
        }).join('') + '</div>' +
        (F.posiciones_sin_registro ? '<p class="sin-registro">' + esc(F.posiciones_sin_registro) + '</p>' : '') +
        '<p class="nota" style="margin-top:14px">¿Su organización se pronunció sobre este proyecto y no aparece aquí? <a href="' + urlAsesoria('posiciones') + '">Envíenos el enlace a su declaración pública</a>.</p>' +
        masCta('Para saber qué piden los grupos que este proyecto toca, desde dónde interpretan la discusión y cómo hablarles, Lo Común elabora el mapa de identidades y demandas de un distrito, una región o un sector.') +
        '</div></article>');
    }

    // 3. Encuadre
    if (completa && F.encuadre && F.encuadre.marcos && F.encuadre.marcos.length) {
      var E = F.encuadre;
      bloque('encuadre', 'Cómo se habla del proyecto', '<article class="tarjeta" id="encuadre" aria-labelledby="h-enc">' +
        franja('Herramienta', 'Análisis del ' + t('encuadre'),
          'Quien habla de un problema siempre elige qué mostrar: cuál es el problema, quién es responsable y qué solución propone. Esa elección se llama encuadre (Entman, 1993). Saber cómo encuadra cada lado ayuda a entender por qué no se ponen de acuerdo.',
          'Es una ' + t('exploratoria', 'lectura exploratoria') + ': la hizo una persona sobre un conjunto acotado de notas. Un análisis completo exige que dos personas clasifiquen el material por separado y medir cuánto coinciden. No mide qué piensa la población.',
          'Para conocer las palabras que ya usa cada lado antes de intervenir en el debate, y no repetir sin querer el lenguaje del otro.') +
        '<div class="tarjeta-cuerpo"><p class="num-bloque">Bloque {{N}} · <span class="et et-interp">' + t('interpretacion', 'Interpretación') + '</span></p><h2 id="h-enc">Cómo se habla del proyecto</h2>' +
        (E.intro ? '<p>' + esc(E.intro) + '</p>' : '') + '<div class="encuadres">' +
        E.marcos.map(function (m) {
          return '<div class="encuadre"><h4>' + esc(m.titulo) + '</h4><p class="quien">' + esc(m.quienes) + '</p><dl>' +
            '<dt>El problema</dt><dd>' + esc(m.problema) + refs(m.problema_fuentes) + '</dd>' +
            '<dt>La causa</dt><dd>' + esc(m.causa) + refs(m.causa_fuentes) + '</dd>' +
            '<dt>La solución</dt><dd>' + esc(m.solucion) + refs(m.solucion_fuentes) + '</dd>' +
            ((m.palabras || []).length ? '<dt>Palabras que usa</dt><dd><div class="palabras">' + m.palabras.map(function (w) { return '<span>' + esc(w) + '</span>'; }).join('') + '</div></dd>' : '') +
            '</dl></div>';
        }).join('') + '</div>' +
        (E.disputa && E.disputa.palabra ? '<div class="disputa"><h4>Palabra en disputa: «' + esc(E.disputa.palabra) + '»</h4><p>' + oraciones(E.disputa.oraciones) + '</p></div>' : '') +
        masCta('Para disputar este debate con palabras propias, Lo Común hace el análisis completo del campo discursivo, define la idea central con una ficha de significante y prepara respuestas a los ataques previsibles.') +
        '</div></article>');
    }

    // 4. Urgencia y tramitación
    if (p) {
      var hitos = (p.tramites || []).map(function (x) { return { f: x.fecha, d: x.descripcion, c: x.camara, exp: explicarTramite(x.descripcion || '') }; })
        .filter(function (x) { return x.exp !== null; });
      var vistos = {};
      hitos = hitos.filter(function (x) { var k = x.f + x.d; if (vistos[k]) return false; vistos[k] = 1; return true; }).slice(-8);
      var urgs = (p.urgencias || []).filter(function (u) { return (u.ingreso || '') >= ((U && U.inicio_gobierno) || '2026-03-11'); });
      var filas = urgs.map(function (u, i) {
        var prev = urgs[i - 1];
        var que = !prev ? 'Pone urgencia <b>' + esc(u.tipo.toLowerCase()) + '</b>' : (prev.tipo === u.tipo ? 'Renueva la ' + esc(u.tipo.toLowerCase()) : 'Cambia a <b>' + esc(u.tipo.toLowerCase()) + '</b>');
        var plazo = (v.mixta && i === urgs.length - 1 ? ({ 'Discusión inmediata': 2, 'Suma': 5, 'Simple': 10 }) : ({ 'Discusión inmediata': 6, 'Suma': 15, 'Simple': 30 }))[u.tipo];
        return '<tr><td class="num">' + esc(fCorta(u.ingreso)) + '</td><td>' + que + (u.camara ? ' · ' + esc(camaraCorta(u.camara)) : '') + '</td><td class="num">' + (plazo ? plazo + ' días' : '') + '</td></tr>';
      }).reverse();
      var estadoTxt = '';
      if (esPres && pe) { var np = dias(pe.plazo); estadoTxt = '<b>' + (np === 0 ? 'Vence hoy' : (np === 1 ? 'Vence mañana' : 'Vence en ' + np + ' días')) + ': el ' + esc(fLarga(pe.plazo)) + '.</b> ' + esc(pe.plazo_fuente ? 'Fuente: ' + pe.plazo_fuente : ''); }
      else if (v.estado === 'vigente' && dias(v.vence) >= 0) estadoTxt = '<b>' + esc(e.txt) + '.</b> La ' + esc((v.tipo || '').toLowerCase()) + ' corre en ' + (v.camara === 'Senado' ? 'el Senado' : 'la Cámara') + ' desde el ' + esc(fLarga(v.desde)) + (v.mixta ? ', con el ' + t('mixta_plazo', 'plazo de comisión mixta') : '') + '.';
      else if (v.estado === 'en_espera') estadoTxt = '<b>' + t('en_espera', 'Urgencia en espera') + '.</b> El proyecto pasó a ' + (p.camara_actual === 'Senado' ? 'el Senado' : 'la Cámara') + ' después de la última urgencia, del ' + esc(fLarga(v.desde)) + '. El plazo se cuenta desde que esa cámara da cuenta de una urgencia; la ficha se actualizará cuando ocurra.';
      else if (v.estado === 'finalizado') estadoTxt = '<b>El Congreso terminó de votar este proyecto.</b> Está en el ' + t('finalizacion') + ', por lo que la urgencia ya no fija plazos.';
      else if (v.vence) estadoTxt = '<b>Plazo vencido el ' + esc(fLarga(v.vence)) + '.</b> No figura una urgencia nueva en los datos del Senado. Cuando el gobierno no renueva, el proyecto pierde prioridad en la tabla.';
      bloque('urgencia', esPres ? 'Plazo y tramitación' : 'Urgencia y tramitación', '<article class="tarjeta" id="urgencia" aria-labelledby="h-urg">' +
        franja('Datos oficiales', 'Urgencia, plazos y tramitación',
          'Las urgencias son la herramienta con que el Ejecutivo ordena la agenda del Congreso. Los datos vienen del servicio del Senado y de los datos abiertos de la Cámara, que consultamos cada tres horas. Los plazos se calculan según la ley orgánica del Congreso (Ley 18.918, artículos 27, 28 y 70).',
          'Los plazos son de días corridos desde que la cámara da cuenta de la urgencia. El Congreso no siempre los cumple, y el gobierno suele renovarlos en lugar de dejarlos vencer.',
          'Para ordenar la agenda de trabajo y anticipar cuándo el proyecto volverá a discutirse.') +
        '<div class="tarjeta-cuerpo"><p class="num-bloque">Bloque {{N}} · <span class="et et-hecho">' + t('hecho', 'Hecho') + '</span></p>' +
        (esPres ? '<h2 id="h-urg">Plazo para despachar el Presupuesto</h2>' +
          '<p>La Ley de Presupuestos no lleva urgencias. La Constitución (artículo 67) da al Congreso 60 días desde que el Presidente presenta el proyecto para despacharlo; si no lo despacha a tiempo, rige el proyecto presentado.</p>' +
          (estadoTxt ? '<div class="estado-urgencia">' + estadoTxt + '</div>' : '')
        : '<h2 id="h-urg">Cuánto apura el gobierno este proyecto</h2>' +
        '<p>Una ' + t('urgencia') + ' es un plazo que el Presidente fija a una cámara para despachar un proyecto. ' +
        (v.tipo ? 'Este proyecto tiene ' + (v.tipo === 'Discusión inmediata' ? t('discusion', 'discusión inmediata') + ', la más corta' : (v.tipo === 'Suma' ? t('suma', 'suma urgencia') + ', de quince días' : t('simple', 'urgencia simple') + ', de treinta días')) + '.' : '') + '</p>' +
        '<div class="estado-urgencia">' + estadoTxt + (nSenado ? '<a class="ref" href="#f' + nSenado + '">' + nSenado + '</a>' : '') + '</div>' +
        '<div class="marcadores"><div><strong>' + (p.urgencias_gobierno || urgs.length) + '</strong><span>urgencias desde marzo de 2026</span></div>' +
        '<div><strong>' + (p.renovaciones || 0) + '</strong><span>' + t('renovacion', 'renovaciones') + '</span></div>' +
        '<div><strong>' + (p.cambios_tipo || 0) + '</strong><span>' + t('cambio_tipo', 'cambios de tipo') + '</span></div></div>' +
        '<p><b>Qué indica una renovación.</b> Renovar es retirar la urgencia y volver a ponerla para que el plazo empiece de nuevo. Muestra que el gobierno mantiene su prioridad aunque el plazo anterior no se cumplió. Un cambio de tipo que acorta el plazo indica que la prioridad subió.</p>') +
        (filas.length ? '<h3>Historial de urgencias</h3><div class="tabla-caja"><table><thead><tr><th>Fecha</th><th>Qué hizo el gobierno</th><th>Plazo</th></tr></thead><tbody>' + filas.join('') + '</tbody></table></div>' : '') +
        '<h3>Tramitación</h3><p>' + etapaExplicada(p) + '</p><ol class="linea">' +
        hitos.map(function (h, i) {
          return '<li' + (i === hitos.length - 1 ? ' class="ultimo"' : '') + '><time>' + esc(fCorta(h.f)) + (h.c ? ' · ' + esc(camaraCorta(h.c)) : '') + '</time><b>' + esc(h.d.replace(/\s+\./g, '.').replace(/\s+/g, ' ')) + '</b>' + (h.exp ? '<span class="exp">' + esc(h.exp) + '</span>' : '') + '</li>';
        }).join('') +
        citas.map(function (s) { return '<li class="proximo"><time>' + esc(fCorta(s.fecha)) + (s.hora ? ' · ' + esc(s.hora) : '') + '</time><b>Citado: ' + esc(s.organo) + ', ' + esc(camaraCorta(s.camara)) + '</b><span class="exp">Según la ' + t('citacion', 'citación') + ' publicada.</span></li>'; }).join('') +
        '</ol>' +
        resultadosCamara(p.boletin) +
        masCta('Cada hito de la tramitación es una oportunidad para comunicar una posición clara. Lo Común diseña las piezas para cada uno, con frases y cuñas listas para usar.') +
        '</div></article>');
    }

    // Invitación
    var invitacion = '<aside class="vidrio invitacion" aria-labelledby="h-inv">' +
      '<p class="eyebrow">Asesoría de Lo Común</p>' +
      '<h2 id="h-inv">Para conducir la discusión de ' + esc((F && F.materia) || 'este proyecto') + '</h2>' +
      '<p class="para">Para parlamentarios, bancadas y partidos</p>' +
      '<p>Esta ficha muestra qué dice el proyecto. La asesoría entrega lo necesario para intervenir con ventaja: las posturas que de verdad existen, lo que cuesta asumir cada una, el espacio que el tema tiene en los medios y las palabras con que se puede hacer propio. Lo hacemos con herramientas de las ciencias sociales modernas y posmodernas: teoría del discurso, estudios de identidad y estudios de circulación en redes.</p>' +
      '<ul><li><b>Las posturas que de verdad existen</b>Qué se discute en realidad, quién sostiene cada postura y con qué argumentos. Se sabe con quién se habla y qué van a responder.</li>' +
      '<li><b>El costo político de cada postura</b>Qué se gana y qué se arriesga con cada alternativa ante la bancada, la base y los grupos que el proyecto toca.</li>' +
      '<li><b>El potencial mediático del tema</b>Qué parte de la discusión puede volverse noticia o circular en redes, y en qué momento de la tramitación.</li>' +
      '<li><b>Las palabras para ganar el debate</b>La idea central con que se hace propio el tema y se aprovecha la contingencia, con frases y cuñas listas para usar.</li></ul>' +
      '<div class="acciones"><a class="boton" href="' + urlAsesoria('solicitar') + '">Solicitar una asesoría</a><a class="boton boton-vidrio" href="' + urlAsesoria() + '">Cómo trabajamos</a></div>' +
      '<p class="letra-chica">Informes originales, con todas sus fuentes, financiables con la asignación de asesoría externa; el diseño de piezas, con gastos operacionales de comunicación. No incluye asesoría de imagen, encuestas ni contenido electoral. Esta ficha no recomienda posiciones a nadie.</p></aside>';

    var fuentesHTML = '<article class="tarjeta" id="fuentes" aria-labelledby="h-fuentes"><div class="tarjeta-cuerpo">' +
      '<p class="num-bloque">Fuentes' + (F && F.consultado ? ' · consultadas el ' + esc(fLarga(F.consultado)) : '') + '</p><h2 id="h-fuentes">De dónde sale cada dato</h2><ol class="fuentes">' +
      fuentes.map(function (f, i) {
        var url = /^https?:\/\//.test(f.url || '') ? f.url : '';
        return '<li id="f' + (i + 1) + '"><span>' + (i + 1) + '</span><span>' + (url ? '<a href="' + esc(url) + '" rel="noopener">' + esc(f.titulo) + '</a>' : esc(f.titulo)) +
          '<small>' + esc([f.fecha, f.nota].filter(Boolean).join('. ')) + '</small></span></li>';
      }).join('') + '</ol>' +
      (F && F.revision ? '<p class="nota" style="margin-top:16px;color:var(--tinta-suave)">' + esc(F.revision) + '</p>' : '') +
      '<p class="nota" style="margin-top:8px;color:var(--tinta-suave)">¿Encontró un error? Escríbanos a <b>' + esc(CFG.correo || '') + '</b> indicando el boletín. Las correcciones se publican con fecha.</p>' +
      '</div></article>';

    indice.push('<li><a href="#fuentes">Fuentes</a></li>');
    var proxima = citas[0];
    var datos = '<dl>' +
      '<dt>Boletín</dt><dd>' + esc(b) + '</dd>' +
      (p ? '<dt>Origen</dt><dd>' + (mocion ? t('mocion', 'Moción parlamentaria') : t('mensaje', 'Mensaje del Presidente')) + '</dd>' : '') +
      (p && p.fecha_ingreso ? '<dt>Ingreso</dt><dd>' + esc(fCorta(p.fecha_ingreso)) + ', ' + esc(p.camara_origen === 'Senado' ? 'Senado' : 'Cámara') + '</dd>' : '') +
      (p ? '<dt>Etapa</dt><dd>' + esc(tramiteDe(p.etapa)) + (p.camara_actual ? ', ' + esc(camaraCorta(p.camara_actual)) : '') + '</dd>' : '') +
      (v.tipo ? '<dt>Urgencia</dt><dd>' + esc(v.tipo) + ' · ' + esc(e.corto) + '</dd>' : '') +
      (proxima ? '<dt>Próxima citación</dt><dd>' + esc(fCorta(proxima.fecha)) + (proxima.hora ? ', ' + esc(proxima.hora) : '') + ' · ' + esc(proxima.organo) + '</dd>' : '') +
      (p && p.dias_tramite != null ? '<dt>En trámite</dt><dd>' + p.dias_tramite + ' días</dd>' : '') +
      '</dl>';

    var chips = '';
    if (v.tipo) chips += chipUrg(v.tipo, false, true);
    if (esPres && pe) chips += '<span class="chip">Plazo constitucional · vence el ' + esc(fCorta(pe.plazo)) + '</span>';
    else if (e) chips += '<span class="chip">' + esc(e.corto) + '</span>';
    if (p && p.camara_actual) chips += '<span class="chip">Ahora en ' + esc(p.camara_actual === 'Senado' ? 'el Senado' : 'la Cámara') + '</span>';
    if (proxima) chips += '<span class="chip">Citado el ' + esc(fCorta(proxima.fecha)) + '</span>';

    main.innerHTML =
      '<section class="envoltura ficha-encabezado" aria-labelledby="titulo">' +
      '<nav class="migas" aria-label="Ruta"><a href="' + BASE + 'index.html">Urgencias</a><span aria-hidden="true">/</span><span>Boletín ' + esc(b) + '</span></nav>' +
      '<div class="chips">' + chips + '</div>' +
      ((F && F.sintesis && p) ? '<p class="titulo-oficial"><b>Título oficial</b>' + esc(p.titulo) + '</p>' : '<p class="titulo-oficial"><b>Título oficial del proyecto</b></p>') +
      '<h1 id="titulo">' + esc(titulo) + '</h1>' +
      (F && F.estado_revision === 'pendiente' ? '<div class="aviso-piloto" role="note"><p class="eyebrow">Revisión pendiente · piloto de prueba</p>' +
        '<p>Esta ficha la redactó un sistema automático a partir de documentos oficiales y prensa, y el equipo de Lo Común aún no la revisa. Cada oración enlaza a la fuente de donde sale: ante cualquier duda, vale lo que dice la fuente. Si encuentra un error, escríbanos a <b>' + esc(CFG.correo || '') + '</b> indicando el boletín.</p></div>' : '') +
      // Errores del Congreso que el equipo decidió informar (por ejemplo, una citación con el número de otro boletín).
      ((F && Array.isArray(F.avisos_congreso) && F.avisos_congreso.length) ? '<div class="aviso-congreso" role="note"><p class="eyebrow">Error en un documento del Congreso</p>' +
        F.avisos_congreso.map(function (a) { return '<p>' + esc(a.texto) + (a.fecha ? ' <small>(' + esc(fCorta(a.fecha)) + ')</small>' : '') + '</p>'; }).join('') + '</div>' : '') +
      (completa ? '<section class="vidrio csa" aria-labelledby="h-csa"><div><p class="eyebrow">Antes de leer</p><h2 id="h-csa">Esta ficha es un trabajo de ' + t('csa', 'ciencias sociales aplicadas') + '</h2>'
        : '<details class="vidrio csa csa-breve"><summary><span class="eyebrow">Antes de leer</span><span class="csa-titulo">Cómo se hacen las fichas: ciencias sociales aplicadas</span><span class="abrir"></span></summary><div>') +
      '<p>Las ciencias sociales estudian cómo actúan las personas, los grupos y las instituciones. Son <i>aplicadas</i> cuando usan esos conocimientos para responder una pregunta práctica con un método que cualquiera puede revisar. Aquí la pregunta es simple: qué propone este proyecto, quién se ha pronunciado sobre él y cómo se discute en público.</p>' +
      '<p>Cada parte de la ficha usa una herramienta distinta. Al abrir cada bloque verá cuál es, por qué la usamos, qué no puede decir y para qué sirve. Cada afirmación lleva una de estas tres etiquetas:</p></div>' +
      '<div class="tipos"><div class="tipo"><strong><span class="et et-hecho">Hecho</span></strong><p>Consta en un documento que se puede revisar: el proyecto, una votación, una declaración publicada. Siempre enlaza a su fuente.</p></div>' +
      '<div class="tipo"><strong><span class="et et-estim">Estimación</span></strong><p>Una inferencia a partir de hechos. Puede fallar, por eso declara su margen de error y se verifica después.</p></div>' +
      '<div class="tipo"><strong><span class="et et-interp">Interpretación</span></strong><p>Una lectura argumentada de los hechos. Muestra en qué se apoya para que el lector pueda discutirla.</p></div></div>' + (completa ? '</section>' : '</details>') +
      '</section>' +
      '<div class="envoltura ficha-cuerpo con-flotante">' +
      '<aside class="ficha-lateral" aria-label="Resumen de la ficha"><section class="vidrio"><h2>En esta ficha</h2><ol class="indice">' + indice.join('') + '</ol></section>' +
      '<section class="vidrio"><h2>Datos clave</h2>' + datos + '</section></aside>' +
      bloques.join('') + ofertaAmpliado(false) + invitacion + fuentesHTML + '</div>' +
      '<a class="boton flotante oculto" href="' + urlAsesoria('solicitar') + '">Solicitar asesoría</a>';
    botonFlotante();
    if (ofrecerAmpliado) main.querySelectorAll('[data-ampliado]').forEach(function (x) { x.addEventListener('click', function () { abrirAmpliado(b, titulo); }); });
    if (location.hash) { var el = document.getElementById(location.hash.slice(1)); if (el) el.scrollIntoView(); }
  }

  /* ---------- pedido de análisis ampliado ----------
     Formulario en un cuadro de diálogo. Envía nombre, correo y autorizaciones al panel de Lo Común
     (CFG.pedidosUrl), que guarda el pedido para que el equipo lo acepte. Nada se guarda en el navegador. */
  function abrirAmpliado(b, titulo) {
    var dlg = $('#dlg-ampliado');
    if (dlg) dlg.remove();
    document.body.insertAdjacentHTML('beforeend',
      '<dialog id="dlg-ampliado" class="dlg-ampliado" aria-labelledby="dlg-amp-t"><form method="dialog" class="dlg-cuerpo" novalidate>' +
      '<button type="submit" class="dlg-cerrar" value="cerrar" aria-label="Cerrar">×</button>' +
      '<p class="eyebrow">Análisis ampliado gratuito</p>' +
      '<h2 id="dlg-amp-t">' + esc(titulo) + '</h2>' +
      '<p class="dlg-bol">Boletín ' + esc(b) + '</p>' +
      '<div class="dlg-info"><b>Qué contiene</b><ul>' +
      '<li><b>Qué han dicho las organizaciones:</b> las posiciones públicas de gremios, empresas, sindicatos, organizaciones sociales y municipios, con su fecha y su fuente.</li>' +
      '<li><b>Cómo se habla del proyecto:</b> qué problema, qué causa y qué solución destaca cada lado del debate, y qué palabras usa (análisis de encuadre).</li>' +
      '<li>Se elabora con las notas de prensa de una lista fija de medios, y cada afirmación enlaza a su fuente.</li></ul>' +
      '<b>Cuándo</b><p>Se publicará en esta misma ficha dentro de las próximas horas. Le avisaremos por correo cuando esté lista.</p></div>' +
      '<div class="dlg-campos"><label>Nombre<input type="text" name="nombre" autocomplete="name" maxlength="120" required></label>' +
      '<label>Correo electrónico<input type="email" name="correo" autocomplete="email" maxlength="200" required></label></div>' +
      '<label class="dlg-trampa" aria-hidden="true">No llenar<input type="text" name="sitio_web" tabindex="-1" autocomplete="off"></label>' +
      '<label class="dlg-check"><input type="checkbox" name="autoriza_contacto" required><span>Autorizo a Lo Común a usar este correo para avisarme cuando esta ficha sea actualizada. <i>(obligatorio)</i></span></label>' +
      '<label class="dlg-check"><input type="checkbox" name="newsletter"><span>Quiero sumarme al boletín de novedades para enterarme de primera fuente de Urgencias Kast y de otros productos de Lo Común.</span></label>' +
      '<p class="dlg-msg" role="alert" hidden></p>' +
      '<div class="acciones"><button type="button" class="boton" data-enviar>Enviar solicitud</button><button type="submit" class="boton boton-vidrio-claro" value="cerrar">Cancelar</button></div>' +
      '<p class="letra-chica">No publicamos ni compartimos su correo. Para borrarlo de nuestros registros, escriba a ' + esc(CFG.correo || '') + '.</p>' +
      '</form></dialog>');
    dlg = $('#dlg-ampliado');
    var form = $('form', dlg), msg = $('.dlg-msg', dlg), enviar = $('[data-enviar]', dlg), abierto = Date.now();
    function error(t) { msg.textContent = t; msg.hidden = false; }
    enviar.addEventListener('click', function () {
      var nombre = form.nombre.value.trim(), correo = form.correo.value.trim();
      msg.hidden = true;
      if (nombre.length < 2) { error('Escriba su nombre.'); form.nombre.focus(); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) { error('Revise su correo electrónico.'); form.correo.focus(); return; }
      if (!form.autoriza_contacto.checked) { error('Para enviar la solicitud, marque la autorización para avisarle por correo.'); form.autoriza_contacto.focus(); return; }
      enviar.disabled = true; enviar.textContent = 'Enviando…';
      fetch(CFG.pedidosUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit',
        body: JSON.stringify({ boletin: b, nombre: nombre, correo: correo, autoriza_contacto: true, newsletter: form.newsletter.checked, sitio_web: form.sitio_web.value, ms: Date.now() - abierto })
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'No pudimos registrar la solicitud.'); return d; });
      }).then(function (d) {
        form.innerHTML = '<button type="submit" class="dlg-cerrar" value="cerrar" aria-label="Cerrar">×</button>' +
          '<p class="eyebrow">Solicitud recibida</p><h2>Gracias, ' + esc(nombre.split(' ')[0]) + '</h2>' +
          '<p>' + (d.repetido ? 'Ya teníamos su solicitud para este proyecto.' : 'Recibimos su solicitud del análisis ampliado.') + ' Se publicará en esta misma ficha dentro de las próximas horas y le avisaremos a <b>' + esc(correo) + '</b>.</p>' +
          '<div class="acciones"><button type="submit" class="boton" value="cerrar">Volver a la ficha</button></div>';
      }).catch(function (e) {
        enviar.disabled = false; enviar.textContent = 'Enviar solicitud';
        error((e && e.message && !/Failed to fetch|NetworkError|Load failed/i.test(e.message) ? e.message : 'No pudimos enviar la solicitud.') + ' Si el problema sigue, escríbanos a ' + (CFG.correo || '') + '.');
      });
    });
    dlg.addEventListener('close', function () { dlg.remove(); });
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    form.nombre.focus();
  }

  /* El botón flotante aparece después del primer bloque y se oculta cuando la invitación
     completa o el pie están a la vista, para no tapar lo que se lee. */
  function botonFlotante() {
    var btn = $('.flotante');
    if (!btn) return;
    var tapan = 0, bajo = false;
    function aplicar() { btn.classList.toggle('oculto', !bajo || tapan > 0); }
    window.addEventListener('scroll', function () { var b = window.scrollY > 480; if (b !== bajo) { bajo = b; aplicar(); } }, { passive: true });
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { tapan += e.isIntersecting ? 1 : (e.target._visto ? -1 : 0); e.target._visto = e.isIntersecting; });
        tapan = Math.max(0, tapan); aplicar();
      });
      document.querySelectorAll('.invitacion, .pie').forEach(function (x) { io.observe(x); });
    }
  }

  /* ---------- producción de Lo Común ----------
     Lee el resumen que publica locomun.cl; si no responde, usa la copia que la acción de
     actualización guarda cada tres horas en data/locomun.json. */
  function loComun() {
    var cont = $('#locomun');
    if (!cont) return;
    var url = (CFG.locomunUrl || 'https://locomun.cl') + '/contenido/feed.json';
    fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
      .catch(function () { return cargarOpc('data/locomun.json'); })
      .then(function (L) {
        if (!L || !(L.monitor || []).length) { cont.hidden = true; return; }
        cont.querySelector('.estudios').innerHTML = L.monitor.slice(0, 3).map(function (m) {
          var url = /^https?:\/\//.test(m.url || '') ? m.url : (CFG.locomunUrl || 'https://locomun.cl') + '/#monitor';
          return '<article class="tarjeta estudio"><div class="tarjeta-cuerpo"><p class="num-bloque">Monitor económico · Estudio ' + esc(m.numero) + '</p>' +
            '<h3>' + esc(m.titulo) + '</h3><p>' + esc(m.resumen) + '</p>' +
            ((m.cifras || []).length ? '<ul class="cifras-estudio">' + m.cifras.slice(0, 3).map(function (c) { return '<li><b>' + esc(c[0]) + '</b><span>' + esc(c[1]) + '</span></li>'; }).join('') + '</ul>' : '') +
            '<p class="nota" style="color:var(--tinta-suave)">' + esc([m.autor, m.fecha_texto].filter(Boolean).join(' · ')) + '</p>' +
            '<a class="boton boton-indigo" href="' + esc(url) + '" rel="noopener">Ver el estudio</a></div></article>';
        }).join('');
      });
  }

  /* ---------- resultados de comisiones de la Cámara ---------- */
  // Los carga el equipo desde la página de resultados de camara.cl (data/resultados_camara.json).
  var RESULTADOS = [];
  function resultadosCamara(boletin) {
    var lista = RESULTADOS.filter(function (x) { return (x.boletines || []).indexOf(boletin) >= 0; })
      .sort(function (a, b) { return (b.fecha + (b.hora || '')).localeCompare(a.fecha + (a.hora || '')); }).slice(0, 12);
    if (!lista.length) return '';
    return '<h3>Qué pasó en las comisiones de la Cámara</h3>' +
      '<p>Resultado de cada sesión en que se trató este proyecto, según lo informa la Cámara de Diputadas y Diputados. Lo copia el equipo de Lo Común desde camara.cl.</p>' +
      '<div class="tabla-caja"><table><thead><tr><th>Fecha</th><th>Comisión</th><th>Resultado</th></tr></thead><tbody>' +
      lista.map(function (x) {
        return '<tr><td>' + esc(fCorta(x.fecha)) + '</td><td>' + esc(String(x.organo || '').replace(/^Comisión de /, '')) + '</td><td><b>' + esc(x.hito || '') + '.</b> ' + esc(x.resultado || '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  /* ---------- arranque ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    iniciarGlosario();
    document.querySelectorAll('[data-correo]').forEach(function (x) { x.textContent = CFG.correo || ''; });
    var pagina = document.body.getAttribute('data-pagina');
    if (['portada', 'ficha', 'agenda'].indexOf(pagina) === -1) return;
    Promise.all([cargar('data/urgencias.json'), cargarOpc('data/agenda.json'), cargarOpc('data/fichas/indice.json'),
      pagina !== 'agenda' ? cargarOpc('data/resultados_camara.json') : Promise.resolve(null),
      pagina !== 'agenda' ? cargarOpc('data/votaciones_sala.json') : Promise.resolve(null),
      pagina === 'ficha' ? cargarOpc('data/presupuesto_vigente.json') : Promise.resolve(null)]).then(function (r) {
      var U = r[0], A = r[1], IDX = r[2] || {};
      RESULTADOS = (r[3] && r[3].resultados) || [];
      VOTACIONES = (r[4] && r[4].votaciones) || [];
      VOTOS_PARTIDA = (r[4] && r[4].por_partida) || {};
      ESPECIALES = (A && A.especiales) || {};
      LEYES_PRESUPUESTO = (r[5] && r[5].leyes) || {};
      if (pagina === 'portada') { portada(U, A, IDX); loComun(); }
      else if (pagina === 'agenda') agenda(U, A, IDX);
      else ficha(U, A, IDX);
    }).catch(function () {
      var m = $('main');
      if (m) m.insertAdjacentHTML('afterbegin', '<div class="envoltura"><p class="aviso" style="margin-top:20px">No pudimos cargar los datos. Intente de nuevo en unos minutos.</p></div>');
    });
  });
})();
