/* Panel SSOMA: autorización de trabajos en sede */
(function () {
  const $ = s => document.querySelector(s);
  const esc = window.fpEsc, fmt = window.fpFecha, api = window.fpApi;
  const box = $("#mod-tra");
  const NIVEL_CLS = { Bajo: "nv-bajo", Medio: "nv-medio", Alto: "nv-alto" };
  const EST = { "En revisión": "st-revision", "Observado": "st-obs", "Autorizado": "st-aprobado", "Finalizado": "st-registrada" };
  const estado = s => s.estadoActual === "Autorizado" ? (s.enCurso ? "En curso" : "Programado") : s.estadoActual === "Borrador" ? "Esperando documentos" : s.estadoActual;
  const ESTCLS = { "Esperando documentos": "st-registrada", "En revisión": "st-revision", "Observado": "st-obs", "En curso": "st-aprobado", "Programado": "st-aprobado", "Finalizado": "st-registrada", "Anulado": "st-no" };
  let clave = "", lista = null, det = null, vista = "lista", filtro = { q: "", estado: "", sede: "" }, cambios = false, timer = null;
  let tt = null;
  function toast(m) { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => t.hidden = true, 6000); }
  const dias = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);

  document.addEventListener("fp:login", e => { clave = e.detail; cargarLista(true); clearInterval(timer); timer = setInterval(() => { if (!document.hidden && vista === "lista") cargarLista(true); }, 60000); });
  document.addEventListener("fp:logout", () => { clave = ""; lista = det = null; vista = "lista"; clearInterval(timer); box.innerHTML = ""; });
  document.addEventListener("fp:modulo", e => { if (e.detail === "tra" && vista === "lista") cargarLista(); });

  /* ---------- Lista ---------- */
  async function cargarLista(silencio) {
    if (!clave) return;
    if (!silencio && !lista) box.innerHTML = `<div class="loading"><span class="spin"></span>Cargando solicitudes…</div>`;
    try { lista = await api("t_lista", { clave }); }
    catch (x) { if (!silencio) box.innerHTML = `<div class="notice bad">${esc(x.message)}</div>`; return; }
    const sol = (lista.usuario || {}).solicitante;
    const pend = lista.solicitudes.filter(s => sol ? s.estadoActual === "Observado" || s.estadoActual === "Borrador" : s.estadoActual === "En revisión").length, bd = $("#badge-tra");
    bd.textContent = pend; bd.hidden = !pend;
    if (vista === "lista" && !box.hidden) pintarLista();
  }
  function pintarLista() {
    const L = lista.solicitudes, u = lista.usuario || {}, cuenta = e => L.filter(s => estado(s) === e).length;
    const K = [["Esperando documentos", "k-mute", "Esperando documentos de la empresa"], ["En revisión", "k-rev", "En revisión SSOMA"], ["En curso", "k-ok", "Trabajos en curso"], ["Programado", "k-ok", "Autorizados próximos"], ["Observado", "k-warn", "Observados"], ["Finalizado", "k-mute", "Finalizados"]];
    const F = L.filter(s => (!filtro.estado || estado(s) === filtro.estado) && (!filtro.sede || s.sede === filtro.sede) &&
      (!filtro.q || `${s.id} ${s.razon} ${s.ruc} ${s.trabajo} ${s.lugar}`.toLowerCase().includes(filtro.q.toLowerCase())))
      .sort((a, b) => (estado(a) === "En revisión" ? 0 : 1) - (estado(b) === "En revisión" ? 0 : 1) || String(b.envio || b.creacion).localeCompare(String(a.envio || a.creacion)));
    box.innerHTML = `
      <div class="dash-head"><div><span class="eyebrow" style="color:var(--teal-ink)">${u.solicitante ? "Mis trabajos registrados" : "Trabajos puntuales"}${u.admin ? "" : " · Sede " + esc(u.sede)}</span><h1>Trabajos en sede</h1></div>
        <div class="actions"><button class="btn btn-navy btn-sm" id="t-nuevo" type="button">+ Nuevo trabajo</button><button class="btn btn-ghost btn-sm" id="t-csv" type="button">Exportar a Excel</button><button class="btn btn-ghost btn-sm" id="t-act" type="button">Actualizar</button></div></div>
      ${u.solicitante ? `<div class="notice"><span>Registra aquí los trabajos que contratas en tu sede. La empresa recibirá un correo para subir sus documentos y su personal; luego SSOMA de la sede lo revisa y autoriza.</span></div>` : ""}
      <div class="kpis kpis6">${K.map(k => `<button type="button" class="kpi ${k[1]}" data-e="${k[0]}" aria-pressed="${filtro.estado === k[0]}"><b>${cuenta(k[0])}</b><span>${k[2]}</span></button>`).join("")}</div>
      <div class="toolbar"><input class="inp" id="t-q" type="search" placeholder="Buscar por código, empresa, RUC o trabajo" value="${esc(filtro.q)}" aria-label="Buscar">
        <select class="inp" id="t-est" aria-label="Estado"><option value="">Todos los estados</option>${K.concat([["Anulado"]]).map(k => `<option ${filtro.estado === k[0] ? "selected" : ""}>${k[0]}</option>`).join("")}</select>
        ${u.admin ? `<select class="inp" id="t-sede" aria-label="Sede"><option value="">Todas las sedes</option>${lista.sedes.map(x => `<option ${filtro.sede === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select>` : ""}</div>
      <div class="count-s">${F.length} de ${L.length} solicitudes</div>
      <div class="tablebox"><table><thead><tr><th>Solicitud</th><th>Empresa</th><th>Trabajo</th><th>Sede</th><th>Fechas</th><th>Riesgo</th><th>Personal / docs</th><th>Estado</th><th></th></tr></thead><tbody>
      ${F.length ? F.map(s => { const e = estado(s); return `<tr>
        <td class="num"><b>${esc(s.id)}</b><span class="sub">${s.envio ? "enviada " + fmt(s.envio) : "creada " + fmt(s.creacion)}</span><span class="sub">${esc(s.creador || s.solicitante || "")}</span></td>
        <td><b>${esc(s.razon)}</b><span class="sub">RUC ${esc(s.ruc)}</span></td>
        <td style="max-width:280px">${esc(s.trabajo)}<span class="sub">${esc(s.lugar || "")}</span></td>
        <td>${esc(s.sede)}<span class="sub">${esc(s.grupo)}</span></td>
        <td class="num">${fmt(s.inicio)}<span class="sub">al ${fmt(s.fin)}</span></td>
        <td><span class="nv ${NIVEL_CLS[s.nivel]}">${esc(s.nivel)}</span></td>
        <td class="num">${s.personal} pers.<span class="sub">${s.items} / ${s.total} ítems</span></td>
        <td><span class="st ${ESTCLS[e] || ""}">${esc(e)}</span></td>
        <td><button class="btn ${e === "En revisión" && !u.solicitante ? "btn-navy" : "btn-ghost"} btn-sm" data-id="${esc(s.id)}" type="button">${e === "En revisión" && !u.solicitante ? "Revisar" : "Ver"}</button></td></tr>`; }).join("")
        : `<tr><td colspan="9" class="empty">${L.length ? "Ninguna solicitud coincide con los filtros." : (u.solicitante ? "Aún no registras trabajos. Usa «+ Nuevo trabajo»." : "Aún no hay trabajos registrados en tu sede.")}</td></tr>`}
      </tbody></table></div>`;
    $("#t-q").oninput = e => { filtro.q = e.target.value; const pos = e.target.selectionStart; pintarLista(); const i = $("#t-q"); i.focus(); i.setSelectionRange(pos, pos); };
    $("#t-est").onchange = e => { filtro.estado = e.target.value; pintarLista(); };
    if ($("#t-sede")) $("#t-sede").onchange = e => { filtro.sede = e.target.value; pintarLista(); };
    box.querySelectorAll(".kpi").forEach(b => b.onclick = () => { filtro.estado = filtro.estado === b.dataset.e ? "" : b.dataset.e; pintarLista(); });
    box.querySelectorAll("[data-id]").forEach(b => b.onclick = () => abrir(b.dataset.id));
    $("#t-act").onclick = () => cargarLista();
    $("#t-nuevo").onclick = () => formulario(null);
    $("#t-csv").onclick = () => {
      const q = v => { v = String(v == null ? "" : v); return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
      const cols = ["Solicitud", "RUC", "Razón social", "Sede", "Empresa del grupo", "Trabajo", "Lugar", "Actividades", "Nivel de riesgo", "Inicio", "Fin", "Supervisor", "Solicitado por", "Personal", "Estado", "Enviada", "Evaluada", "Evaluador"];
      const filas = F.map(s => [s.id, s.ruc, s.razon, s.sede, s.grupo, s.trabajo, s.lugar, s.actividades.join(" / "), s.nivel, fmt(s.inicio), fmt(s.fin), s.supervisor, s.solicitante, s.personal, estado(s), fmt(s.envio), fmt(s.evaluacion), s.evaluador].map(q).join(";"));
      const blob = new Blob(["﻿" + [cols.join(";")].concat(filas).join("\r\n")], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `Trabajos_en_sede_${lista.hoy}.csv`; document.body.appendChild(a); a.click(); a.remove();
    };
  }

  /* ---------- Evaluación ---------- */
  async function abrir(id) {
    vista = "detalle"; cambios = false;
    box.innerHTML = `<div class="loading"><span class="spin"></span>Cargando solicitud…</div>`;
    try { det = await api("t_detalle", { clave, id }); pintarDetalle(); window.scrollTo({ top: 0 }); }
    catch (x) { box.innerHTML = `<div class="notice bad">${esc(x.message)}</div>`; }
  }
  let avisoSalida = 0;
  function volver() {
    if (cambios && Date.now() - avisoSalida > 5000) { avisoSalida = Date.now(); toast("Tienes cambios sin guardar. Pulsa «Volver» otra vez para salir sin guardar."); return; }
    vista = "lista"; det = null; pintarLista(); cargarLista(true);
  }
  function evals() {
    const ev = {};
    det.requisitos.forEach(q => {
      const r = box.querySelector(`input[name="t-${CSS.escape(q.item)}"]:checked`), o = box.querySelector(`[data-obs="${CSS.escape(q.item)}"]`);
      ev[q.item] = { resultado: r ? r.value : "", obs: o ? o.value.trim() : "" };
    });
    return ev;
  }
  function pintarDetalle() {
    const s = det.solicitud, e = estado(s), puede = det.puedeEvaluar && s.estado === "En revisión", dis = puede ? "" : "disabled", ev = det.evaluacion;
    const secs = []; det.requisitos.forEach(q => { let x = secs.find(y => y.nombre === q.seccion); if (!x) secs.push(x = { nombre: q.seccion, items: [] }); x.items.push(q); });
    const P = det.personal;
    box.innerHTML = `
      <div class="ev-head"><button class="ev-back" id="t-back" type="button">← Volver a la lista</button>
        <div class="dash-head"><div><span class="st ${ESTCLS[e] || ""}">${esc(e)}</span> <span class="nv ${NIVEL_CLS[s.nivel]}">Riesgo ${esc(s.nivel.toLowerCase())}</span><h1 style="margin-top:8px">${esc(s.trabajo)}</h1></div></div>
        ${det.usuario.solicitante ? `<div class="notice ${e === "Observado" || e === "Anulado" ? "warn" : e === "En curso" || e === "Programado" ? "ok" : ""}"><span>${{
            "Esperando documentos": "La empresa ya recibió el correo. Está pendiente que suba sus documentos, registre a su personal y envíe la solicitud.",
            "En revisión": "SSOMA de la sede " + esc(s.sede) + " está revisando los documentos.",
            "Observado": "SSOMA observó documentos. La empresa debe corregirlos y volver a enviar.",
            "Programado": "Autorizado. El personal podrá ingresar desde el " + fmt(s.inicio) + ".", "En curso": "Autorizado y en curso hasta el " + fmt(s.fin) + ".",
            "Finalizado": "El periodo autorizado terminó.", "Anulado": esc(s.obs || "Trabajo anulado.") }[e] || ""}</span></div>`
          : !det.puedeEvaluar ? `<div class="notice warn"><span><b>Solo consulta.</b> Esta solicitud la evalúa la sede <b>${esc(s.sede)}</b>.</span></div>` : ""}
        ${det.puedeEditar || det.puedeAnular ? `<div class="actions">${det.puedeEditar ? `<button class="btn btn-ghost btn-sm" id="t-edit" type="button">Editar datos del trabajo</button>` : ""}${det.puedeAnular ? `<details class="vlev anular"><summary>Anular trabajo</summary><textarea class="inp" id="an-mot" rows="2" placeholder="Motivo de la anulación"></textarea><button class="btn btn-ghost btn-sm" id="an-go" type="button">Confirmar anulación</button><span class="err" id="an-err" hidden></span></details>` : ""}</div>` : ""}
        <dl class="ev-info"><div><dt>Solicitud</dt><dd>${esc(s.id)}</dd></div><div><dt>Empresa</dt><dd>${esc(s.razon)} · RUC ${esc(s.ruc)}</dd></div>
          <div><dt>Contacto</dt><dd>${det.empresa ? esc(det.empresa.representante) + " · " + esc(det.empresa.correo) + (det.empresa.telefono ? " · " + esc(det.empresa.telefono) : "") : "—"}</dd></div>
          <div><dt>Sede · lugar</dt><dd>${esc(s.sede)}${s.lugar ? " · " + esc(s.lugar) : ""} (${esc(s.grupo)})</dd></div>
          <div><dt>Fechas</dt><dd>${fmt(s.inicio)} al ${fmt(s.fin)} (${dias(s.inicio, s.fin) + 1} días)</dd></div>
          <div><dt>Supervisor de la contratista</dt><dd>${s.supervisor ? esc(s.supervisor) + (s.telSup ? " · " + esc(s.telSup) : "") : "Pendiente"}</dd></div>
          <div><dt>Registrado por</dt><dd>${esc(s.creador || s.solicitante)}</dd></div>
          <div><dt>Actividades</dt><dd>${s.actividades.map(esc).join(" · ")}</dd></div>
          ${s.evaluacion ? `<div><dt>Última evaluación</dt><dd>${fmt(s.evaluacion)} · ${esc(s.evaluador)}</dd></div>` : ""}</dl></div>
      <div class="ev-grid"><div class="secs">
        ${secs.map(x => `<section class="sec${/actividad/.test(x.nombre) ? " sec-cli" : ""}"><div class="sec-h" style="cursor:default"><h3>${esc(x.nombre)}</h3><span class="n">${x.items.filter(q => det.archivos.some(a => a.item === q.item)).length} de ${x.items.length} con documento</span></div>
          <div>${x.items.map(q => { const v = ev[q.item] || {}, arch = det.archivos.filter(a => a.item === q.item); return `<div class="ev-it ${v.resultado ? "" : "pend"}" data-item="${esc(q.item)}">
            <span class="no">${esc(q.item)}</span>
            <div class="body" style="display:flex;flex-direction:column;gap:8px;min-width:0"><span class="rq" style="font-weight:600">${esc(q.requisito)}${q.vence ? ` <span class="gtag">con vencimiento</span>` : ""}</span><span class="doc hint">Documento: ${esc(q.documento)}</span>
              ${arch.length ? `<ul class="files">${arch.map(a => `<li><span class="fn" title="${esc(a.nombre)}">${esc(a.nombre)}</span><span class="fm">${Math.max(1, Math.round(a.kb))} KB${a.vence ? ` · <b>vence ${fmt(a.vence)}</b>` : ""}</span><button type="button" data-ver="${esc(a.id)}">Ver</button></li>`).join("")}</ul>` : `<span class="nofile">Sin documento cargado</span>`}
              <div class="ctl"><span class="seg3" role="radiogroup" aria-label="Resultado del ítem ${esc(q.item)}">
                ${[["Cumple", "c"], ["No cumple", "n"], ["N/A", "a"]].map(([t, c]) => `<label class="${c}"><input type="radio" name="t-${esc(q.item)}" value="${t}" ${v.resultado === t ? "checked" : ""} ${dis}>${t}</label>`).join("")}</span>
                <textarea class="inp" data-obs="${esc(q.item)}" placeholder="Observación (la verá la empresa)" ${dis}>${esc(v.obs || "")}</textarea></div></div></div>`; }).join("")}</div></section>`).join("")}
        <section class="sec"><div class="sec-h" style="cursor:default"><h3>Personal registrado</h3><span class="n">${P.length} persona${P.length === 1 ? "" : "s"}</span></div>
          ${P.length ? `<div class="tablebox" style="border:0;border-radius:0"><table style="min-width:620px"><thead><tr><th>Trabajador</th><th>Cargo</th><th>Inducción</th><th>Estado</th></tr></thead><tbody>
          ${P.map(p => `<tr><td><b>${esc(p.nombre)}</b><span class="sub">${esc(p.dni)}</span></td><td>${esc(p.cargo || "—")}</td>
            <td class="num">${p.induccionVence ? fmt(p.induccionVence) + `<span class="sub">${p.cubreTrabajo ? "cubre todo el trabajo" : "vence antes del fin"}</span>` : `<span style="color:var(--bad)">Sin inducción</span>`}</td>
            <td>${p.vetado ? `<span class="pill p-vencido">Vetado</span><span class="sub">${esc(p.motivoVeto || "")}</span>` : p.habilitado === true ? `<span class="pill p-vigente">Habilitado</span><span class="sub">hasta ${fmt(p.hasta)}</span>` : p.induccionVence ? `<span class="pill p-porvencer">Listo</span>` : `<span class="pill p-desaprobado">Falta inducción</span>`}</td></tr>`).join("")}</tbody></table></div>`
          : `<div class="empty">La empresa no registró personal.</div>`}</section></div>
        <aside class="ev-side">${s.estado === "Borrador" ? "" : `<div class="ev-score" id="t-res"></div>`}
          ${puede ? `<div class="ev-score"><div class="field"><label for="t-obs">Comentario general para la empresa <span class="opt-tag">(opcional)</span></label><textarea class="inp" id="t-obs" rows="3">${esc(s.obs || "")}</textarea></div>
            <button class="btn btn-ghost" id="t-sin" type="button">Ítems sin documento → No cumple</button>
            <button class="btn btn-ghost" id="t-guardar" type="button">Guardar avance</button>
            <button class="btn btn-navy" id="t-fin" type="button">Finalizar y notificar</button>
            <span class="err" id="t-err" role="alert" hidden></span><span class="hint">Evalúas como <b>${esc(det.usuario.nombre)}</b>. Si todos los ítems cumplen (o no aplican) queda <b>Autorizado</b>; si alguno no cumple, queda <b>Observado</b> y la empresa podrá corregir.</span></div>` : ""}
        </aside></div>`;
    $("#t-back").onclick = volver;
    if ($("#t-edit")) $("#t-edit").onclick = () => formulario(s);
    if ($("#an-go")) $("#an-go").onclick = anular;
    box.querySelectorAll("[data-ver]").forEach(b => b.onclick = () => ver(b.dataset.ver));
    box.querySelectorAll(".ev-it input, .ev-it textarea").forEach(i => i.addEventListener(i.tagName === "TEXTAREA" ? "input" : "change", () => { cambios = true; resumen(); }));
    if (puede) {
      $("#t-obs").oninput = () => { cambios = true; };
      $("#t-sin").onclick = () => { det.requisitos.forEach(q => { if (!det.archivos.some(a => a.item === q.item) && !box.querySelector(`input[name="t-${CSS.escape(q.item)}"]:checked`)) { box.querySelector(`input[name="t-${CSS.escape(q.item)}"][value="No cumple"]`).checked = true; const o = box.querySelector(`[data-obs="${CSS.escape(q.item)}"]`); if (!o.value) o.value = "No presentó el documento."; } }); cambios = true; resumen(); };
      $("#t-guardar").onclick = () => guardar(false);
      $("#t-fin").onclick = () => guardar(true);
    }
    resumen();
  }
  function resumen() {
    if (!$("#t-res")) return;
    const ev = evals(), R = det.requisitos, s = det.solicitud;
    const c = { Cumple: 0, "No cumple": 0, "N/A": 0, "": 0 }; R.forEach(q => c[ev[q.item].resultado]++);
    box.querySelectorAll(".ev-it").forEach(d => d.classList.toggle("pend", !(ev[d.dataset.item] || {}).resultado));
    const res = c[""] ? "Pendiente" : c["No cumple"] ? "Observado" : "Autorizado";
    const sinInd = det.personal.filter(p => !p.induccionVence).length;
    $("#t-res").innerHTML = `<span class="hint">${s.estado === "En revisión" ? "Resultado al finalizar" : "Resultado"}</span>
      <span class="big" style="font-size:34px">${res}</span>
      <div class="rows"><div class="r"><span>Cumple</span><span>${c.Cumple}</span></div><div class="r"><span>No cumple</span><span>${c["No cumple"]}</span></div>
        <div class="r"><span>No aplica</span><span>${c["N/A"]}</span></div>${c[""] ? `<div class="r"><span>Por calificar</span><span><b>${c[""]}</b></span></div>` : ""}</div>
      ${sinInd ? `<span class="hint" style="color:var(--warn)"><b>${sinInd}</b> persona${sinInd === 1 ? "" : "s"} aún sin inducción: no podrán ingresar hasta rendirla.</span>` : ""}`;
  }
  async function guardar(finalizar) {
    const er = $("#t-err"); er.hidden = true;
    const ev = evals();
    if (finalizar) {
      const pend = det.requisitos.filter(q => !ev[q.item].resultado);
      if (pend.length) { er.textContent = `Faltan ${pend.length} ítems por calificar.`; er.hidden = false; const f = box.querySelector(".ev-it.pend"); if (f) f.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
      const sinObs = det.requisitos.filter(q => ev[q.item].resultado === "No cumple" && !ev[q.item].obs);
      if (sinObs.length) { er.textContent = `Escribe la observación de los ítems que no cumplen (${sinObs.map(q => q.item).join(", ")}).`; er.hidden = false; return; }
    }
    const b = finalizar ? $("#t-fin") : $("#t-guardar"), t = b.innerHTML; b.disabled = true; b.innerHTML = `<span class="spin"></span> Guardando…`;
    try {
      det = await api("t_evaluar", { clave, id: det.solicitud.id, finalizar, obs: $("#t-obs").value.trim(), lista: det.requisitos.map(q => ({ item: q.item, resultado: ev[q.item].resultado, obs: ev[q.item].obs })) });
      cambios = false; pintarDetalle();
      toast(finalizar ? `Solicitud ${det.solicitud.id}: ${det.solicitud.estado}. Se notificó a la empresa.` : "Avance guardado.");
      cargarLista(true);
    } catch (x) { b.disabled = false; b.innerHTML = t; er.textContent = x.message; er.hidden = false; }
  }
  async function anular() {
    const m = $("#an-mot").value.trim(), er = $("#an-err"); er.hidden = true;
    if (m.length < 5) { er.textContent = "Indica el motivo de la anulación."; er.hidden = false; return; }
    const b = $("#an-go"); b.disabled = true;
    try { det = await api("t_anular", { clave, id: det.solicitud.id, motivo: m }); pintarDetalle(); toast("Trabajo anulado. Se avisó a la empresa y a SSOMA."); cargarLista(true); }
    catch (x) { b.disabled = false; er.textContent = x.message; er.hidden = false; }
  }

  /* ---------- Nuevo trabajo / editar (responsable de sede o SSOMA) ---------- */
  function formulario(s) {
    vista = "form";
    const u = lista.usuario, A = lista.actividades, sel = s ? s.actividades : [], hoy = lista.hoy;
    const grupos = ["Bajo", "Medio", "Alto"].map(n => [n, A.filter(a => a.nivel === n)]).filter(g => g[1].length);
    box.innerHTML = `<button class="ev-back" id="f-back" type="button">← ${s ? "Volver al trabajo" : "Volver a la lista"}</button>
      <div class="dash-head"><div><span class="eyebrow" style="color:var(--teal-ink)">${s ? "Editar " + esc(s.id) : "Nuevo trabajo en sede"}</span><h1>${s ? "Datos del trabajo" : "Registrar trabajo"}</h1></div></div>
      <form class="box tform" id="tf" novalidate>
        <h2>Empresa contratista</h2>
        ${s ? `<p><b>${esc(s.razon)}</b> · RUC ${esc(s.ruc)}</p>` : `<div class="grid2">
          <div class="field"><label for="tf-ruc">RUC de la empresa</label><input class="inp" id="tf-ruc" inputmode="numeric" maxlength="11" placeholder="20123456789"><span class="hint" id="tf-ruc-h">Escribe el RUC para buscar a la empresa.</span></div>
          <div class="field"><label for="tf-razon">Razón social</label><input class="inp" id="tf-razon"></div>
          <div class="field"><label for="tf-rep">Contacto de la empresa</label><input class="inp" id="tf-rep" placeholder="Nombre del responsable"></div>
          <div class="field"><label for="tf-correo">Correo de la empresa</label><input class="inp" id="tf-correo" type="email" placeholder="Recibirá el aviso para subir documentos"></div>
          <div class="field"><label for="tf-tel">Teléfono <span class="opt-tag">(opcional)</span></label><input class="inp" id="tf-tel" inputmode="tel"></div></div>`}
        <h2>Trabajo</h2>
        <div class="grid2">
          <div class="field"><label for="tf-sede">Sede</label>${u.admin ? `<select class="inp" id="tf-sede"><option value="">Elige la sede</option>${lista.sedes.map(x => `<option ${s && s.sede === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select>` : `<input class="inp" id="tf-sede" value="${esc(s ? s.sede : u.sede)}" disabled>`}</div>
          <div class="field"><label for="tf-grupo">Empresa del grupo</label><select class="inp" id="tf-grupo">${lista.grupo.map(x => `<option ${s && s.grupo === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></div>
          <div class="field" style="grid-column:1/-1"><label for="tf-trabajo">Trabajo a realizar</label><textarea class="inp" id="tf-trabajo" rows="2" placeholder="Ej. Cambio de paneles del techo de la cámara 3">${esc(s ? s.trabajo : "")}</textarea></div>
          <div class="field"><label for="tf-lugar">Lugar o área</label><input class="inp" id="tf-lugar" value="${esc(s ? s.lugar : "")}" placeholder="Ej. Cámara de frío 3"></div>
          <div class="field"></div>
          <div class="field"><label for="tf-ini">Fecha de inicio</label><input class="inp" id="tf-ini" type="date" min="${hoy}" value="${esc(s ? s.inicio : "")}"></div>
          <div class="field"><label for="tf-fin">Fecha de fin</label><input class="inp" id="tf-fin" type="date" min="${hoy}" value="${esc(s ? s.fin : "")}"><span class="hint">Máximo ${lista.maxDias} días.</span></div>
        </div>
        <fieldset class="checks acts"><legend>Actividades que realizará la empresa</legend>
          ${grupos.map(([n, l]) => `<div class="act-g"><span class="nv ${NIVEL_CLS[n]}">Riesgo ${n.toLowerCase()}</span><div class="checkrow">${l.map(a => `<label><input type="checkbox" value="${esc(a.actividad)}" data-n="${n}" ${sel.indexOf(a.actividad) >= 0 ? "checked" : ""}>${esc(a.actividad)}</label>`).join("")}</div></div>`).join("")}
        </fieldset>
        <div class="nivel-box" id="tf-nivel"></div>
        <span class="err" id="tf-err" role="alert" hidden></span>
        <div class="actions between"><button class="btn btn-ghost" id="tf-cancel" type="button">Cancelar</button><button class="btn btn-navy" id="tf-go" type="submit">${s ? "Guardar cambios" : "Registrar y avisar a la empresa"}</button></div>
      </form>`;
    const nivel = () => { const ns = [...box.querySelectorAll(".acts input:checked")].map(i => i.dataset.n); const n = ns.indexOf("Alto") >= 0 ? "Alto" : ns.indexOf("Medio") >= 0 ? "Medio" : ns.length ? "Bajo" : "";
      $("#tf-nivel").innerHTML = n ? `<span>Nivel de riesgo del trabajo:</span> <span class="nv ${NIVEL_CLS[n]}">Riesgo ${n.toLowerCase()}</span><span class="hint">Define qué documentos se le pedirán a la empresa.</span>` : `<span class="hint">Marca al menos una actividad.</span>`; };
    box.querySelectorAll(".acts input").forEach(i => i.onchange = nivel); nivel();
    $("#tf-ini").onchange = () => { $("#tf-fin").min = $("#tf-ini").value || hoy; };
    const salir = () => { if (s) { vista = "detalle"; pintarDetalle(); } else { vista = "lista"; pintarLista(); } };
    $("#f-back").onclick = salir; $("#tf-cancel").onclick = salir;
    let rucBuscado = "";
    if (!s) $("#tf-ruc").oninput = async () => {
      const ruc = $("#tf-ruc").value.replace(/\D/g, ""), h = $("#tf-ruc-h");
      if (ruc.length !== 11 || ruc === rucBuscado) return; rucBuscado = ruc;
      try {
        const r = await api("t_empresa", { clave, ruc });
        const set = (id, v) => { if (v) $(id).value = v; };
        set("#tf-razon", r.razon); set("#tf-rep", r.representante); set("#tf-correo", r.correo); set("#tf-tel", r.telefono);
        ["#tf-razon", "#tf-rep", "#tf-correo", "#tf-tel"].forEach(id => $(id).readOnly = !!r.registrada);
        h.className = "hint " + (r.registrada || r.razon ? "t-ok" : "");
        h.textContent = r.registrada ? "Empresa ya registrada en trabajos en sede." : r.razon ? "Datos tomados de homologación (" + (r.homologacion || "") + "). Revisa el correo." : "Empresa nueva: completa sus datos.";
      } catch (x) { h.textContent = x.message; }
    };
    $("#tf").onsubmit = async ev => {
      ev.preventDefault();
      const v = id => ($(id) ? $(id).value.trim() : "");
      const datos = { ruc: s ? s.ruc : v("#tf-ruc").replace(/\D/g, ""), razon: v("#tf-razon"), representante: v("#tf-rep"), correo: v("#tf-correo"), telefono: v("#tf-tel"),
        sede: v("#tf-sede"), grupo: v("#tf-grupo"), trabajo: v("#tf-trabajo"), lugar: v("#tf-lugar"), inicio: v("#tf-ini"), fin: v("#tf-fin"),
        actividades: [...box.querySelectorAll(".acts input:checked")].map(i => i.value) };
      const m = [];
      if (!s && datos.ruc.length !== 11) m.push("El RUC debe tener 11 dígitos.");
      if (!s && datos.razon.length < 3) m.push("Escribe la razón social.");
      if (!s && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(datos.correo)) m.push("Escribe el correo de la empresa.");
      if (u.admin && !datos.sede) m.push("Elige la sede.");
      if (datos.trabajo.length < 10) m.push("Describe el trabajo a realizar.");
      if (!datos.inicio || !datos.fin) m.push("Indica las fechas de inicio y fin.");
      else if (datos.fin < datos.inicio) m.push("La fecha de fin debe ser igual o posterior a la de inicio.");
      if (!datos.actividades.length) m.push("Marca al menos una actividad.");
      const er = $("#tf-err");
      if (m.length) { er.innerHTML = m.map(esc).join("<br>"); er.hidden = false; return; }
      er.hidden = true; const b = $("#tf-go"), t = b.innerHTML; b.disabled = true; b.innerHTML = `<span class="spin"></span> Guardando…`;
      try {
        det = s ? await api("t_editar", { clave, id: s.id, datos }) : await api("t_crear", { clave, datos });
        vista = "detalle"; pintarDetalle(); window.scrollTo({ top: 0 });
        toast(s ? "Cambios guardados." : `Trabajo ${det.solicitud.id} registrado. Se envió un correo a la empresa.`);
        cargarLista(true);
      } catch (x) { b.disabled = false; b.innerHTML = t; er.textContent = x.message; er.hidden = false; }
    };
    window.scrollTo({ top: 0 });
  }
  async function ver(id) {
    const w = window.open("", "_blank");
    if (w) w.document.write("<p style='font-family:sans-serif'>Abriendo documento…</p>");
    try { window.fpAbrirArchivo(w, await api("t_archivo", { clave, archivo: id })); } catch (x) { if (w) w.close(); toast(x.message); }
  }
})();
