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
    var citas = A ? (A.sesiones || []).filter(function (s) { return s.estado !== 'sin efecto' && s.boletines && s.boletines.length && s.fecha <= limite; }) : [];

    if (U.actualizado) {
      var d = new Date(U.actualizado);
      $('#actualizado').innerHTML = '<span class="vivo" aria-hidden="true"></span>Datos oficiales actualizados el ' + d.getDate() + ' de ' + MESES_L[d.getMonth()] + ' a las ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }
    var cifras = [
      [vigentes.length, 'Proyectos con ' + t('urgencia') + ' vigente', 'Los que el gobierno apura hoy: una cámara debe despacharlos dentro de un plazo.'],
      [di.length, 'Con ' + t('discusion', 'discusión inmediata'), 'El plazo más corto, seis días. Es la máxima prioridad del gobierno.'],
      [semana.length, 'Plazos que vencen en 7 días', 'Proyectos que esta semana deberían votarse o recibir una nueva urgencia.'],
      (A && Object.keys(A.fuentes || {}).some(function (k) { return A.fuentes[k].estado === 'ok'; })) ? [citas.length, 'Sesiones de comisión citadas en 7 días', 'Citaciones publicadas por el Senado y la Cámara que tratan proyectos de ley.']
        : [ps.filter(function (p) { return p.urgencia_vigente && p.urgencia_vigente.estado === 'en_espera'; }).length, 'Proyectos en espera en la otra cámara', 'Pasaron de cámara y esperan que allí se dé cuenta de una urgencia.']
    ];
    $('#cifras').innerHTML = cifras.map(function (c) {
      return '<div class="cifra vidrio"><strong>' + c[0] + '</strong><span class="que">' + c[1] + '</span><span class="por">' + c[2] + '</span></div>';
    }).join('');

    // Reloj del próximo plazo
    var proximo = vigentes.slice().sort(function (a, b) { return a.urgencia_vigente.vence < b.urgencia_vigente.vence ? -1 : 1; })[0];
    var caja = $('#reloj');
    if (proximo && caja) {
      var nom = nombreProyecto(proximo.boletin, U, A, IDX);
      $('#reloj-titulo').innerHTML = '<a href="' + urlFicha(proximo.boletin) + '">' + esc(recortar(nom.sintesis || nom.oficial, 170)) + '</a>';
      $('#reloj-meta').innerHTML = chipUrg(proximo.urgencia_vigente.tipo) + ' <span class="chip">Boletín ' + esc(proximo.boletin) + '</span> <span class="chip">' + esc(camaraCorta(proximo.camara_actual)) + '</span>';
      var fin = fecha(proximo.urgencia_vigente.vence); fin.setHours(23, 59, 59);
      var tic = function () {
        var ms = Math.max(0, fin - new Date());
        $('#r-d').textContent = Math.floor(ms / DIA);
        $('#r-h').textContent = String(Math.floor(ms % DIA / 3600000)).padStart(2, '0');
        $('#r-m').textContent = String(Math.floor(ms % 3600000 / 60000)).padStart(2, '0');
        $('#r-s').textContent = String(Math.floor(ms % 60000 / 1000)).padStart(2, '0');
      };
      tic(); setInterval(tic, 1000);
    } else if (caja) { caja.hidden = true; }

    tablaProyectos(U, A, IDX);
  }

  // Tabla principal: todo proyecto con urgencia vigente o en la agenda de las próximas dos semanas.
  function filasProyectos(U, A, IDX) {
    var hoyIso = isoDe(hoy()), filas = {}, orden = [];
    function fila(b) {
      if (!filas[b]) {
        var p = buscar(b, U, A);
        filas[b] = { b: b, p: p, sesiones: [], probable: null, i: IDX && IDX[b] };
        orden.push(b);
      }
      return filas[b];
    }
    (U.proyectos || []).forEach(function (p) { fila(p.boletin); });
    if (A) {
      (A.sesiones || []).forEach(function (s) {
        if (s.estado === 'sin efecto' || s.fecha < hoyIso) return;
        (s.boletines || []).forEach(function (b) { fila(b).sesiones.push(s); });
      });
      (A.probables || []).forEach(function (pr) { fila(pr.boletin).probable = pr; });
    }
    return orden.map(function (b) {
      var f = filas[b], p = f.p || {}, v = p.urgencia_vigente || {};
      f.sesiones.sort(function (x, y) { return (x.fecha + (x.hora || '99')) < (y.fecha + (y.hora || '99')) ? -1 : 1; });
      var s0 = f.sesiones[0];
      f.activa = v.estado === 'vigente' && dias(v.vence) !== null && dias(v.vence) >= 0;
      f.prox = s0 ? { fecha: s0.fecha, hora: s0.hora, organo: s0.organo, camara: s0.camara, tipo: 'citado', mas: f.sesiones.length - 1 }
        : (f.probable ? { fecha: f.probable.vence, camara: f.probable.camara || p.camara_actual, tipo: 'probable' } : null);
      f.titulo = (f.i && f.i.sintesis) || p.titulo || ('Boletín ' + b);
      f.texto = (f.titulo + ' ' + (p.titulo || '') + ' ' + b + ' ' + f.sesiones.map(function (x) { return x.organo; }).join(' ')).toLowerCase();
      return f;
    });
  }

  function tablaProyectos(U, A, IDX) {
    var cuerpo = $('#tabla-cuerpo');
    if (!cuerpo) return;
    var todas = filasProyectos(U, A, IDX);
    var fTexto = $('#f-texto'), fVista = $('#f-vista'), fTipo = $('#f-tipo'), fCamara = $('#f-camara'), fFicha = $('#f-ficha');
    var orden = { k: 'prox', dir: 1 };
    var limite7 = isoDe(new Date(hoy().getTime() + 6 * DIA));
    var BIG = '9999-12-31';
    var claves = {
      prox: function (f) { return f.prox ? f.prox.fecha + (f.prox.tipo === 'citado' ? '0' : '1') + (f.prox.hora || '99') : BIG; },
      urg: function (f) { var v = (f.p || {}).urgencia_vigente || {}; return f.activa ? v.vence : BIG; },
      renov: function (f) { return -((f.p || {}).renovaciones || 0); },
      dias: function (f) { return -((f.p || {}).dias_tramite || 0); }
    };
    var maxRenov = Math.max.apply(null, todas.map(function (f) { return (f.p || {}).renovaciones || 0; }).concat([1]));

    function proxHTML(f) {
      var x = f.prox;
      if (!x) return '<span class="sin-fecha">Sin fecha en la agenda</span>';
      var n = dias(x.fecha), cuando = n === 0 ? 'Hoy' : (n === 1 ? 'Mañana' : cap(DIAS_L[fecha(x.fecha).getDay()]).slice(0, 3) + ' ' + fecha(x.fecha).getDate() + ' ' + MESES[fecha(x.fecha).getMonth()]);
      if (x.tipo === 'citado') {
        return '<span class="prox-fecha">' + esc(cuando) + (x.hora ? ' · ' + esc(x.hora) : '') + '</span>' +
          '<span class="prox-que">' + esc(recortar(String(x.organo || '').split(/\s+-{1,2}\s+|\s+–\s+/)[0], 64)) + ' · ' + esc(camaraCorta(x.camara)) + '</span>' +
          (x.mas > 0 ? '<span class="prox-mas">y ' + plural(x.mas, 'sesión más', 'sesiones más') + '</span>' : '');
      }
      return '<span class="prox-fecha">' + esc(cuando) + '</span><span class="prox-que">' + t('probable', 'Probable') + ': vence la urgencia</span>';
    }
    function urgHTML(f) {
      var p = f.p || {}, v = p.urgencia_vigente || {};
      if (f.activa) { var e = estadoUrg(p); return chipUrg(v.tipo, true) + '<span class="vence' + (e.pronto ? ' pronto' : '') + '">' + esc(e.corto) + '</span>'; }
      if (v.tipo && (v.estado === 'vigente' || v.estado === 'vencida' || v.estado === 'en_espera')) return '<span class="sin-urg">' + esc(estadoUrg(p).corto) + '</span>';
      return '<span class="sin-urg">Sin urgencia</span>';
    }
    function fichaHTML(f) {
      if (f.i && f.i.nivel === 'completa') return '<span class="et-ficha et-completa">Análisis</span>';
      if (f.i) return '<span class="et-ficha">Resumen</span>';
      return '<span class="et-ficha et-datos">Datos</span>';
    }

    function pintar() {
      var q = (fTexto.value || '').toLowerCase().trim(), vista = fVista.value;
      var lista = todas.filter(function (f) {
        var p = f.p || {}, v = p.urgencia_vigente || {};
        var enAgenda = f.sesiones.length > 0 || !!f.probable;
        if (vista === 'agenda' && !(enAgenda || f.activa)) return false;
        if (vista === 'semana' && !(f.prox && f.prox.fecha <= limite7)) return false;
        if (vista === 'citados' && !f.sesiones.length) return false;
        if (fTipo.value === 'sin' && f.activa) return false;
        if (fTipo.value && fTipo.value !== 'sin' && !(f.activa && v.tipo === fTipo.value)) return false;
        if (fCamara.value) { var cam = f.prox ? f.prox.camara : p.camara_actual; if (cam !== fCamara.value) return false; }
        if (fFicha.checked && !f.i) return false;
        if (q && f.texto.indexOf(q) === -1) return false;
        return true;
      });
      var k = claves[orden.k];
      lista.sort(function (x, y) {
        var a = k(x), b = k(y);
        if (a === b) { a = claves.urg(x); b = claves.urg(y); }
        return (a < b ? -1 : a > b ? 1 : 0) * orden.dir;
      });
      var citados = lista.filter(function (f) { return f.sesiones.length; }).length;
      var conUrg = lista.filter(function (f) { return f.activa; }).length;
      $('#n-urgencias').textContent = plural(lista.length, 'proyecto', 'proyectos') + ' · ' + plural(citados, 'citado', 'citados') + ' en comisión · ' + conUrg + ' con urgencia vigente';
      cuerpo.innerHTML = lista.length ? lista.map(function (f) {
        var p = f.p || {}, r = p.renovaciones || 0;
        var oficial = f.i && f.i.sintesis && p.titulo ? '<span class="oficial">' + esc(recortar(p.titulo, 140)) + '</span>' : '';
        return '<tr data-href="' + urlFicha(f.b) + '">' +
          '<td class="c-bol" data-l="Boletín">' + esc(f.b) + (p.iniciativa && p.iniciativa.toLowerCase().indexOf('moci') === 0 ? '<span class="origen">Moción</span>' : '') + '</td>' +
          '<td class="c-proy" data-l="Proyecto"><a href="' + urlFicha(f.b) + '">' + esc(recortar(f.titulo, 200)) + '</a>' + oficial + '</td>' +
          '<td class="c-prox" data-l="Próxima discusión">' + proxHTML(f) + '</td>' +
          '<td class="c-urg" data-l="Urgencia y plazo">' + urgHTML(f) + '</td>' +
          '<td class="c-etapa" data-l="Etapa">' + esc(tramiteDe(p.etapa)) + (p.camara_actual ? '<span class="sub">' + esc(camaraCorta(p.camara_actual)) + '</span>' : '') + '</td>' +
          '<td class="c-num" data-l="Renovaciones"><span class="renov-barra"><i style="width:' + Math.round(100 * r / maxRenov) + '%"></i></span>' + r + '</td>' +
          '<td class="c-num" data-l="Días en trámite">' + (p.dias_tramite != null ? p.dias_tramite : '') + '</td>' +
          '<td class="c-ficha" data-l="Ficha">' + fichaHTML(f) + '<span class="flecha" aria-hidden="true">→</span></td>' +
          '</tr>';
      }).join('') : '<tr><td colspan="8" class="vacio">No hay proyectos con esos filtros.</td></tr>';
    }
    cuerpo.addEventListener('click', function (e) {
      if (e.target.closest('a')) return;
      var tr = e.target.closest('tr[data-href]');
      if (tr) location.href = tr.getAttribute('data-href');
    });
    document.querySelectorAll('.tabla-proyectos th[data-orden]').forEach(function (th) {
      var btn = th.querySelector('button');
      btn.addEventListener('click', function () {
        var k = th.getAttribute('data-orden');
        orden = { k: k, dir: orden.k === k ? -orden.dir : 1 };
        document.querySelectorAll('.tabla-proyectos th[data-orden]').forEach(function (x) { x.removeAttribute('aria-sort'); });
        var invertida = k === 'renov' || k === 'dias';  // estas columnas parten de mayor a menor
        th.setAttribute('aria-sort', (orden.dir === 1) !== invertida ? 'ascending' : 'descending');
        pintar();
      });
    });
    [fVista, fTipo, fCamara, fFicha].forEach(function (x) { x.addEventListener('change', pintar); });
    fTexto.addEventListener('input', pintar);
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
        return '<li><a href="' + urlFicha(b) + '"><span class="bol">' + esc(b) + '</span>' + esc(recortar(titulo, 190)) + '</a>' + urg + '</li>';
      }).join('') + (s._mas ? '<li class="mas"><a href="' + BASE + 'agenda.html#d' + s._dia + '">' + plural(s._mas, 'proyecto más', 'proyectos más') + ' con plazo ese día</a></li>' : '') + '</ul>';
    } else if (s.materias && s.materias.length) {
      materias = '<ul><li class="materia-libre">' + esc(recortar(s.materias.join(' '), 240)) + '</li></ul>';
    }
    var meta = '<div class="meta">' + (s.camara ? '<span class="chip' + (probable ? '' : ' chip-claro') + '">' + esc(camaraCorta(s.camara)) + '</span>' : '') +
      (s.estado === 'sin efecto' ? '<span class="chip chip-claro">Sin efecto</span>' : '') +
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
      est.push('<span class="chip">' + nombre + ': ' + (f.estado === 'ok' ? f.citaciones + ' citaciones, consultadas el ' + esc(fCorta(f.consultado)) : (f.conservadas ? 'sin actualizar; se muestran las últimas citaciones obtenidas' : 'citaciones no disponibles por ahora; se muestran los plazos de urgencia')) + '</span>');
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

    var mocion = p && (p.iniciativa || '').toLowerCase().indexOf('moci') === 0;
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
      var ap = [
        ['problema', mocion ? 'Problema que declara la moción' : 'Problema que declara el ' + t('mensaje', 'mensaje')],
        ['propone', 'Qué propone'], ['cambia', 'Qué cambia en la ley vigente'], ['afecta', 'A quién afecta, según el texto'],
        ['costo', 'Costo fiscal, según el ' + t('informe_financiero', 'informe financiero')], ['estado', 'Estado de tramitación']
      ];
      bloque('resumen', 'Qué propone el proyecto', '<article class="tarjeta" id="resumen" aria-labelledby="h-resumen">' +
        franja('Herramienta', t('resumen_estructurado'),
          'Es el formato de los artículos científicos: los mismos apartados, en el mismo orden, para todos los proyectos. Así se pueden comparar y nada importante queda fuera. Se basa en Haynes y colaboradores (1990) y en las guías de resumen en lenguaje sencillo de Cochrane.',
          'No evalúa ni opina. Cada oración repite lo que dice un documento y enlaza a él. Si un documento no estaba disponible, lo decimos en lugar de suponer su contenido.',
          'Para explicar el proyecto en un minuto a un parlamentario, un directorio, una asamblea o una redacción, y para saber qué documento abrir si se necesita el detalle.') +
        '<div class="tarjeta-cuerpo"><p class="num-bloque">Bloque {{N}} · <span class="et et-hecho">' + t('hecho', 'Hecho') + '</span></p><h2 id="h-resumen">Qué propone el proyecto</h2>' +
        ap.filter(function (a) { return R[a[0]] && R[a[0]].length; }).map(function (a) {
          return '<div class="apartado"><h3>' + a[1] + '</h3><div><p>' + oraciones(R[a[0]]) + '</p></div></div>';
        }).join('') +
        masCta('¿Qué se juega en este proyecto para su bancada o su partido, y qué posición conviene tomar? La lectura política de Lo Común lo responde con las posturas en juego, el costo de cada alternativa y su fundamento por escrito.') +
        '</div></article>');
    } else {
      bloque('resumen', 'Resumen del proyecto', '<article class="tarjeta" id="resumen" aria-labelledby="h-resumen"><div class="tarjeta-cuerpo preparacion">' +
        '<p class="num-bloque">Bloque {{N}}</p><h2 id="h-resumen">Resumen en preparación</h2>' +
        '<p>Este proyecto todavía no tiene un ' + t('resumen_estructurado') + ' verificado. Lo publicamos cuando una persona del equipo revisó cada oración contra su fuente.</p>' +
        (p && p.enlaces && p.enlaces.mensaje ? '<p>Mientras tanto, puede leer el <a href="' + esc(p.enlaces.mensaje) + '" rel="noopener">texto original del proyecto</a> o los informes de la ' + t('atp') + ' de la Biblioteca del Congreso.</p>' : '') +
        '<p class="aviso">¿Necesita este análisis antes? <a href="' + urlAsesoria('solicitar') + '">Lo Común puede prepararlo para su equipo</a>.</p>' +
        '</div></article>');
    }

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
      if (v.estado === 'vigente' && dias(v.vence) >= 0) estadoTxt = '<b>' + esc(e.txt) + '.</b> La ' + esc((v.tipo || '').toLowerCase()) + ' corre en ' + (v.camara === 'Senado' ? 'el Senado' : 'la Cámara') + ' desde el ' + esc(fLarga(v.desde)) + (v.mixta ? ', con el ' + t('mixta_plazo', 'plazo de comisión mixta') : '') + '.';
      else if (v.estado === 'en_espera') estadoTxt = '<b>' + t('en_espera', 'Urgencia en espera') + '.</b> El proyecto pasó a ' + (p.camara_actual === 'Senado' ? 'el Senado' : 'la Cámara') + ' después de la última urgencia, del ' + esc(fLarga(v.desde)) + '. El plazo se cuenta desde que esa cámara da cuenta de una urgencia; la ficha se actualizará cuando ocurra.';
      else if (v.estado === 'finalizado') estadoTxt = '<b>El Congreso terminó de votar este proyecto.</b> Está en el ' + t('finalizacion') + ', por lo que la urgencia ya no fija plazos.';
      else if (v.vence) estadoTxt = '<b>Plazo vencido el ' + esc(fLarga(v.vence)) + '.</b> No figura una urgencia nueva en los datos del Senado. Cuando el gobierno no renueva, el proyecto pierde prioridad en la tabla.';
      bloque('urgencia', 'Urgencia y tramitación', '<article class="tarjeta" id="urgencia" aria-labelledby="h-urg">' +
        franja('Datos oficiales', 'Urgencia, plazos y tramitación',
          'Las urgencias son la herramienta con que el Ejecutivo ordena la agenda del Congreso. Los datos vienen del servicio del Senado y de los datos abiertos de la Cámara, que consultamos cada tres horas. Los plazos se calculan según la ley orgánica del Congreso (Ley 18.918, artículos 27, 28 y 70).',
          'Los plazos son de días corridos desde que la cámara da cuenta de la urgencia. El Congreso no siempre los cumple, y el gobierno suele renovarlos en lugar de dejarlos vencer.',
          'Para ordenar la agenda de trabajo y anticipar cuándo el proyecto volverá a discutirse.') +
        '<div class="tarjeta-cuerpo"><p class="num-bloque">Bloque {{N}} · <span class="et et-hecho">' + t('hecho', 'Hecho') + '</span></p><h2 id="h-urg">Cuánto apura el gobierno este proyecto</h2>' +
        '<p>Una ' + t('urgencia') + ' es un plazo que el Presidente fija a una cámara para despachar un proyecto. ' +
        (v.tipo ? 'Este proyecto tiene ' + (v.tipo === 'Discusión inmediata' ? t('discusion', 'discusión inmediata') + ', la más corta' : (v.tipo === 'Suma' ? t('suma', 'suma urgencia') + ', de quince días' : t('simple', 'urgencia simple') + ', de treinta días')) + '.' : '') + '</p>' +
        '<div class="estado-urgencia">' + estadoTxt + (nSenado ? '<a class="ref" href="#f' + nSenado + '">' + nSenado + '</a>' : '') + '</div>' +
        '<div class="marcadores"><div><strong>' + (p.urgencias_gobierno || urgs.length) + '</strong><span>urgencias desde marzo de 2026</span></div>' +
        '<div><strong>' + (p.renovaciones || 0) + '</strong><span>' + t('renovacion', 'renovaciones') + '</span></div>' +
        '<div><strong>' + (p.cambios_tipo || 0) + '</strong><span>' + t('cambio_tipo', 'cambios de tipo') + '</span></div></div>' +
        '<p><b>Qué indica una renovación.</b> Renovar es retirar la urgencia y volver a ponerla para que el plazo empiece de nuevo. Muestra que el gobierno mantiene su prioridad aunque el plazo anterior no se cumplió. Un cambio de tipo que acorta el plazo indica que la prioridad subió.</p>' +
        (filas.length ? '<h3>Historial de urgencias</h3><div class="tabla-caja"><table><thead><tr><th>Fecha</th><th>Qué hizo el gobierno</th><th>Plazo</th></tr></thead><tbody>' + filas.join('') + '</tbody></table></div>' : '') +
        '<h3>Tramitación</h3><p>' + etapaExplicada(p) + '</p><ol class="linea">' +
        hitos.map(function (h, i) {
          return '<li' + (i === hitos.length - 1 ? ' class="ultimo"' : '') + '><time>' + esc(fCorta(h.f)) + (h.c ? ' · ' + esc(camaraCorta(h.c)) : '') + '</time><b>' + esc(h.d.replace(/\s+\./g, '.').replace(/\s+/g, ' ')) + '</b>' + (h.exp ? '<span class="exp">' + esc(h.exp) + '</span>' : '') + '</li>';
        }).join('') +
        citas.map(function (s) { return '<li class="proximo"><time>' + esc(fCorta(s.fecha)) + (s.hora ? ' · ' + esc(s.hora) : '') + '</time><b>Citado: ' + esc(s.organo) + ', ' + esc(camaraCorta(s.camara)) + '</b><span class="exp">Según la ' + t('citacion', 'citación') + ' publicada.</span></li>'; }).join('') +
        '</ol>' +
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
    if (e) chips += '<span class="chip">' + esc(e.corto) + '</span>';
    if (p && p.camara_actual) chips += '<span class="chip">Ahora en ' + esc(p.camara_actual === 'Senado' ? 'el Senado' : 'la Cámara') + '</span>';
    if (proxima) chips += '<span class="chip">Citado el ' + esc(fCorta(proxima.fecha)) + '</span>';

    main.innerHTML =
      '<section class="envoltura ficha-encabezado" aria-labelledby="titulo">' +
      '<nav class="migas" aria-label="Ruta"><a href="' + BASE + 'index.html">Urgencias</a><span aria-hidden="true">/</span><span>Boletín ' + esc(b) + '</span></nav>' +
      '<div class="chips">' + chips + '</div>' +
      ((F && F.sintesis && p) ? '<p class="titulo-oficial"><b>Título oficial</b>' + esc(p.titulo) + '</p>' : '<p class="titulo-oficial"><b>Título oficial del proyecto</b></p>') +
      '<h1 id="titulo">' + esc(titulo) + '</h1>' +
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
      bloques.join('') + invitacion + fuentesHTML + '</div>' +
      '<a class="boton flotante oculto" href="' + urlAsesoria('solicitar') + '">Solicitar asesoría</a>';
    botonFlotante();
    if (location.hash) { var el = document.getElementById(location.hash.slice(1)); if (el) el.scrollIntoView(); }
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

  /* ---------- arranque ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    iniciarGlosario();
    document.querySelectorAll('[data-correo]').forEach(function (x) { x.textContent = CFG.correo || ''; });
    var pagina = document.body.getAttribute('data-pagina');
    if (['portada', 'ficha', 'agenda'].indexOf(pagina) === -1) return;
    Promise.all([cargar('data/urgencias.json'), cargarOpc('data/agenda.json'), cargarOpc('data/fichas/indice.json')]).then(function (r) {
      var U = r[0], A = r[1], IDX = r[2] || {};
      if (pagina === 'portada') { portada(U, A, IDX); loComun(); }
      else if (pagina === 'agenda') agenda(U, A, IDX);
      else ficha(U, A, IDX);
    }).catch(function () {
      var m = $('main');
      if (m) m.insertAdjacentHTML('afterbegin', '<div class="envoltura"><p class="aviso" style="margin-top:20px">No pudimos cargar los datos. Intente de nuevo en unos minutos.</p></div>');
    });
  });
})();
