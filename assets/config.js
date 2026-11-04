/* =========================================================
   CONFIGURACIÓN — edita solo este archivo
   ========================================================= */
window.FP_CONFIG = {
  NOMBRE_PLATAFORMA: "Friotrack",
  // Pega aquí la URL de tu Apps Script (termina en /exec)
  API_URL: "PEGA_AQUI_LA_URL_DE_APPS_SCRIPT",

  // Cada cuántos segundos se actualiza el panel de seguimiento
  ACTUALIZAR_CADA_SEGUNDOS: 30,

  // Sello del certificado: "medalla", "escudo", "roseta", "imagen" (sello SST, selloImagen),
  // "octagono" (Cero Accidentes dibujado) o "circular" (sello de tinta)
  SELLO: "medalla",

  // Empresas del grupo. El nombre debe ser igual al de la hoja Configuración.
  //  - logoWeb: logo a color sobre fondo blanco (se ve en la página)
  //  - logoCertificado: logo blanco sobre el color del panel (colorPanel), en JPG (va en el PDF)
  //  - colorPanel / colorAcento: colores de la marca en el certificado
  //  - plantilla: diseño del certificado en JPG (si se deja "", se usa el diseño automático)
  //  Si una empresa aún no tiene logo, deja "" y se mostrará su nombre en texto.
  EMPRESAS: [
    { nombre: "Friopacking", enlace: "friopacking", logoWeb: "assets/logo.png", logoCertificado: "assets/logo-certificado.jpg",
      colorPanel: "#102267", colorAcento: "#39C1AD", selloImagen: "assets/sello-sst.jpg", icono: "assets/icono-friopacking.jpg",
      plantilla: "assets/certificado-friopacking.jpg" },
    { nombre: "Frioteam", enlace: "frioteam", logoWeb: "assets/logo-frioteam.png", logoCertificado: "assets/logo-frioteam-certificado.jpg",
      colorPanel: "#0A0A1E", colorAcento: "#3AABEF", selloImagen: "assets/sello-sst.jpg", icono: "assets/icono-frioteam.jpg",
      plantilla: "assets/certificado-frioteam.jpg" }
  ]
};

/* Convierte las rutas de archivos en direcciones completas (no editar) */
(function () {
  const base = new URL("../", document.currentScript.src);
  window.FP_RAIZ = base.href;
  (window.FP_CONFIG.EMPRESAS || []).forEach(e => ["logoWeb", "logoCertificado", "selloImagen", "icono", "plantilla"].forEach(k => { if (e[k]) e[k] = new URL(e[k], base).href; }));
})();
