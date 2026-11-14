/* Configuración del sitio. Es el único archivo que hay que editar para cambiar
   el correo de contacto o el enlace de aportes. */
window.UK_CONFIG = {
  nombre: 'Urgencias Kast',

  // Correo para asesorías, posiciones de organizaciones y correcciones.
  correo: 'contacto@locomun.cl',

  // Enlace de la plataforma de aportes (Mercado Pago, PayPal u otra). Mientras esté vacío,
  // la página Aportar indica escribir al correo.
  donacionUrl: '',

  // Dirección que recibe los pedidos de análisis ampliado hechos desde las fichas (panel de Lo Común).
  // Si queda vacía, las fichas no muestran la oferta del análisis ampliado.
  pedidosUrl: 'https://urgenciaskast-revision.pages.dev/publico/ampliado',

  // Dirección que recibe los formularios de contacto (panel de Lo Común). Si queda vacía, las páginas
  // muestran solo el correo.
  contactoUrl: 'https://urgenciaskast-revision.pages.dev/publico/contacto',

  // Sitio de Lo Común.
  locomunUrl: 'https://locomun.cl',

  // Fecha de inicio del gobierno, para contar solo las urgencias de esta administración.
  inicioGobierno: '2026-03-11'
};
