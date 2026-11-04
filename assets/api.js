/* Comunicación con la API de Google Apps Script */
(function () {
  const cfg = window.FP_CONFIG || {};
  window.fpApi = async function (accion, datos) {
    if (!cfg.API_URL || cfg.API_URL.indexOf("PEGA_AQUI") === 0) {
      throw new Error("Falta configurar la URL de la API en assets/config.js.");
    }
    // text/plain evita la verificación CORS previa que Apps Script no admite
    const res = await fetch(cfg.API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(Object.assign({ accion: accion }, datos || {}))
    });
    if (!res.ok) throw new Error("El servidor no respondió (" + res.status + ").");
    const j = await res.json();
    if (!j.ok) throw new Error(j.error || "Error del servidor.");
    return j.data;
  };
  window.fpEsc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  window.fpFecha = iso => { if (!iso) return "—"; const p = String(iso).slice(0, 10).split("-"); return p[2] + "/" + p[1] + "/" + p[0]; };
  window.fpNota = n => Number.isInteger(Number(n)) ? String(Number(n)) : Number(n).toFixed(1);
})();

/* Estados de homologación (compartido por la página de la empresa y el panel) */
window.fpEstadoHom = function (e) {
  return ({
    "Registrada": ["st-registrada", "Sin enviar"],
    "En revisión": ["st-revision", "En revisión"],
    "Aprobado": ["st-aprobado", "Aprobado"],
    "Aprobado con observaciones": ["st-obs", "Aprobado con observaciones"],
    "No aprobado": ["st-no", "No aprobado"],
    "Vencido": ["st-vencido", "Vencido"]
  })[e] || ["st-registrada", e || "—"];
};
/* Lee un archivo como base64 (sin el prefijo data:) */
window.fpBase64 = f => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = ko; r.readAsDataURL(f); });
/* Abre un archivo devuelto por la API en una pestaña nueva (o lo descarga) */
window.fpAbrirArchivo = function (ventana, a) {
  const bin = atob(a.base64), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([u8], { type: a.tipo }));
  if (ventana && !ventana.closed) ventana.location.href = url;
  else { const l = document.createElement("a"); l.href = url; l.download = a.nombre; document.body.appendChild(l); l.click(); l.remove(); }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};
