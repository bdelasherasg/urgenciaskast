/* Urgencias Kast · lógica del sitio (JavaScript sin dependencias). */
(function () {
  'use strict';

  var CFG = window.UK_CONFIG || {};
  var BASE = document.documentElement.getAttribute('data-base') || '';
  var PLAZOS = { 'Discusión inmediata': 6, 'Suma': 15, 'Simple': 30 };
  var DIA = 24 * 60 * 60 * 1000;

  /* ---------- utilidades ---------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fecha(iso) {
    if (!iso) return null;
    var p = iso.split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function fCorta(iso) { var d = fecha(iso); return d ? d.getDate() + ' ' + MESES[d.getMonth()] + ' ' + d.getFullYear() : 'sin fecha'; }
  function fLarga(d) { return d.getDate() + ' de ' + MESES_LARGOS[d.getMonth()] + ' de ' + d.getFullYear(); }
  function hoy() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function diasHasta(iso) { var d = fecha(iso); return d ? Math.round((d - hoy()) / DIA) : null; }
  function diasDesde(iso) { var d = fecha(iso); return d ? Math.round((hoy() - d) / DIA) : null; }
  function claseChip(tipo) {
    if (tipo === 'Discusión inmediata') return 'chip chip-di';
    if (tipo === 'Suma') return 'chip chip-suma';
    return 'chip chip-simple';
  }
  function textoVence(p) {
    var v = p.urgencia_vigente && p.urgencia_vigente.vence;
    if (!v) return { txt: 'sin plazo informado', pronto: false };
    var n = diasHasta(v);
    if (n < 0) return { txt: 'plazo vencido el ' + fCorta(v), pronto: true };
    if (n === 0) return { txt: 'vence hoy', pronto: true };
    if (n === 1) return { txt: 'vence mañana', pronto: true };
    return { txt: 'vence en ' + n + ' días (' + fCorta(v) + ')', pronto: n <= 3 };
  }
  function barra(n) {
    var h = '<span class="renov-barra" aria-hidden="true">';
    for (var i = 0; i < Math.min(n, 20); i++) h += '<i></i>';
    return h + '</span>';
  }
  function cargar(ruta) {
    return fetch(BASE + ruta, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('No se pudo cargar ' + ruta);
      return r.json();
    });
  }
  function enNiveles(p) { return (CFG.niveles || []).indexOf(p.urgencia_actual) !== -1; }

  /* ---------- banner de aporte ---------- */
  function bannerAporte() {
    var clave = 'uk-aporte-cerrado';
    try {
      var cerrado = localStorage.getItem(clave);
      if (cerrado && Date.now() - Number(cerrado) < 7 * DIA) return;
    } catch (e) { /* almacenamiento no disponible */ }
    var url = CFG.donacionUrl || (BASE + 'metodo.html#aportar');
    var div = document.createElement('aside');
    div.className = 'aporte';
    div.setAttribute('aria-label', 'Aporte');
    div.innerHTML =
      '<div class="contenedor">' +
      '<p><strong>Urgencias Kast es gratuito e independiente.</strong> Hoy seguimos las urgencias de discusión inmediata y suma. ' +
      'Con tu aporte sumaremos las urgencias simples, las indicaciones del Ejecutivo y avisos por correo.</p>' +
      '<div class="aporte-acciones"><a class="boton boton-alerta" href="' + esc(url) + '">Aportar</a>' +
      '<button type="button" class="boton aporte-cerrar">Ahora no</button></div></div>';
    document.body.appendChild(div);
    div.querySelector('.aporte-cerrar').addEventListener('click', function () {
      div.hidden = true;
      try { localStorage.setItem(clave, String(Date.now())); } catch (e) { /* sin almacenamiento */ }
    });
  }

  function avisoMuestra(datos) {
    if (!datos.muestra) return;
    var a = document.createElement('div');
    a.className = 'aviso-muestra';
    a.textContent = 'Datos de muestra: el sitio mostrará datos reales tras la primera actualización automática.';
    document.body.insertBefore(a, document.body.firstChild);
  }

  /* ---------- portada ---------- */
  function portada(datos) {
    var todos = datos.proyectos || [];
    var ps = todos.filter(enNiveles);
    var di = ps.filter(function (p) { return p.urgencia_actual === 'Discusión inmediata'; }).length;
    var semana = ps.filter(function (p) {
      var n = p.urgencia_vigente && p.urgencia_vigente.vence ? diasHasta(p.urgencia_vigente.vence) : null;
      return n !== null && n >= 0 && n <= 7;
    }).length;
    var renov = ps.reduce(function (a, p) { return a + (p.renovaciones || 0); }, 0);
    var vencidos = ps.filter(function (p) {
      var n = p.urgencia_vigente && p.urgencia_vigente.vence ? diasHasta(p.urgencia_vigente.vence) : null;
      return n !== null && n < 0;
    }).length;

    $('#c-total').textContent = ps.length;
    $('#c-di').textContent = di;
    $('#c-renov').textContent = renov;
    $('#c-semana').textContent = semana;
    $('#c-vencidos').textContent = vencidos;
    if (datos.actualizado) {
      var d = new Date(datos.actualizado);
      $('#fecha-act').textContent = 'Actualizado el ' + fLarga(d) + ' a las ' +
        String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }

    // Reloj del próximo vencimiento
    var futuros = ps.filter(function (p) { return p.urgencia_vigente && p.urgencia_vigente.vence && diasHasta(p.urgencia_vigente.vence) >= 0; })
      .sort(function (a, b) { return a.urgencia_vigente.vence < b.urgencia_vigente.vence ? -1 : 1; });
    var reloj = $('#reloj');
    if (futuros.length && reloj) {
      var p0 = futuros[0];
      $('#reloj-proyecto').innerHTML = '<a href="proyecto.html?b=' + encodeURIComponent(p0.boletin) + '">' + esc(p0.titulo) + '</a>';
      var limite = fecha(p0.urgencia_vigente.vence); limite.setHours(23, 59, 59);
      var tic = function () {
        var ms = Math.max(0, limite - new Date());
        var d = Math.floor(ms / DIA), h = Math.floor(ms % DIA / 3600000), m = Math.floor(ms % 3600000 / 60000), s = Math.floor(ms % 60000 / 1000);
        $('#r-d').textContent = d; $('#r-h').textContent = String(h).padStart(2, '0');
        $('#r-m').textContent = String(m).padStart(2, '0'); $('#r-s').textContent = String(s).padStart(2, '0');
      };
      tic(); setInterval(tic, 1000);
    } else if (reloj) { reloj.hidden = true; }

    // Más renovada
    var top = ps.slice().sort(function (a, b) { return (b.renovaciones || 0) - (a.renovaciones || 0); })[0];
    if (top && $('#mas-renovada')) {
      $('#mas-renovada').innerHTML = 'La urgencia más renovada: <a href="proyecto.html?b=' + encodeURIComponent(top.boletin) + '">' +
        esc(top.titulo) + '</a>, renovada ' + (top.renovaciones || 0) + ' veces.';
    }

    // Filtros
    var selCamara = $('#f-camara'), selNivel = $('#f-nivel'), selOrden = $('#f-orden'), txt = $('#f-texto');
    function pintar() {
      var q = (txt.value || '').toLowerCase().trim();
      var lista = ps.filter(function (p) {
        if (selNivel.value && p.urgencia_actual !== selNivel.value) return false;
        if (selCamara.value && p.camara_actual !== selCamara.value) return false;
        if (q && (p.titulo + ' ' + p.boletin).toLowerCase().indexOf(q) === -1) return false;
        return true;
      });
      var orden = selOrden.value;
      lista.sort(function (a, b) {
        if (orden === 'renov') return (b.renovaciones || 0) - (a.renovaciones || 0);
        if (orden === 'dias') return (b.dias_tramite || 0) - (a.dias_tramite || 0);
        var va = a.urgencia_vigente && a.urgencia_vigente.vence || '9999', vb = b.urgencia_vigente && b.urgencia_vigente.vence || '9999';
        return va < vb ? -1 : 1;
      });
      var cuerpo = $('#tabla-cuerpo');
      if (!lista.length) { cuerpo.innerHTML = '<tr><td colspan="6" class="vacio">No hay proyectos con esos filtros.</td></tr>'; return; }
      cuerpo.innerHTML = lista.map(function (p) {
        var v = textoVence(p);
        return '<tr>' +
          '<td class="boletin">' + esc(p.boletin) + '</td>' +
          '<td><a class="titulo-proyecto" href="proyecto.html?b=' + encodeURIComponent(p.boletin) + '">' + esc(p.titulo) + '</a></td>' +
          '<td><span class="' + claseChip(p.urgencia_actual) + '">' + esc(p.urgencia_actual) + '</span><div class="vence' + (v.pronto ? ' pronto' : '') + '">' + esc(v.txt) + '</div></td>' +
          '<td>' + esc(p.etapa || '') + (p.camara_actual ? '<div class="vence">' + esc(p.camara_actual) + '</div>' : '') + '</td>' +
          '<td class="num"><span class="renov">' + barra(p.renovaciones || 0) + '<span>' + (p.renovaciones || 0) + '</span></span></td>' +
          '<td class="num">' + (p.dias_tramite != null ? p.dias_tramite : '') + '</td>' +
          '</tr>';
      }).join('');
    }
    [selCamara, selNivel, selOrden].forEach(function (s) { s.addEventListener('change', pintar); });
    txt.addEventListener('input', pintar);
    pintar();
  }

  /* ---------- ficha de proyecto ---------- */
  function ficha(datos) {
    var b = new URLSearchParams(location.search).get('b');
    var p = (datos.proyectos || []).filter(function (x) { return x.boletin === b; })[0];
    var main = $('#ficha');
    if (!p) {
      main.innerHTML = '<div class="contenedor"><p class="vacio">No encontramos el boletín ' + esc(b || '') + '. <a href="index.html">Volver a la portada</a>.</p></div>';
      return;
    }
    document.title = p.titulo + ' · Urgencias Kast';
    var v = textoVence(p);
    var urg = (p.urgencias || []).slice().reverse();
    var tram = (p.tramites || []).slice(-12).reverse();

    var html = '<div class="contenedor">' +
      '<nav class="migas" aria-label="Ruta"><a href="index.html">Urgencias</a><span aria-hidden="true">/</span><span class="boletin">Boletín ' + esc(p.boletin) + '</span></nav>' +
      '<div class="ficha-cabeza">' +
      '<div class="ficha-meta"><span class="' + claseChip(p.urgencia_actual) + '">' + esc(p.urgencia_actual) + '</span>' +
      '<span class="' + (v.pronto ? 'vence pronto' : '') + '">' + esc(v.txt) + '</span>' +
      '<span>· ' + esc(p.iniciativa || '') + ' · Ingresó el ' + fCorta(p.fecha_ingreso) + ' · ' + (p.dias_tramite != null ? p.dias_tramite + ' días en trámite' : '') + '</span></div>' +
      '<h1 class="ficha-titulo">' + esc(p.titulo) + '</h1></div>' +
      '<div id="lectura-frase"></div>' +
      '<div class="ficha-cuerpo"><div class="ficha-principal" id="ficha-principal">' +
      '<section aria-labelledby="h-urg"><div class="seccion-cabeza"><h2 id="h-urg">Historial de urgencias</h2>' +
      '<span class="nota">Renovada ' + (p.renovaciones || 0) + ' veces desde el ' + fCorta(urg.length ? urg[urg.length - 1].ingreso : null) + '</span></div>' +
      '<ol class="historial">' + urg.map(function (u) {
        return '<li><time datetime="' + esc(u.ingreso) + '">' + fCorta(u.ingreso) + '</time><span><span class="' + claseChip(u.tipo) + '">' + esc(u.tipo) + '</span> ' +
          (u.retiro ? 'retirada el ' + fCorta(u.retiro) : '<b>vigente</b>') + (u.camara ? ' · ' + esc(u.camara) : '') + '</span></li>';
      }).join('') + '</ol></section>' +
      '<div id="lectura-cuerpo"></div>' +
      '<section aria-labelledby="h-tram"><div class="seccion-cabeza"><h2 id="h-tram">Últimos trámites</h2><span class="nota">Fuente: Senado</span></div>' +
      '<ol class="historial">' + tram.map(function (t) {
        return '<li><time datetime="' + esc(t.fecha) + '">' + fCorta(t.fecha) + '</time><span>' + esc(t.descripcion) +
          '<span class="vence">' + esc([t.etapa, t.camara].filter(Boolean).join(' · ')) + '</span></span></li>';
      }).join('') + '</ol></section>' +
      '</div>' +
      '<aside class="ficha-lateral">' +
      '<section class="caja-lateral" aria-labelledby="h-datos"><h2 id="h-datos" class="etiqueta-lateral">Datos clave</h2><dl class="datos">' +
      '<dt>Boletín</dt><dd class="boletin">' + esc(p.boletin) + '</dd>' +
      '<dt>Iniciativa</dt><dd>' + esc(p.iniciativa || '') + '</dd>' +
      '<dt>Cámara de origen</dt><dd>' + esc(p.camara_origen || '') + '</dd>' +
      '<dt>Etapa</dt><dd>' + esc(p.etapa || '') + '</dd>' +
      (p.subetapa ? '<dt>Subetapa</dt><dd>' + esc(p.subetapa) + '</dd>' : '') +
      '<dt>Urgencias puestas</dt><dd>' + (p.urgencias || []).length + '</dd>' +
      '</dl></section>' +
      '<section class="caja-lateral" aria-labelledby="h-fuentes"><h2 id="h-fuentes" class="etiqueta-lateral">Fuentes oficiales</h2><ul class="lista-enlaces">' +
      (p.enlaces && p.enlaces.senado ? '<li><a href="' + esc(p.enlaces.senado) + '" rel="noopener">Tramitación en el Senado</a></li>' : '') +
      (p.enlaces && p.enlaces.camara ? '<li><a href="' + esc(p.enlaces.camara) + '" rel="noopener">Tramitación en la Cámara</a></li>' : '') +
      (p.enlaces && p.enlaces.mensaje ? '<li><a href="' + esc(p.enlaces.mensaje) + '" rel="noopener">Texto del mensaje</a></li>' : '') +
      '<li><a href="https://www.bcn.cl/asesoriasparlamentarias" rel="noopener">Asesoría Técnica Parlamentaria, BCN</a></li>' +
      '</ul><p class="fuente" style="margin-top:14px">Datos actualizados automáticamente. <a href="mailto:' + esc(CFG.correo || '') + '?subject=Error%20en%20' + encodeURIComponent(p.boletin) + '">Reportar un error</a>.</p></section>' +
      '</aside></div></div>';
    main.innerHTML = html;

    cargar('data/lecturas/' + p.boletin + '.json').then(lectura).catch(function () {
      $('#lectura-cuerpo').innerHTML = '<section><h2>Lectura política</h2><p class="en-preparacion" style="margin-top:16px">La lectura política de este proyecto ' +
        '(correlación de fuerzas, posiciones declaradas, quién gana y quién pierde) está en preparación. Ruta Crece la publica con fuentes y con las proyecciones identificadas como tales.</p></section>';
    });
  }

  function lectura(L) {
    if (L.frase) {
      $('#lectura-frase').innerHTML = '<section class="lectura-frase" aria-labelledby="h-frase"><div><h2 id="h-frase" class="reloj-etiqueta">Lectura política en una frase</h2><p>' + esc(L.frase) + '</p></div>' +
        (L.votos ? '<div class="lectura-cifras">' +
          '<div><strong>' + esc(L.votos.necesarios) + '</strong><span>votos necesarios</span></div>' +
          '<div><strong>' + esc(L.votos.a_favor) + '</strong><span>a favor, estimados</span></div>' +
          '<div><strong>' + esc(L.votos.indecisos) + '</strong><span>indecisos</span></div>' +
          '<div><strong style="color:#F2C48D">' + esc(L.riesgo || '') + '</strong><span>riesgo de tramitación</span></div></div>' : '') +
        '</section>';
    }
    var h = '';
    if (L.votos) {
      var t = L.votos.total || (L.votos.a_favor + L.votos.indecisos + L.votos.en_contra);
      var pos = (L.votos.necesarios / t * 100).toFixed(1);
      h += '<section aria-labelledby="h-fuerzas"><div class="seccion-cabeza"><h2 id="h-fuerzas">Correlación de fuerzas</h2><span class="nota">' + esc(L.votos.camara || '') + '</span></div>' +
        (L.votos.nota ? '<p style="margin:0 0 16px;color:#36414D">' + esc(L.votos.nota) + '</p>' : '') +
        '<div class="barra-votos" role="img" aria-label="' + L.votos.a_favor + ' a favor, ' + L.votos.indecisos + ' indecisos, ' + L.votos.en_contra + ' en contra">' +
        '<span style="flex:' + L.votos.a_favor + ' 1 0;background:#1D5E55"></span><span style="flex:' + L.votos.indecisos + ' 1 0;background:#C2CAD1"></span>' +
        '<span style="flex:' + L.votos.en_contra + ' 1 0;background:#9A5B0B"></span><span class="linea-mayoria" style="left:' + pos + '%"></span></div>' +
        '<div class="leyenda-votos"><span><b style="color:#1D5E55">' + L.votos.a_favor + '</b> a favor</span><span><b>' + L.votos.indecisos + '</b> indecisos</span>' +
        '<span class="nota">Se necesitan ' + L.votos.necesarios + ' de ' + t + '</span><span><b style="color:#9A5B0B">' + L.votos.en_contra + '</b> en contra</span></div>';
      if (L.bancadas && L.bancadas.length) {
        h += '<div class="tabla-caja" style="margin-top:28px"><table style="min-width:640px"><thead><tr><th>Bancada</th><th class="num">Escaños</th><th>Posición</th><th>Base de la estimación</th></tr></thead><tbody>' +
          L.bancadas.map(function (x) {
            var c = x.posicion === 'A favor' ? 'chip chip-suma' : (x.posicion === 'En contra' ? 'chip chip-di' : 'chip chip-simple');
            return '<tr><td><b>' + esc(x.nombre) + '</b></td><td class="num">' + esc(x.escanos) + '</td><td><span class="' + c + '">' + esc(x.posicion) + '</span></td><td>' + esc(x.base) + '</td></tr>';
          }).join('') + '</tbody></table></div>';
      }
      h += '</section>';
    }
    if (L.actores && L.actores.length) {
      h += '<section aria-labelledby="h-act"><div class="seccion-cabeza"><h2 id="h-act">Quién se ha pronunciado</h2></div><div class="tabla-caja"><table style="min-width:600px"><tbody>' +
        L.actores.map(function (a) {
          return '<tr><td><b>' + esc(a.actor) + '</b><div class="vence">' + esc(a.posicion) + '</div></td><td>' + esc(a.argumento) + '<div class="fuente">' + esc(a.fuente) + '</div></td></tr>';
        }).join('') + '</tbody></table></div></section>';
    }
    if ((L.ganan && L.ganan.length) || (L.pierden && L.pierden.length)) {
      var item = function (x) { return '<p>' + esc(x.texto) + ' <span class="fuente">' + esc(x.fuente || '') + '</span></p>'; };
      h += '<section aria-labelledby="h-gp"><div class="seccion-cabeza"><h2 id="h-gp">Quién gana, quién pierde</h2><span class="nota">Lectura de consecuencias de Ruta Crece</span></div>' +
        '<div class="dos-col"><div class="gana"><h3>Ganan</h3>' + (L.ganan || []).map(item).join('') + '</div>' +
        '<div class="pierde"><h3>Pierden o asumen costos</h3>' + (L.pierden || []).map(item).join('') + '</div></div></section>';
    }
    if (L.riesgos && L.riesgos.length) {
      h += '<section aria-labelledby="h-r"><div class="seccion-cabeza"><h2 id="h-r">Riesgos y antecedentes</h2></div><ol class="historial">' +
        L.riesgos.map(function (r) { return '<li><b>' + esc(r.titulo) + '</b><span>' + esc(r.texto) + '</span></li>'; }).join('') + '</ol></section>';
    }
    if (L.autor || L.actualizado) {
      h += '<p class="nota">Lectura elaborada por ' + esc(L.autor || 'Ruta Crece') + (L.actualizado ? ', actualizada el ' + fCorta(L.actualizado) : '') + '. Las proyecciones se identifican como tales.</p>';
    }
    $('#lectura-cuerpo').innerHTML = h;
  }

  /* ---------- arranque ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    bannerAporte();
    var pagina = document.body.getAttribute('data-pagina');
    if (pagina === 'portada' || pagina === 'ficha') {
      cargar('data/urgencias.json').then(function (datos) {
        avisoMuestra(datos);
        if (pagina === 'portada') portada(datos); else ficha(datos);
      }).catch(function () {
        var t = $('#tabla-cuerpo') || $('#ficha');
        if (t) t.innerHTML = '<p class="vacio">No pudimos cargar los datos. Intenta de nuevo en unos minutos.</p>';
      });
    }
  });
})();
