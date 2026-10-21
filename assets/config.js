/* Configuración del sitio. Este es el único archivo que hay que editar para cambiar
   el enlace de aportes, el correo de contacto o los niveles de urgencia que se muestran. */
window.UK_CONFIG = {
  nombre: 'Urgencias Kast',

  // Enlace de la plataforma de aportes (Reveniu, Flow, Mercado Pago, Buy Me a Coffee, etc.).
  // Mientras esté vacío, el botón "Aportar" lleva a la sección de aportes de la página Método.
  donacionUrl: '',

  // Correo de contacto y de reporte de errores.
  correo: 'contacto@ejemplo.cl',

  // Niveles de urgencia que el sitio muestra hoy. Para sumar las urgencias simples,
  // agregar 'Simple' a esta lista y también a NIVELES en scripts/actualizar.py.
  niveles: ['Discusión inmediata', 'Suma'],

  // Fecha de inicio del gobierno, para contar solo las urgencias de esta administración.
  inicioGobierno: '2026-03-11'
};
