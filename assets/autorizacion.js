/* Autorización de trabajos en sede: vista de la empresa contratista */
(function () {
  const $ = s => document.querySelector(s);
  const esc = window.fpEsc, fmt = window.fpFecha, api = window.fpApi;
  const TIPOS = ["application/pdf", "image/jpeg", "image/png", "application/msword", "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
  const EXT = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", doc: "application/msword", xls: "application/vnd.ms-excel",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (_) { return null; } };
  const NIVEL_CLS = { Bajo: "nv-bajo", Medio: "nv-medio", Alto: "nv-alto" };
  const EST = { "Borrador": "st-registrada", "En revisión": "st-revision", "Observado": "st-obs", "Autorizado": "st-aprobado", "Finalizado": "st-registrada", "Anulado": "st-no" };
  const estTxt = s => s.estadoActual === "Autorizado" ? (s.enCurso ? "Autorizado · en curso" : "Autorizado") : s.estadoActual === "Borrador" ? "Pendiente de documentos" : s.estadoActual;

  let ruc = "", token = ls("fp-trab-token") || "", ini = null, det = null, subiendo = 0, personal = [];

  function vista(v) {
    ["ingreso", "codigo", "lista", "sol"].forEach(n => $("#v-" + n).hidden = n !== v);
    $("#top-user").hidden = ["lista", "sol"].indexOf(v) < 0;
    const top = document.querySelector(".zona").getBoundingClientRect().top + window.scrollY - 90;
    if (window.scrollY > top) window.scrollTo({ top });
  }
  function err(sel, m) { const e = $(sel); e.textContent = m || ""; e.hidden = !m; }
  function cargando(btn, txt) { btn.dataset.t = btn.dataset.t || btn.innerHTML; btn.disabled = !!txt; btn.innerHTML = txt ? `<span class="spin"></span> ${txt}` : btn.dataset.t; }
  let tt = null;
  function toast(m) { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => t.hidden = true, 5000); }
  const dias = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);

  /* ---------- Acceso ---------- */
  $("#f-ruc").addEventListener("submit", async e => {
    e.preventDefault();
    ruc = $("#ruc").value.replace(/\D/g, "");
    if (!/^(10|15|17|20)\d{9}$/.test(ruc)) return err("#ruc-err", "El RUC debe tener 11 dígitos y empezar con 10, 15, 17 o 20.");
    err("#ruc-err"); const b = $("#ruc-go"); cargando(b, "Verificando…");
    try {
      const r = await api("t_codigo", { ruc });
      if (r.nuevo) err("#ruc-err", "No hay trabajos registrados para este RUC. El área del Grupo Friopacking que contrató el servicio debe registrarlo primero; te llegará un correo cuando lo haga.");
      else { $("#cod-msg").innerHTML = `Enviamos un código de 6 dígitos a <b>${esc(r.correo)}</b>. Revisa también la carpeta de spam.`; vista("codigo"); $("#cod").value = ""; $("#cod").focus(); }
    } catch (x) { err("#ruc-err", x.message); }
    cargando(b);
  });
  $("#cod-back").onclick = () => vista("ingreso");
  $("#cod-re").onclick = async () => { try { const r = await api("t_codigo", { ruc }); toast("Código reenviado a " + r.correo); } catch (x) { err("#cod-err", x.message); } };
  $("#f-cod").addEventListener("submit", async e => {
    e.preventDefault();
    const c = $("#cod").value.replace(/\D/g, "");
    if (c.length !== 6) return err("#cod-err", "El código tiene 6 dígitos.");
    err("#cod-err"); const b = $("#cod-go"); cargando(b, "Ingresando…");
    try { const r = await api("t_validar", { ruc, codigo: c }); token = r.token; ls("fp-trab-token", token); await cargarLista(); }
    catch (x) { err("#cod-err", x.message); }
    cargando(b);
  });
  $("#salir").onclick = () => { token = ""; ls("fp-trab-token", null); ini = det = null; $("#ruc").value = ""; vista("ingreso"); };
  function sesionVencida(x) { if (/Sesión/.test(x.message)) { token = ""; ls("fp-trab-token", null); vista("ingreso"); err("#ruc-err", x.message); return true; } return false; }

  /* ---------- Mis solicitudes ---------- */
  async function cargarLista() {
    try { ini = await api("t_inicio", { token }); pintarLista(); vista("lista"); }
    catch (x) { if (!sesionVencida(x)) { vista("ingreso"); err("#ruc-err", x.message); } }
  }
  function pintarLista() {
    const S = ini.solicitudes;
    $("#top-razon").textContent = ini.empresa.razon;
    $("#v-lista").innerHTML = `<div class="card"><div class="pane">
        <div class="sum"><div style="display:flex;flex-direction:column;gap:6px;min-width:0"><span class="kicker">Mis trabajos</span><h2>${esc(ini.empresa.razon)}</h2>
          <div class="meta"><span>RUC ${esc(ini.empresa.ruc)}</span><span>${esc(ini.empresa.correo)}</span></div></div>
          </div>
        <p class="hint">Estos son los trabajos que el Grupo Friopacking registró para tu empresa. En cada uno sube los documentos, registra a tu personal y envíalo a revisión. Tu personal solo podrá ingresar en las fechas autorizadas.</p></div></div>
      ${S.length ? `<div class="sol-list">${S.map(s => `<button class="card sol" type="button" data-id="${esc(s.id)}">
          <div class="sol-top"><span class="sol-id">${esc(s.id)}</span><span class="st ${EST[s.estadoActual] || ""}">${esc(estTxt(s))}</span></div>
          <b class="sol-t">${esc(s.trabajo)}</b>
          <div class="meta"><span>Sede ${esc(s.sede)}</span><span>${fmt(s.inicio)} al ${fmt(s.fin)}</span><span class="nv ${NIVEL_CLS[s.nivel]}">Riesgo ${esc(s.nivel.toLowerCase())}</span></div></button>`).join("")}</div>`
        : `<div class="card"><div class="pane empty-box"><b>No tienes trabajos registrados.</b><span>Cuando el área que te contrató registre uno, te llegará un correo.</span></div></div>`}`;
    $("#v-lista").querySelectorAll(".sol").forEach(b => b.onclick = () => abrir(b.dataset.id));
  }

  /* ---------- Detalle de una solicitud ---------- */
  async function abrir(id) {
    $("#v-sol").innerHTML = `<div class="card"><div class="pane"><div class="loading"><span class="spin"></span>Cargando solicitud…</div></div></div>`; vista("sol");
    try { det = await api("t_solicitud", { token, id }); pintarDetalle(); }
    catch (x) { if (!sesionVencida(x)) $("#v-sol").innerHTML = `<div class="notice bad">${esc(x.message)}</div>`; }
  }
  const MENSAJE = {
    "Borrador": "Indica tu supervisor, sube los documentos y registra a tu personal. Cuando termines, pulsa <b>Enviar a revisión</b>.",
    "Anulado": "Este trabajo fue anulado por el Grupo Friopacking.",
    "En revisión": "El área SSOMA de la sede está revisando tu solicitud. Te avisaremos por correo.",
    "Observado": "Corrige los ítems marcados en rojo y vuelve a enviar la solicitud.",
    "Autorizado": "Trabajo autorizado. Solo puede ingresar el personal registrado, con su inducción SSOMA vigente, en las fechas autorizadas.",
    "Finalizado": "El periodo autorizado terminó. Si necesitas más días, crea una nueva solicitud."
  };
  function pintarDetalle() {
    const s = det.solicitud, ed = s.editable, reqs = det.requisitos;
    const conArch = new Set(det.archivos.map(a => a.item)), n = reqs.filter(q => conArch.has(q.item)).length;
    const secs = []; reqs.forEach(q => { let x = secs.find(y => y.nombre === q.seccion); if (!x) secs.push(x = { nombre: q.seccion, items: [] }); x.items.push(q); });
    const tono = s.estadoActual === "Autorizado" ? "ok" : /Observado/.test(s.estadoActual) ? "warn" : "";
    $("#v-sol").innerHTML = `
      <button class="ev-back" id="d-back" type="button">← Mis trabajos</button>
      <div class="card"><div class="pane" style="gap:16px">
        <div class="sum"><div style="display:flex;flex-direction:column;gap:8px;min-width:0">
          <span class="st ${EST[s.estadoActual] || ""}">${esc(estTxt(s))}</span><h2>${esc(s.trabajo)}</h2>
          <div class="meta"><span>${esc(s.id)}</span><span>Sede ${esc(s.sede)} · ${esc(s.grupo)}</span>${s.lugar ? `<span>${esc(s.lugar)}</span>` : ""}<span>Registrado por ${esc(s.solicitante)}</span></div></div>
          <div class="score"><span class="nv ${NIVEL_CLS[s.nivel]}">Riesgo ${esc(s.nivel.toLowerCase())}</span></div></div>
        <div class="fechas"><div><span class="hint">Inicio</span><b>${fmt(s.inicio)}</b></div><span class="flecha">→</span><div><span class="hint">Fin</span><b>${fmt(s.fin)}</b></div>
          <div><span class="hint">Duración</span><b>${dias(s.inicio, s.fin) + 1} día${dias(s.inicio, s.fin) ? "s" : ""}</b></div>${ed ? "" : `<div><span class="hint">Supervisor</span><b>${esc(s.supervisor || "—")}</b></div>`}</div>
        ${ed ? `<div class="sup-box"><div class="field"><label for="d-sup">Supervisor de tu empresa en el trabajo</label><input class="inp" id="d-sup" value="${esc(s.supervisor || "")}" placeholder="Nombres y apellidos"></div>
          <div class="field"><label for="d-tel">Teléfono</label><input class="inp" id="d-tel" inputmode="tel" value="${esc(s.telSup || "")}"></div>
          <button class="btn btn-ghost btn-sm" id="d-sup-go" type="button">Guardar</button><span class="err" id="d-sup-err" hidden></span></div>` : ""}
        <div class="acts-sel">${s.actividades.map(a => `<span class="gtag">${esc(a)}</span>`).join("")}</div>
        <div class="notice ${tono}"><span>${MENSAJE[s.estadoActual] || ""}</span>${s.obs && s.estado !== "Anulado" ? `<span><b>Comentario de SSOMA:</b> ${esc(s.obs)}</span>` : s.obs ? `<span>${esc(s.obs)}</span>` : ""}</div>
        ${ed ? `<div class="prog"><div class="lbl"><span>Documentos cargados</span><span>${n} de ${reqs.length} ítems</span></div><div class="bar"><i style="width:${reqs.length ? Math.round(n / reqs.length * 100) : 0}%"></i></div></div>
          <p class="hint">Los documentos con fecha de vencimiento deben estar vigentes hasta el ${fmt(s.fin)}. Si un ítem no aplica, déjalo vacío y SSOMA lo marcará como N/A.</p>` : ""}
      </div></div>
      <div class="secs">${secs.map(x => `<section class="sec${/actividad/.test(x.nombre) ? " sec-cli" : ""}"><div class="sec-h" style="cursor:default"><h3>${esc(x.nombre)}</h3><span class="n">${x.items.filter(q => conArch.has(q.item)).length} de ${x.items.length} con documento</span></div>
        <ul class="items">${x.items.map(itemHTML).join("")}</ul></section>`).join("")}</div>
      <div class="card"><div class="pane" id="pers"></div></div>
      ${ed ? `<div class="card send-bar"><div class="pane"><div class="send-row"><div><b>${s.estado === "Observado" ? "¿Ya corregiste las observaciones?" : "¿Todo listo?"}</b><p class="hint">Revisa que tu personal esté registrado y los documentos cargados.</p></div>
        <button class="btn btn-primary" id="d-enviar" type="button" ${n ? "" : "disabled"}>${s.estado === "Observado" ? "Volver a enviar" : "Enviar a revisión"}</button></div><div class="err" id="send-err" role="alert" hidden></div></div></div>` : ""}`;
    $("#d-back").onclick = () => cargarLista();
    if ($("#d-sup-go")) $("#d-sup-go").onclick = async () => {
      const e = $("#d-sup-err"), b = $("#d-sup-go"); e.hidden = true; cargando(b, "Guardando…");
      try { const sinGuardar = personal.filter(p => !p.info); det = await api("t_supervisor", { token, id: s.id, datos: { supervisor: $("#d-sup").value.trim(), telSup: $("#d-tel").value.trim() } }); pintarDetalle(); if (sinGuardar.length) { personal = personal.concat(sinGuardar); pintarPersonal(); } toast("Supervisor guardado."); }
      catch (x) { cargando(b); if (!sesionVencida(x)) { e.textContent = x.message; e.hidden = false; } }
    };
    $("#v-sol").querySelectorAll("input[type=file]").forEach(i => i.onchange = () => subir(i));
    $("#v-sol").querySelectorAll("[data-ver]").forEach(b => b.onclick = () => ver(b.dataset.ver));
    $("#v-sol").querySelectorAll("[data-del]").forEach(b => b.onclick = () => borrar(b));
    if ($("#d-enviar")) $("#d-enviar").onclick = enviar;
    personal = det.personal.map(p => ({ dni: p.dni, nombre: p.nombre, cargo: p.cargo, info: p }));
    pintarPersonal();
  }
  function itemHTML(q) {
    const ev = det.evaluacion[q.item], arch = det.archivos.filter(a => a.item === q.item), res = ev && ev.resultado;
    const ed = det.solicitud.editable && res !== "Cumple";
    const chip = res === "Cumple" ? ["c-ok", "Cumple"] : res === "No cumple" ? ["c-no", "No cumple"] : res === "N/A" ? ["c-na", "No aplica"] : arch.length ? ["c-up", "Cargado"] : ["c-none", "Sin documento"];
    return `<li class="it"><span class="no">${esc(q.item)}</span>
      <div class="body"><span class="rq">${esc(q.requisito)}</span><span class="doc">Documento: ${esc(q.documento)}${q.vence ? " · <b>indica su fecha de vencimiento</b>" : ""}</span>
        ${res === "No cumple" && ev.obs ? `<div class="obs"><b>Observación SSOMA:</b> ${esc(ev.obs)}</div>` : res && ev.obs ? `<div class="hint">SSOMA: ${esc(ev.obs)}</div>` : ""}
        ${arch.length ? `<ul class="files">${arch.map(a => `<li><span class="fn" title="${esc(a.nombre)}">${esc(a.nombre)}</span><span class="fm">${Math.max(1, Math.round(a.kb))} KB${a.vence ? " · vence " + fmt(a.vence) : ""}</span><button type="button" data-ver="${esc(a.id)}">Ver</button>${ed ? `<button type="button" class="del" data-del="${esc(a.id)}">Eliminar</button>` : ""}</li>`).join("")}</ul>` : ""}
        ${ed ? `<div class="up"><label class="btn btn-ghost btn-sm">Subir archivo<input type="file" hidden multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" data-item="${esc(q.item)}"></label>${q.vence ? `<label class="vence">Vence <input class="inp" type="date" min="${esc(det.solicitud.fin)}" data-vence="${esc(q.item)}"></label>` : ""}<span class="upmsg" data-msg="${esc(q.item)}"></span></div>` : ""}
      </div><span class="it-st"><span class="chipst ${chip[0]}">${chip[1]}</span></span></li>`;
  }

  /* ---------- Personal ---------- */
  function pintarPersonal() {
    const s = det.solicitud, ed = s.editable, box = $("#pers");
    const estado = p => {
      const i = p.info; if (!i) return `<span class="hint">Se verifica al guardar</span>`;
      if (i.habilitado === true) return `<span class="chipst c-ok">Habilitado</span>`;
      if (i.vetado) return `<span class="chipst c-no">No habilitado</span><span class="hint">Comunícate con el área SSOMA.</span>`;
      if (!i.induccionVence) return `<span class="chipst c-no">Falta inducción</span>`;
      if (!i.cubreTrabajo) return `<span class="chipst c-obs">Inducción vence ${fmt(i.induccionVence)}</span><span class="hint">Debe renovarla antes del ${fmt(s.fin)}</span>`;
      return `<span class="chipst c-ok">Inducción vigente</span>`;
    };
    box.innerHTML = `<div class="pane-head"><h2 style="font-size:24px;color:var(--navy)">Personal que realizará el trabajo</h2>
        <p class="hint">Solo podrá ingresar el personal de esta lista. Cada persona debe rendir la <a href="../induccion/?tipo=contratista" target="_blank" rel="noopener">inducción SSOMA como contratista</a> con el RUC ${esc(s.ruc)}.</p></div>
      <div class="per-tabla">${personal.length ? personal.map((p, i) => `<div class="per-row">
          ${ed && !p.info ? `<input class="inp" data-k="dni" data-i="${i}" value="${esc(p.dni)}" placeholder="DNI / CE" maxlength="12" inputmode="numeric">
            <input class="inp" data-k="nombre" data-i="${i}" value="${esc(p.nombre)}" placeholder="Nombres y apellidos">
            <input class="inp" data-k="cargo" data-i="${i}" value="${esc(p.cargo)}" placeholder="Cargo">`
          : `<span class="pd">${esc(p.dni)}</span><span class="pn"><b>${esc(p.nombre)}</b></span><span class="pc">${esc(p.cargo || "")}</span>`}
          <span class="pe">${estado(p)}</span>${ed ? `<button class="linkbtn del" type="button" data-q="${i}" aria-label="Quitar">Quitar</button>` : ""}</div>`).join("")
        : `<p class="hint">Aún no has registrado personal.</p>`}</div>
      ${ed ? `<div class="actions between"><button class="btn btn-ghost btn-sm" id="p-add" type="button">+ Agregar persona</button><button class="btn btn-navy btn-sm" id="p-save" type="button">Guardar personal</button></div><span class="err" id="p-err" role="alert" hidden></span>` : ""}`;
    if (!ed) return;
    box.querySelectorAll("input[data-k]").forEach(i => i.oninput = () => { personal[+i.dataset.i][i.dataset.k] = i.value; });
    box.querySelectorAll("[data-q]").forEach(b => b.onclick = () => { personal.splice(+b.dataset.q, 1); pintarPersonal(); });
    $("#p-add").onclick = () => { personal.push({ dni: "", nombre: "", cargo: "" }); pintarPersonal(); const ins = box.querySelectorAll('input[data-k="dni"]'); if (ins.length) ins[ins.length - 1].focus(); };
    $("#p-save").onclick = guardarPersonal;
  }
  async function guardarPersonal() {
    const e = $("#p-err"); e.hidden = true;
    const nuevos = personal.filter(p => !p.info);
    for (const p of nuevos) {
      p.dni = String(p.dni || "").replace(/\s/g, "").toUpperCase(); p.nombre = String(p.nombre || "").trim();
      if (!/^[0-9A-Z]{8,12}$/.test(p.dni)) { e.textContent = "Revisa el documento: " + (p.dni || "(vacío)"); e.hidden = false; return; }
      if (p.nombre.length < 5) { e.textContent = "Escribe el nombre completo de " + p.dni + "."; e.hidden = false; return; }
    }
    const b = $("#p-save"); cargando(b, "Guardando…");
    try {
      const lista = personal.map(p => ({ dni: p.dni, nombre: p.nombre, cargo: p.cargo }));
      det = await api("t_personal", { token, id: det.solicitud.id, personal: lista });
      pintarDetalle(); toast("Personal guardado.");
    } catch (x) { cargando(b); if (!sesionVencida(x)) { e.textContent = x.message; e.hidden = false; } }
  }

  /* ---------- Documentos ---------- */
  async function subir(inp) {
    const item = inp.dataset.item, files = [...inp.files], msg = document.querySelector(`[data-msg="${CSS.escape(item)}"]`);
    inp.value = "";
    const q = det.requisitos.find(x => x.item === item), vInp = document.querySelector(`[data-vence="${CSS.escape(item)}"]`), vence = vInp ? vInp.value : "";
    if (q.vence && !vence) { msg.textContent = "Indica la fecha de vencimiento del documento antes de subirlo."; vInp.focus(); return; }
    for (const f of files) {
      const ext = (f.name.split(".").pop() || "").toLowerCase(), tipo = TIPOS.indexOf(f.type) >= 0 ? f.type : EXT[ext];
      if (!tipo) { msg.textContent = `${f.name}: formato no permitido.`; continue; }
      if (f.size > det.maxMb * 1048576) { msg.textContent = `${f.name} pesa ${(f.size / 1048576).toFixed(1)} MB; el máximo es ${det.maxMb} MB.`; continue; }
      subiendo++; msg.innerHTML = `<span class="spin" style="width:14px;height:14px;display:inline-block;vertical-align:middle"></span> Subiendo ${esc(f.name)}…`;
      try { det = await api("t_subir", { token, id: det.solicitud.id, item, nombre: f.name, tipo, base64: await window.fpBase64(f), vence }); toast("Documento subido: " + f.name); }
      catch (x) { subiendo--; msg.textContent = x.message; return; }
      subiendo--;
    }
    const sinGuardar = personal.filter(p => !p.info);
    pintarDetalle(); if (sinGuardar.length) { personal = personal.concat(sinGuardar); pintarPersonal(); }
  }
  async function ver(id) {
    const w = window.open("", "_blank");
    if (w) w.document.write("<p style='font-family:sans-serif'>Abriendo documento…</p>");
    try { window.fpAbrirArchivo(w, await api("t_archivo", { token, archivo: id })); }
    catch (x) { if (w) w.close(); toast(x.message); }
  }
  async function borrar(b) {
    if (b.dataset.ok !== "1") { b.dataset.ok = "1"; b.textContent = "¿Eliminar? Sí"; setTimeout(() => { if (b.isConnected) { b.dataset.ok = ""; b.textContent = "Eliminar"; } }, 4000); return; }
    b.disabled = true;
    try { det = await api("t_borrar", { token, id: det.solicitud.id, archivo: b.dataset.del }); pintarDetalle(); toast("Documento eliminado"); } catch (x) { toast(x.message); b.disabled = false; }
  }
  async function enviar() {
    if (subiendo) return;
    if (personal.some(p => !p.info)) { err("#send-err", "Guarda primero la lista de personal."); return; }
    if (!det.solicitud.supervisor) { err("#send-err", "Indica y guarda el supervisor de tu empresa para este trabajo."); $("#d-sup").focus(); return; }
    const b = $("#d-enviar"); cargando(b, "Enviando…"); err("#send-err");
    try { det = await api("t_enviar", { token, id: det.solicitud.id }); pintarDetalle(); window.scrollTo({ top: 0, behavior: "smooth" }); toast("Enviada a revisión. La sede te avisará por correo."); }
    catch (x) { cargando(b); if (!sesionVencida(x)) err("#send-err", x.message); }
  }
  window.addEventListener("beforeunload", e => { if (subiendo) { e.preventDefault(); e.returnValue = ""; } });

  // Inicio
  if (token) { vista("lista"); $("#v-lista").innerHTML = `<div class="card"><div class="pane"><div class="loading"><span class="spin"></span>Cargando tus solicitudes…</div></div></div>`; cargarLista(); }
  else vista("ingreso");
})();
