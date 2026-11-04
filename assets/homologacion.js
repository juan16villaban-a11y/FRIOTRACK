/* Homologación: vista de la empresa contratista */
(function () {
  const $ = s => document.querySelector(s);
  const esc = window.fpEsc, fmt = window.fpFecha, api = window.fpApi;
  const GRUPO = ((window.FP_CONFIG || {}).EMPRESAS || []).map(e => e.nombre);
  const TIPOS = ["application/pdf", "image/jpeg", "image/png", "application/msword", "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
  const EXT = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", doc: "application/msword", xls: "application/vnd.ms-excel",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (_) { return null; } };

  let ruc = "", token = ls("fp-hom-token") || "", datos = null, abiertas = new Set(), subiendo = 0;

  function vista(v) {
    ["ingreso", "registro", "codigo", "exp"].forEach(n => $("#v-" + n).hidden = n !== v);
    $("#top-user").hidden = v !== "exp";
  }
  function err(sel, m) { const e = $(sel); e.textContent = m || ""; e.hidden = !m; }
  function cargando(btn, txt) { btn.dataset.t = btn.dataset.t || btn.innerHTML; btn.disabled = !!txt; btn.innerHTML = txt ? `<span class="spin"></span> ${txt}` : btn.dataset.t; }
  let tt = null;
  function toast(m) { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => t.hidden = true, 5000); }

  /* ---------- Ingreso ---------- */
  $("#f-ruc").addEventListener("submit", async e => {
    e.preventDefault();
    ruc = $("#ruc").value.replace(/\D/g, "");
    if (!/^(10|15|17|20)\d{9}$/.test(ruc)) return err("#ruc-err", "El RUC debe tener 11 dígitos y empezar con 10, 15, 17 o 20.");
    err("#ruc-err"); const b = $("#ruc-go"); cargando(b, "Verificando…");
    try {
      const r = await api("h_codigo", { ruc });
      if (r.nuevo) { $("#r-ruc").value = ruc; pintarSedes(r.sedes || []); vista("registro"); $("#r-razon").focus(); }
      else { $("#cod-msg").innerHTML = `Enviamos un código de 6 dígitos a <b>${esc(r.correo)}</b>. Revisa también la carpeta de spam.`; vista("codigo"); $("#cod").value = ""; $("#cod").focus(); }
    } catch (x) { err("#ruc-err", x.message); }
    cargando(b);
  });

  $("#r-grupo").innerHTML = GRUPO.map(g => `<label><input type="checkbox" value="${esc(g)}"> ${esc(g)}</label>`).join("");
  function pintarSedes(sedes) {
    $("#r-sedes").innerHTML = sedes.map(x => `<label><input type="checkbox" value="${esc(x)}"> ${esc(x)}</label>`).join("");
    $("#r-sedes").querySelectorAll("input").forEach(i => i.onchange = respOpciones);
    respOpciones();
  }
  function respOpciones() {
    const marcadas = [...document.querySelectorAll("#r-sedes input:checked")].map(i => i.value), sel = $("#r-resp"), cur = sel.value;
    sel.innerHTML = marcadas.map(x => `<option ${x === cur ? "selected" : ""}>${esc(x)}</option>`).join("");
    $("#r-resp-f").hidden = marcadas.length < 2;
  }
  $("#reg-back").onclick = () => vista("ingreso");
  $("#f-reg").addEventListener("submit", async e => {
    e.preventDefault();
    const v = id => $(id).value.trim();
    const d = { ruc, razon: v("#r-razon"), actividad: v("#r-actividad"), trabajadores: v("#r-trab"), representante: v("#r-rep"), cargo: v("#r-cargo"),
      correo: v("#r-correo"), telefono: v("#r-tel"), grupo: [...document.querySelectorAll("#r-grupo input:checked")].map(i => i.value),
      sedes: [...document.querySelectorAll("#r-sedes input:checked")].map(i => i.value), sedeResponsable: $("#r-resp").value };
    const m = [];
    if (d.razon.length < 3) m.push("Escribe la razón social.");
    if (!d.actividad) m.push("Indica la actividad o servicio.");
    if (!/^\d+$/.test(d.trabajadores)) m.push("Indica cuántos trabajadores tienes en planilla.");
    if (d.representante.length < 5) m.push("Escribe el nombre del representante.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.correo)) m.push("Escribe un correo válido.");
    if (!d.grupo.length) m.push("Elige al menos una empresa del grupo.");
    if (!d.sedes.length) m.push("Elige al menos una sede donde trabajarás.");
    if (m.length) { const b = $("#reg-err"); b.innerHTML = m.map(esc).join("<br>"); b.hidden = false; return; }
    err("#reg-err"); const b = $("#reg-go"); cargando(b, "Registrando…");
    try {
      const r = await api("h_registrar", { empresa: d });
      $("#cod-msg").innerHTML = `Empresa registrada. Enviamos un código de 6 dígitos a <b>${esc(r.correo)}</b>.`;
      vista("codigo"); $("#cod").focus();
    } catch (x) { err("#reg-err", x.message); }
    cargando(b);
  });

  $("#cod-back").onclick = () => vista("ingreso");
  $("#cod-re").onclick = async () => { try { const r = await api("h_codigo", { ruc }); toast("Código reenviado a " + r.correo); } catch (x) { err("#cod-err", x.message); } };
  $("#f-cod").addEventListener("submit", async e => {
    e.preventDefault();
    const c = $("#cod").value.replace(/\D/g, "");
    if (c.length !== 6) return err("#cod-err", "El código tiene 6 dígitos.");
    err("#cod-err"); const b = $("#cod-go"); cargando(b, "Ingresando…");
    try { const r = await api("h_validar", { ruc, codigo: c }); token = r.token; ls("fp-hom-token", token); await cargar(); }
    catch (x) { err("#cod-err", x.message); }
    cargando(b);
  });
  $("#salir").onclick = () => { token = ""; ls("fp-hom-token", null); datos = null; $("#ruc").value = ""; vista("ingreso"); };

  /* ---------- Expediente ---------- */
  async function cargar() {
    try { datos = await api("h_estado", { token }); pintar(); vista("exp"); }
    catch (x) { token = ""; ls("fp-hom-token", null); vista("ingreso"); if (!/Sesión/.test(x.message)) err("#ruc-err", x.message); }
  }
  const editable = () => !!datos.empresa.editable;
  const dias = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);
  const cuando = d => d < 0 ? `venció hace ${-d} día${d === -1 ? "" : "s"}` : d === 0 ? "vence hoy" : `faltan ${d} día${d === 1 ? "" : "s"}`;
  const tono = d => d < 0 ? "bad" : d <= 30 ? "warn" : "ok";
  const MENSAJE = {
    "Registrada": "Sube los documentos de cada ítem. Cuando termines, pulsa <b>Enviar a revisión</b>.",
    "En revisión": "El área SSOMA está revisando tus documentos. Te avisaremos por correo cuando termine.",
    "Aprobado": "Tu empresa está homologada. Puede trabajar sin restricciones.",
    "Aprobado con observaciones": "Puede trabajar, pero debe levantar las observaciones en un plazo de 3 días. Corrige los ítems marcados en rojo y vuelve a enviar.",
    "No aprobado": "No puede iniciar ni continuar actividades hasta regularizar. Corrige los ítems marcados en rojo y vuelve a enviar.",
    "Vencido": "Tu homologación venció. Actualiza los documentos y vuelve a enviarla a revisión."
  };
  function pintar() {
    const e = datos.empresa, est = window.fpEstadoHom(e.estadoActual), reqs = datos.requisitos;
    $("#top-razon").textContent = e.razon;
    const msj = e.renovable && e.estadoActual !== "Aprobado con observaciones"
      ? `Tu homologación vence el <b>${fmt(e.vence)}</b>. Ya puedes subir los documentos actualizados y enviarla a renovación; tu personal sigue habilitado mientras SSOMA la revisa.`
      : e.estadoActual === "En revisión" && e.vence && e.vence >= datos.hoy ? MENSAJE["En revisión"] + " Tu homologación anterior sigue vigente mientras tanto."
      : MENSAJE[e.estadoActual] || "";
    const conArch = new Set(datos.archivos.map(a => a.item));
    const n = reqs.filter(q => conArch.has(q.item)).length, pct = reqs.length ? Math.round(n / reqs.length * 100) : 0;
    const evaluada = e.puntaje !== null && e.puntaje !== undefined && ["Aprobado", "Aprobado con observaciones", "No aprobado", "Vencido"].indexOf(e.estadoActual) >= 0;
    $("#resumen").innerHTML = `
      <div class="sum"><div style="display:flex;flex-direction:column;gap:8px;min-width:0">
        <span class="st ${est[0]}">${esc(est[1])}</span>
        <h2>${esc(e.razon)}</h2>
        <div class="meta"><span>RUC ${esc(e.ruc)}</span><span>${esc(e.actividad || "")}</span><span>Servicio a: ${esc(e.grupo)}</span><span>Sedes: ${e.sedes.map(esc).join(", ")}</span><span>Coordina: sede ${esc(e.sedeResponsable)}</span>${e.clientes.length ? `<span>Clientes: ${e.clientes.map(esc).join(", ")}</span>` : ""}</div></div>
        ${evaluada ? `<div class="score"><b>${window.fpNota(e.puntaje)}%</b><span>Evaluado el ${fmt(e.evaluacion)}</span>${e.vence ? `<span>Vigente hasta ${fmt(e.vence)}</span>` : ""}</div>` : ""}</div>
      ${e.vence && e.estadoActual !== "No aprobado" ? `<div class="vence-box v-${tono(dias(datos.hoy, e.vence))}"><div><span class="hint">Tu homologación vence</span><b>${fmt(e.vence)}</b></div><div><span class="hint">Motivo</span><span>${esc(e.venceMotivo || "Vigencia máxima")}</span></div><span class="vd">${cuando(dias(datos.hoy, e.vence))}</span></div>` : ""}
      <div class="notice ${e.renovable ? "warn" : e.estadoActual === "Aprobado" ? "ok" : /obs|Vencido|No/.test(e.estadoActual) ? "warn" : ""}"><span>${msj}</span></div>
      ${Object.keys(datos.clientesEstado || {}).length ? `<div class="cli-row">${Object.entries(datos.clientesEstado).map(([c, x]) => `<span class="cli"><span>Requisitos de ${esc(c)}</span><span class="st ${x.estado === "Cumple" ? "st-aprobado" : x.estado === "No cumple" ? "st-no" : "st-registrada"}">${esc(x.estado)}</span></span>`).join("")}</div>` : ""}
      <div class="prog"><div class="lbl"><span>Documentos cargados</span><span>${n} de ${reqs.length} ítems</span></div><div class="bar"><i style="width:${pct}%"></i></div></div>
      <p class="hint">Formatos: PDF, JPG, PNG, Word o Excel · Máximo ${datos.maxMb} MB por archivo. Si un ítem no aplica a tu empresa, déjalo vacío y SSOMA lo marcará como N/A.</p>`;
    // Secciones
    const secs = [];
    reqs.forEach(q => { let s = secs.find(x => x.nombre === q.seccion); if (!s) secs.push(s = { nombre: q.seccion, peso: q.peso, cliente: q.cliente, items: [] }); s.items.push(q); });
    if (!abiertas.size) secs.forEach(s => abiertas.add(s.nombre));
    $("#secciones").innerHTML = secs.map(s => {
      const c = s.items.filter(q => conArch.has(q.item)).length;
      return `<section class="sec ${s.cliente ? "sec-cli" : ""} ${abiertas.has(s.nombre) ? "" : "closed"}" data-s="${esc(s.nombre)}">
        <button class="sec-h" type="button" aria-expanded="${abiertas.has(s.nombre)}"><h3>${esc(s.nombre)} <span class="n">${s.cliente ? "(requisito adicional)" : "(" + s.peso + "%)"}</span></h3><span class="n">${c} de ${s.items.length} con documento <span class="chev">▾</span></span></button>
        <ul class="items">${s.items.map(itemHTML).join("")}</ul></section>`;
    }).join("");
    $("#secciones").querySelectorAll(".sec-h").forEach(h => h.onclick = () => {
      const s = h.parentElement, k = s.dataset.s; s.classList.toggle("closed");
      if (s.classList.contains("closed")) abiertas.delete(k); else abiertas.add(k);
      h.setAttribute("aria-expanded", !s.classList.contains("closed"));
    });
    $("#secciones").querySelectorAll("input[type=file]").forEach(i => i.onchange = () => subir(i));
    $("#secciones").querySelectorAll("[data-ver]").forEach(b => b.onclick = () => ver(b.dataset.ver));
    $("#secciones").querySelectorAll("[data-del]").forEach(b => b.onclick = () => borrar(b));
    pintarVencimientos(); pintarPersonal();
    // Barra de envío
    const sb = $("#send-bar");
    sb.hidden = !editable();
    if (editable()) {
      const reenvio = e.estadoActual !== "Registrada";
      if (e.renovable) { $("#send-t").textContent = "¿Actualizaste tus documentos?"; $("#send-h").textContent = "Envía la renovación para que SSOMA la evalúe antes del " + fmt(e.vence) + "."; $("#enviar").textContent = "Enviar a renovación"; $("#enviar").disabled = !n; return; }
      $("#send-t").textContent = reenvio ? "¿Ya corregiste las observaciones?" : `Tienes documentos en ${n} de ${reqs.length} ítems`;
      $("#send-h").textContent = reenvio ? "Envía de nuevo tu homologación para que SSOMA la vuelva a evaluar." : "Cuando termines de subir tus documentos, envíalos para que SSOMA los revise.";
      $("#enviar").textContent = reenvio ? "Volver a enviar a revisión" : "Enviar a revisión";
      $("#enviar").disabled = !n;
    }
  }
  function itemHTML(q) {
    const ev = datos.evaluacion[q.item], arch = datos.archivos.filter(a => a.item === q.item);
    const res = ev && ev.resultado, ed = editable() && !(res === "Cumple" && !datos.empresa.desbloqueado);
    const chip = res === "Cumple" ? ["c-ok", "Cumple"] : res === "No cumple" ? ["c-no", "No cumple"] : res === "N/A" ? ["c-na", "No aplica"] : arch.length ? ["c-up", "Cargado"] : ["c-none", "Sin documento"];
    const venceInp = q.vence ? `<label class="vence">Vence <input class="inp" type="date" data-vence="${esc(q.item)}"></label>` : "";
    return `<li class="it" id="it-${esc(q.item)}"><span class="no">${esc(q.item)}</span>
      <div class="body"><span class="rq">${esc(q.requisito)}</span><span class="doc">Documento: ${esc(q.documento)}${q.vence ? " · <b>indica su fecha de vencimiento</b>" : ""}</span>
        ${res === "No cumple" && ev.obs ? `<div class="obs"><b>Observación SSOMA:</b> ${esc(ev.obs)}</div>` : res && ev.obs ? `<div class="hint">SSOMA: ${esc(ev.obs)}</div>` : ""}
        ${arch.length ? `<ul class="files">${arch.map(a => `<li><span class="fn" title="${esc(a.nombre)}">${esc(a.nombre)}</span><span class="fm">${Math.max(1, Math.round(a.kb))} KB${a.vence ? ` · <b class="t-${tono(dias(datos.hoy, a.vence))}">vence ${fmt(a.vence)}</b>` : ""}</span><button type="button" data-ver="${esc(a.id)}">Ver</button>${ed ? `<button type="button" class="del" data-del="${esc(a.id)}">Eliminar</button>` : ""}</li>`).join("")}</ul>` : ""}
        ${ed ? `<div class="up"><label class="btn btn-ghost btn-sm">Subir archivo<input type="file" hidden multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" data-item="${esc(q.item)}"></label>${venceInp}<span class="upmsg" data-msg="${esc(q.item)}"></span></div>` : ""}
      </div><span class="it-st"><span class="chipst ${chip[0]}">${chip[1]}</span></span></li>`;
  }
  /* Fechas de vencimiento de los documentos que lo requieren */
  function pintarVencimientos() {
    const items = datos.requisitos.filter(q => q.vence);
    const filas = items.map(q => {
      const f = datos.archivos.filter(a => a.item === q.item && a.vence).map(a => a.vence).sort().pop() || "";
      return { q, f, d: f ? dias(datos.hoy, f) : null };
    }).sort((a, b) => (a.f || "9") .localeCompare(b.f || "9"));
    $("#venc-card").hidden = !items.length;
    $("#vencimientos").innerHTML = `<div class="pane-head"><h2 style="font-size:24px;color:var(--navy)">Vencimiento de documentos</h2>
      <p class="hint">Tu homologación vence cuando vence el primero de estos documentos (o al cumplir su vigencia máxima). Te avisaremos por correo 30, 15, 7 y 1 día antes.</p></div>
      <ul class="vlista">${filas.map(x => `<li><span class="no">${esc(x.q.item)}</span><span class="vn">${esc(x.q.requisito)}</span>
        ${x.f ? `<span class="vf">${fmt(x.f)}</span><span class="vd t-${tono(x.d)}">${cuando(x.d)}</span>` : `<span class="vf">—</span><span class="vd">Sin documento</span>`}</li>`).join("")}</ul>`;
  }
  /* Personal de la empresa y su habilitación */
  function pintarPersonal() {
    const T = datos.trabajadores || [];
    $("#pers-card").hidden = false;
    $("#personal").innerHTML = `<div class="pane-head"><h2 style="font-size:24px;color:var(--navy)">Tu personal</h2>
      <p class="hint">Trabajadores que rindieron la inducción con el RUC de tu empresa. Para estar <b>habilitado</b> necesitan la inducción vigente y tu homologación aprobada y vigente.</p></div>
      ${T.length ? `<ul class="plista">${T.map(t => `<li><div><b>${esc(t.nombre)}</b><span class="hint">${esc(t.dni)} · ${esc(t.cargo)}${t.sede ? " · Sede " + esc(t.sede) : ""}</span></div>
        <div class="pst">${t.habilitado ? `<span class="chipst c-ok">Habilitado</span><span class="hint">hasta ${fmt(t.hasta)}</span>` : `<span class="chipst c-no">No habilitado</span><span class="hint">${t.motivos.map(esc).join(" · ")}</span>`}</div></li>`).join("")}</ul>`
        : `<p class="hint">Aún nadie ha rendido la inducción con tu RUC. Comparte con tu personal el enlace de la inducción e indícales que usen el RUC ${esc(datos.empresa.ruc)}.</p>`}`;
  }
  async function subir(inp) {
    const item = inp.dataset.item, files = [...inp.files], msg = document.querySelector(`[data-msg="${CSS.escape(item)}"]`);
    inp.value = "";
    const q = datos.requisitos.find(x => x.item === item), vInp = document.querySelector(`[data-vence="${CSS.escape(item)}"]`);
    const vence = vInp ? vInp.value : "";
    if (q.vence && !vence) { msg.textContent = "Indica la fecha de vencimiento del documento antes de subirlo."; vInp.focus(); return; }
    for (const f of files) {
      const ext = (f.name.split(".").pop() || "").toLowerCase(), tipo = TIPOS.indexOf(f.type) >= 0 ? f.type : EXT[ext];
      if (!tipo) { msg.textContent = `${f.name}: formato no permitido.`; continue; }
      if (f.size > datos.maxMb * 1048576) { msg.textContent = `${f.name} pesa ${(f.size / 1048576).toFixed(1)} MB; el máximo es ${datos.maxMb} MB.`; continue; }
      subiendo++; msg.innerHTML = `<span class="spin" style="width:14px;height:14px;display:inline-block;vertical-align:middle"></span> Subiendo ${esc(f.name)}…`;
      try { datos = await api("h_subir", { token, item, nombre: f.name, tipo, base64: await window.fpBase64(f), vence }); toast("Documento subido: " + f.name); }
      catch (x) { subiendo--; msg.textContent = x.message; return; }
      subiendo--;
    }
    pintar();
  }
  async function ver(id) {
    const w = window.open("", "_blank");
    if (w) w.document.write("<p style='font-family:sans-serif'>Abriendo documento…</p>");
    try { window.fpAbrirArchivo(w, await api("h_archivo", { token, id })); }
    catch (x) { if (w) w.close(); toast(x.message); }
  }
  async function borrar(b) {
    if (b.dataset.ok !== "1") { b.dataset.ok = "1"; b.textContent = "¿Eliminar? Sí"; setTimeout(() => { if (b.isConnected) { b.dataset.ok = ""; b.textContent = "Eliminar"; } }, 4000); return; }
    b.disabled = true;
    try { datos = await api("h_borrar", { token, id: b.dataset.del }); pintar(); toast("Documento eliminado"); } catch (x) { toast(x.message); b.disabled = false; }
  }
  $("#enviar").onclick = async () => {
    if (subiendo) return;
    const b = $("#enviar"); cargando(b, "Enviando…"); err("#send-err");
    try { datos = await api("h_enviar", { token }); pintar(); window.scrollTo({ top: 0, behavior: "smooth" }); toast("Enviado a revisión. SSOMA te avisará por correo."); }
    catch (x) { err("#send-err", x.message); }
    cargando(b);
  };
  window.addEventListener("beforeunload", e => { if (subiendo) { e.preventDefault(); e.returnValue = ""; } });

  // Inicio
  if (token) { vista("exp"); $("#resumen").innerHTML = `<div class="loading"><span class="spin"></span>Cargando tu expediente…</div>`; cargar(); }
  else vista("ingreso");
})();
