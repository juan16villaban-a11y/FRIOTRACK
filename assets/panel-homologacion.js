/* Panel SSOMA: módulo de homologación de contratistas */
(function () {
  const $ = s => document.querySelector(s);
  const esc = window.fpEsc, fmt = window.fpFecha, api = window.fpApi, nota = window.fpNota;
  const box = $("#mod-hom");
  let clave = "", lista = null, det = null, vista = "lista", filtro = { q: "", estado: "", sede: "" }, timer = null, cambios = false;
  const dias = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);

  document.addEventListener("fp:modulo", e => { if (e.detail === "hom" && vista === "lista") cargarLista(); });
  document.addEventListener("fp:login", e => { if ((window.fpUsuario || {}).solicitante) return; clave = e.detail; cargarLista(); clearInterval(timer); timer = setInterval(() => { if (!document.hidden && vista === "lista") cargarLista(true); }, 60000); });
  document.addEventListener("fp:logout", () => { clave = ""; lista = det = null; vista = "lista"; clearInterval(timer); box.innerHTML = ""; });

  /* ---------- Lista de empresas ---------- */
  async function cargarLista(silencio) {
    if (!clave) return;
    if (!silencio && !lista) box.innerHTML = `<div class="loading"><span class="spin"></span>Cargando empresas…</div>`;
    try { lista = await api("h_empresas", { clave }); }
    catch (x) { if (!silencio) box.innerHTML = `<div class="notice bad">${esc(x.message)}</div>`; return; }
    const pend = lista.empresas.filter(e => e.estadoActual === "En revisión" && e.puedeEvaluar).length;
    const bd = $("#badge-hom"); bd.textContent = pend; bd.hidden = !pend;
    if (vista === "lista" && !box.hidden) pintarLista();
  }
  function pintarLista() {
    const E = lista.empresas, cuenta = s => E.filter(e => e.estadoActual === s).length;
    const k = [["En revisión", "k-rev", "Por revisar"], ["Aprobado", "k-ok", "Aprobadas"], ["Aprobado con observaciones", "k-warn", "Con observaciones"],
      ["No aprobado", "k-bad", "No aprobadas"], ["Vencido", "k-bad", "Vencidas"], ["Registrada", "k-mute", "Registradas sin enviar"]];
    const u = lista.usuario || {};
    const filtradas = E.filter(e => (!filtro.estado || e.estadoActual === filtro.estado) && (!filtro.sede || e.sedes.indexOf(filtro.sede) >= 0 || e.sedeResponsable === filtro.sede) &&
      (!filtro.q || `${e.razon} ${e.ruc} ${e.actividad}`.toLowerCase().includes(filtro.q.toLowerCase())))
      .sort((a, b) => (a.estadoActual === "En revisión" ? 0 : 1) - (b.estadoActual === "En revisión" ? 0 : 1) || String(b.envio || b.registro).localeCompare(String(a.envio || a.registro)));
    box.innerHTML = `
      <div class="dash-head"><div><span class="eyebrow" style="color:var(--teal-ink)">Empresas contratistas${u.admin ? "" : " · Sede " + esc(u.sede)}</span><h1>Homologación</h1></div>
        <div class="actions"><button class="btn btn-ghost btn-sm" id="h-csv" type="button">Exportar a Excel</button><button class="btn btn-ghost btn-sm" id="h-act" type="button">Actualizar</button></div></div>
      <div class="kpis kpis6">${k.map(x => `<button type="button" class="kpi ${x[1]}" data-e="${esc(x[0])}" aria-pressed="${filtro.estado === x[0]}"><b>${cuenta(x[0])}</b><span>${x[2]}</span></button>`).join("")}</div>
      <div class="toolbar"><input class="inp" id="h-q" type="search" placeholder="Buscar por razón social, RUC o actividad" value="${esc(filtro.q)}" aria-label="Buscar">
        <select class="inp" id="h-est" aria-label="Estado"><option value="">Todos los estados</option>${k.map(x => `<option ${filtro.estado === x[0] ? "selected" : ""} value="${esc(x[0])}">${esc(window.fpEstadoHom(x[0])[1])}</option>`).join("")}</select>
        <select class="inp" id="h-sede" aria-label="Sede"><option value="">Todas las sedes</option>${(lista.sedes || []).map(x => `<option ${filtro.sede === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></div>
      ${u.admin ? "" : `<div class="hint">Ves las empresas que trabajan en tu sede. Solo evalúas aquellas donde tu sede es la responsable; las demás las puedes consultar.</div>`}
      <div class="count-s">${filtradas.length} de ${E.length} empresas</div>
      <div class="tablebox"><table><thead><tr><th>Empresa</th><th>Sedes</th><th>Estado</th><th>Puntaje</th><th>Documentos</th><th>Enviado</th><th>Vence</th><th></th></tr></thead><tbody>
      ${filtradas.length ? filtradas.map(e => { const st = window.fpEstadoHom(e.estadoActual); return `<tr>
        <td><b>${esc(e.razon)}</b><span class="sub">RUC ${esc(e.ruc)} · ${esc(e.actividad || "")}</span></td>
        <td>${e.sedes.map(x => x === e.sedeResponsable ? `<b title="Sede responsable">${esc(x)}</b>` : esc(x)).join(", ")}<span class="sub">${esc(e.grupo)}${e.clientes.length ? " · " + e.clientes.map(esc).join(", ") : ""}</span></td><td><span class="st ${st[0]}">${esc(st[1])}</span></td>
        <td class="num">${e.puntaje !== null && e.puntaje !== undefined && e.estadoActual !== "Registrada" && e.estadoActual !== "En revisión" ? nota(e.puntaje) + "%" : "—"}</td>
        <td class="num">${e.items} / ${e.total}</td><td class="num">${fmt(e.envio)}</td><td class="num">${e.vence ? fmt(e.vence) + venceSub(e.vence) : "—"}</td>
        <td><button class="btn ${e.estadoActual === "En revisión" && e.puedeEvaluar ? "btn-navy" : "btn-ghost"} btn-sm" data-ruc="${esc(e.ruc)}" type="button">${e.estadoActual === "En revisión" && e.puedeEvaluar ? "Revisar" : "Ver"}</button></td></tr>`; }).join("")
        : `<tr><td colspan="8" class="empty">${E.length ? "Ninguna empresa coincide con los filtros." : "Aún no hay empresas registradas. Comparte el enlace de homologación con tus contratistas."}</td></tr>`}
      </tbody></table></div>`;
    $("#h-q").oninput = e => { filtro.q = e.target.value; const pos = e.target.selectionStart; pintarLista(); const i = $("#h-q"); i.focus(); i.setSelectionRange(pos, pos); };
    $("#h-est").onchange = e => { filtro.estado = e.target.value; pintarLista(); };
    $("#h-sede").onchange = e => { filtro.sede = e.target.value; pintarLista(); };
    box.querySelectorAll(".kpi").forEach(b => b.onclick = () => { filtro.estado = filtro.estado === b.dataset.e ? "" : b.dataset.e; pintarLista(); });
    box.querySelectorAll("[data-ruc]").forEach(b => b.onclick = () => abrir(b.dataset.ruc));
    $("#h-act").onclick = () => cargarLista();
    $("#h-csv").onclick = () => exportar(filtradas);
  }
  function exportar(E) {
    const cols = ["RUC", "Razón social", "Actividad", "Servicio a", "Sede responsable", "Sedes", "Clientes", "Representante", "Cargo", "Correo", "Teléfono", "Estado", "Puntaje (%)", "Documentos", "Registro", "Enviado", "Evaluado", "Evaluador", "Vence", "Motivo del vencimiento"];
    const q = v => { v = String(v == null ? "" : v); return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
    const filas = E.map(e => [e.ruc, e.razon, e.actividad, e.grupo, e.sedeResponsable, e.sedes.join(", "), e.clientes.join(", "), e.representante, e.cargo, e.correo, e.telefono, window.fpEstadoHom(e.estadoActual)[1],
      e.puntaje === null ? "" : String(e.puntaje).replace(".", ","), e.items + "/" + e.total, fmt(e.registro), fmt(e.envio), fmt(e.evaluacion), e.evaluador, fmt(e.vence), e.venceMotivo].map(q).join(";"));
    const blob = new Blob(["﻿" + [cols.join(";")].concat(filas).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `Homologacion_contratistas_${lista.hoy}.csv`; document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------- Evaluación de una empresa ---------- */
  async function abrir(ruc) {
    vista = "detalle"; cambios = false;
    box.innerHTML = `<div class="loading"><span class="spin"></span>Cargando expediente…</div>`;
    try { det = await api("h_detalle", { clave, ruc }); pintarDetalle(); window.scrollTo({ top: 0 }); }
    catch (x) { box.innerHTML = `<div class="notice bad">${esc(x.message)}</div>`; }
  }
  function volver() {
    if (cambios && !confirmarSalida()) return;
    vista = "lista"; det = null; pintarLista(); cargarLista(true);
  }
  let avisoSalida = 0;
  function confirmarSalida() {
    if (Date.now() - avisoSalida < 5000) return true;
    avisoSalida = Date.now(); toast("Tienes cambios sin guardar. Pulsa «Volver» otra vez para salir sin guardar.");
    return false;
  }
  function puntaje(evals) {
    const sec = {};
    det.requisitos.filter(q => !q.cliente).forEach(q => {
      const s = sec[q.seccion] = sec[q.seccion] || { peso: q.peso, aplica: 0, cumple: 0, pend: 0 };
      const v = evals[q.item] && evals[q.item].resultado;
      if (v === "N/A") return;
      if (!v) s.pend++;
      s.aplica++; if (v === "Cumple") s.cumple++;
    });
    let total = 0, pend = 0;
    Object.values(sec).forEach(s => { s.p = s.aplica ? s.peso * s.cumple / s.aplica : s.peso; total += s.p; pend += s.pend; });
    const pendCli = det.requisitos.filter(q => q.cliente && !(evals[q.item] || {}).resultado).length;
    return { total: Math.round(total * 10) / 10, sec, pend: pend + pendCli, pendCli };
  }
  const resultado = p => p >= 95 ? "Aprobado" : p >= 90 ? "Aprobado con observaciones" : "No aprobado";
  function evalsActuales() {
    const ev = {};
    det.requisitos.forEach(q => {
      const r = box.querySelector(`input[name="r-${CSS.escape(q.item)}"]:checked`), o = box.querySelector(`[data-obs="${CSS.escape(q.item)}"]`);
      ev[q.item] = { resultado: r ? r.value : "", obs: o ? o.value.trim() : "" };
    });
    return ev;
  }
  function venceSub(v) {
    const d = dias((lista || det).hoy, v);
    return `<span class="sub" style="color:${d < 0 ? "var(--bad)" : d <= 30 ? "var(--warn)" : "inherit"}">${d < 0 ? "venció hace " + (-d) + " d" : d === 0 ? "vence hoy" : "en " + d + " días"}</span>`;
  }
  function seccionesDe(reqs) {
    const secs = []; reqs.forEach(q => { let s = secs.find(x => x.nombre === q.seccion); if (!s) secs.push(s = { nombre: q.seccion, peso: q.peso, cliente: q.cliente, items: [] }); s.items.push(q); });
    return secs;
  }
  function pintarDetalle() {
    const e = det.empresa, st = window.fpEstadoHom(e.estadoActual), puede = det.puedeEvaluar;
    const secs = seccionesDe(det.requisitos), ev = det.evaluacion, dis = puede ? "" : "disabled";
    const venc = e.vence ? `${fmt(e.vence)}${e.venceMotivo ? " · " + esc(e.venceMotivo) : ""}` : "";
    const trab = det.trabajadores || [];
    box.innerHTML = `
      <div class="ev-head"><button class="ev-back" id="ev-back" type="button">← Volver a la lista</button>
        <div class="dash-head"><div><span class="st ${st[0]}">${esc(st[1])}</span><h1 style="margin-top:8px">${esc(e.razon)}</h1></div>
        <div class="actions"><button class="btn btn-ghost btn-sm" id="ev-pdf" type="button">Descargar lista de verificación (PDF)</button></div></div>
        ${puede ? "" : `<div class="notice warn"><span><b>Solo consulta.</b> Esta empresa la evalúa la sede <b>${esc(e.sedeResponsable)}</b>. Puedes revisar sus documentos y su personal.</span></div>`}
        <dl class="ev-info"><div><dt>RUC</dt><dd>${esc(e.ruc)}</dd></div><div><dt>Actividad</dt><dd>${esc(e.actividad)}</dd></div>
          <div><dt>Representante</dt><dd>${esc(e.representante)} · ${esc(e.cargo)}</dd></div><div><dt>Contacto</dt><dd>${esc(e.correo)} · ${esc(e.telefono)}</dd></div>
          <div><dt>Trabajadores en planilla</dt><dd>${esc(e.trabajadores)} ${Number(e.trabajadores) > 20 ? "(aplica RISST y Comité)" : Number(e.trabajadores) ? "(aplica Manual y Supervisor SST)" : ""}</dd></div>
          <div><dt>Servicio a</dt><dd>${esc(e.grupo)}</dd></div>
          <div><dt>Sede responsable</dt><dd>${esc(e.sedeResponsable)}</dd></div><div><dt>Trabaja en</dt><dd>${e.sedes.map(esc).join(", ")}</dd></div>
          <div><dt>Clientes</dt><dd>${e.clientes.length ? e.clientes.map(esc).join(", ") : "—"}</dd></div>
          <div><dt>Enviado a revisión</dt><dd>${fmt(e.envio)}</dd></div>
          ${e.evaluacion ? `<div><dt>Última evaluación</dt><dd>${fmt(e.evaluacion)} · ${esc(e.evaluador)}</dd></div>` : ""}
          ${venc ? `<div><dt>Vence homologación</dt><dd>${venc}</dd></div>` : ""}</dl></div>
      <div class="ev-grid"><div class="secs">${secs.map(s => `<section class="sec${s.cliente ? " sec-cli" : ""}"><div class="sec-h" style="cursor:default"><h3>${esc(s.nombre)} <span class="n">${s.cliente ? "(no suma al puntaje)" : "(" + s.peso + "%)"}</span></h3>
          <span class="n">${s.items.filter(q => det.archivos.some(a => a.item === q.item)).length} de ${s.items.length} con documento</span></div>
          <div>${s.items.map(q => { const v = ev[q.item] || {}, arch = det.archivos.filter(a => a.item === q.item); return `<div class="ev-it ${v.resultado ? "" : "pend"}" data-item="${esc(q.item)}">
            <span class="no">${esc(q.item)}</span>
            <div class="body" style="display:flex;flex-direction:column;gap:8px;min-width:0"><span class="rq" style="font-weight:600">${esc(q.requisito)}${q.vence ? ` <span class="gtag">con vencimiento</span>` : ""}</span><span class="doc hint">Documento: ${esc(q.documento)}</span>
              ${arch.length ? `<ul class="files">${arch.map(a => `<li><span class="fn" title="${esc(a.nombre)}">${esc(a.nombre)}</span><span class="fm">${Math.max(1, Math.round(a.kb))} KB · ${fmt(String(a.fecha).slice(0, 10))}${a.vence ? ` · <b style="color:${a.vence < det.hoy ? "var(--bad)" : dias(det.hoy, a.vence) <= 30 ? "var(--warn)" : "inherit"}">vence ${fmt(a.vence)}</b>` : ""}</span><button type="button" data-ver="${esc(a.id)}">Ver</button></li>`).join("")}</ul>` : `<span class="nofile">Sin documento cargado</span>`}
              <div class="ctl"><span class="seg3" role="radiogroup" aria-label="Resultado del ítem ${esc(q.item)}">
                ${[["Cumple", "c"], ["No cumple", "n"], ["N/A", "a"]].map(([t, c]) => `<label class="${c}"><input type="radio" name="r-${esc(q.item)}" value="${t}" ${v.resultado === t ? "checked" : ""} ${dis}>${t}</label>`).join("")}</span>
                <textarea class="inp" data-obs="${esc(q.item)}" placeholder="Observación (la verá la empresa)" aria-label="Observación del ítem ${esc(q.item)}" ${dis}>${esc(v.obs || "")}</textarea></div></div></div>`; }).join("")}</div></section>`).join("")}
          <section class="sec"><div class="sec-h" style="cursor:default"><h3>Personal de la empresa</h3><span class="n">${trab.filter(t => t.habilitado).length} de ${trab.length} habilitados</span></div>
            ${trab.length ? `<div class="tablebox" style="border:0;border-radius:0"><table style="min-width:640px"><thead><tr><th>Trabajador</th><th>Sede</th><th>Inducción vence</th><th>Estado</th></tr></thead><tbody>
            ${trab.map(t => `<tr><td><b>${esc(t.nombre)}</b><span class="sub">${esc(t.dni)} · ${esc(t.cargo)}</span></td><td>${esc(t.sede || "—")}</td><td class="num">${t.induccionVence ? fmt(t.induccionVence) : "—"}</td>
              <td>${t.habilitado ? `<span class="pill p-vigente">Habilitado</span><span class="sub">hasta ${fmt(t.hasta)}</span>` : `<span class="pill p-vencido">No habilitado</span><span class="sub">${t.motivos.map(esc).join(" · ")}</span>`}</td></tr>`).join("")}</tbody></table></div>`
            : `<div class="empty">Aún nadie de esta empresa ha rendido la inducción con este RUC.</div>`}</section></div>
        <aside class="ev-side"><div class="ev-score" id="ev-score"></div>
          ${Object.keys(det.clientesEstado || {}).length ? `<div class="ev-score"><b style="color:var(--navy)">Requisitos de clientes</b>${Object.entries(det.clientesEstado).map(([c, x]) => `<div class="r" style="display:flex;justify-content:space-between;gap:8px;font-size:13.5px"><span>${esc(c)}</span><span class="st ${x.estado === "Cumple" ? "st-aprobado" : x.estado === "No cumple" ? "st-no" : "st-registrada"}">${esc(x.estado)}</span></div>`).join("")}<span class="hint">Se evalúan aparte y no cambian el puntaje.</span></div>` : ""}
          ${puede ? `<div class="ev-score">
            <button class="btn btn-ghost" id="ev-sin" type="button">Ítems sin documento → No cumple</button>
            <button class="btn btn-ghost" id="ev-guardar" type="button">Guardar avance</button>
            <button class="btn btn-navy" id="ev-fin" type="button">Finalizar y notificar a la empresa</button>
            <span class="err" id="ev-err" role="alert" hidden></span><span class="hint">Evalúas como <b>${esc(det.usuario.nombre)}</b>. Al finalizar se calcula el resultado y la fecha de vencimiento, y se avisa a la empresa por correo.</span></div>
          <details class="ev-score asig"><summary><b>Sedes y clientes</b></summary>
            <fieldset class="checks"><legend>Sedes donde trabaja</legend><div class="checkrow">${det.sedes.map(x => `<label><input type="checkbox" name="as-sede" value="${esc(x)}" ${e.sedes.indexOf(x) >= 0 ? "checked" : ""}>${esc(x)}</label>`).join("")}</div></fieldset>
            <div class="field"><label for="as-resp">Sede responsable de evaluar</label><select class="inp" id="as-resp">${det.sedes.map(x => `<option ${x === e.sedeResponsable ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></div>
            <fieldset class="checks"><legend>Clientes atendidos (agregan requisitos)</legend>${(det.clientesCatalogo || []).length ? `<div class="checkrow">${det.clientesCatalogo.map(x => `<label><input type="checkbox" name="as-cli" value="${esc(x)}" ${e.clientes.indexOf(x) >= 0 ? "checked" : ""}>${esc(x)}</label>`).join("")}</div>` : `<span class="hint">Agrega clientes en la hoja <b>Clientes</b> y sus requisitos en <b>Homologación - Requisitos</b> (columna Cliente).</span>`}</fieldset>
            <button class="btn btn-ghost" id="as-go" type="button">Guardar asignación</button><span class="err" id="as-err" role="alert" hidden></span></details>` : ""}</aside></div>`;
    $("#ev-back").onclick = volver;
    box.querySelectorAll("[data-ver]").forEach(b => b.onclick = () => ver(b.dataset.ver));
    box.querySelectorAll(".ev-it input, .ev-it textarea").forEach(i => i.addEventListener(i.tagName === "TEXTAREA" ? "input" : "change", () => { cambios = true; marcador(); }));
    $("#ev-pdf").onclick = () => pdf();
    if (puede) {
      $("#ev-sin").onclick = () => { det.requisitos.forEach(q => { if (!det.archivos.some(a => a.item === q.item) && !box.querySelector(`input[name="r-${CSS.escape(q.item)}"]:checked`)) { const r = box.querySelector(`input[name="r-${CSS.escape(q.item)}"][value="No cumple"]`); r.checked = true; const o = box.querySelector(`[data-obs="${CSS.escape(q.item)}"]`); if (!o.value) o.value = "No presentó el documento."; } }); cambios = true; marcador(); };
      $("#ev-guardar").onclick = () => guardar(false);
      $("#ev-fin").onclick = () => guardar(true);
      $("#as-go").onclick = asignar;
    }
    marcador();
  }
  async function asignar() {
    const er = $("#as-err"); er.hidden = true;
    const sedes = [...box.querySelectorAll("input[name=as-sede]:checked")].map(i => i.value);
    if (!sedes.length) { er.textContent = "Marca al menos una sede."; er.hidden = false; return; }
    if (cambios) { er.textContent = "Guarda primero el avance de la evaluación."; er.hidden = false; return; }
    const b = $("#as-go"); b.disabled = true;
    try {
      det = await api("h_asignar", { clave, ruc: det.empresa.ruc, datos: { sedes, sedeResponsable: $("#as-resp").value, clientes: [...box.querySelectorAll("input[name=as-cli]:checked")].map(i => i.value) } });
      pintarDetalle(); toast("Asignación guardada."); cargarLista(true);
    } catch (x) { b.disabled = false; er.textContent = x.message; er.hidden = false; }
  }
  function marcador() {
    const ev = evalsActuales(), p = puntaje(ev), r = resultado(p.total), st = window.fpEstadoHom(r);
    box.querySelectorAll(".ev-it").forEach(d => d.classList.toggle("pend", !(ev[d.dataset.item] || {}).resultado));
    $("#ev-score").innerHTML = `<span class="hint">Puntaje obtenido</span><span class="big">${nota(p.total)}%</span>
      <span class="st ${st[0]}" style="align-self:flex-start">${p.pend ? "Resultado parcial: " : ""}${esc(st[1])}</span>
      ${p.pend ? `<span class="hint">Faltan <b>${p.pend}</b> ítems por calificar${p.pendCli ? ` (${p.pendCli} de clientes)` : ""}.</span>` : ""}
      <div class="rows">${Object.entries(p.sec).map(([n, s]) => `<div class="r"><span>${esc(n)}</span><span>${nota(Math.round(s.p * 10) / 10)} / ${s.peso}</span><span class="b"><i style="width:${s.peso ? s.p / s.peso * 100 : 0}%"></i></span></div>`).join("")}</div>
      <span class="hint">95–100% Aprobado · 90–94% Con observaciones · &lt;90% No aprobado</span>`;
  }
  async function guardar(finalizar) {
    const er = $("#ev-err");
    er.hidden = true;
    const ev = evalsActuales();
    if (finalizar) {
      const p = puntaje(ev);
      if (p.pend) { er.textContent = `Faltan ${p.pend} ítems por calificar.`; er.hidden = false; const f = box.querySelector(".ev-it.pend"); if (f) f.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
      const sinObs = det.requisitos.filter(q => ev[q.item].resultado === "No cumple" && !ev[q.item].obs);
      if (sinObs.length) { er.textContent = `Escribe la observación de los ítems que no cumplen (${sinObs.map(q => q.item).join(", ")}).`; er.hidden = false; return; }
    }
    const b = finalizar ? $("#ev-fin") : $("#ev-guardar"), t = b.innerHTML; b.disabled = true; b.innerHTML = `<span class="spin"></span> Guardando…`;
    try {
      det = await api("h_evaluar", { clave, ruc: det.empresa.ruc, finalizar, lista: det.requisitos.map(q => ({ item: q.item, resultado: ev[q.item].resultado, obs: ev[q.item].obs })) });
      cambios = false; pintarDetalle();
      toast(finalizar ? `Evaluación finalizada: ${det.empresa.estado} (${nota(det.empresa.puntaje)}%)${det.empresa.vence ? ", vence " + fmt(det.empresa.vence) : ""}. Se notificó a la empresa.` : "Avance guardado.");
      cargarLista(true);
    } catch (x) { b.disabled = false; b.innerHTML = t; er.textContent = x.message; er.hidden = false; }
  }
  async function ver(id) {
    const w = window.open("", "_blank");
    if (w) w.document.write("<p style='font-family:sans-serif'>Abriendo documento…</p>");
    try { window.fpAbrirArchivo(w, await api("h_archivo", { clave, id })); } catch (x) { if (w) w.close(); toast(x.message); }
  }
  let tt = null;
  function toast(m) { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => t.hidden = true, 6000); }

  /* ---------- Lista de verificación FP-SIG-R4-P001 en PDF ---------- */
  function pdf() {
    if (!window.jspdf) return toast("No se pudo preparar el PDF. Recarga la página.");
    const { jsPDF } = window.jspdf, d = new jsPDF({ unit: "mm", format: "a4" });
    const e = det.empresa, ev = evalsActuales(), p = puntaje(ev), W = 210, M = 12, CW = W - 2 * M;
    const NAVY = [10, 30, 99]; let y = 14;
    const nuevaPag = () => { d.addPage(); y = 14; };
    const caja = (x, yy, w, h, fill) => { if (fill) { d.setFillColor(...fill); d.rect(x, yy, w, h, "F"); } d.setDrawColor(180, 186, 200); d.setLineWidth(0.2); d.rect(x, yy, w, h, "S"); };
    d.setFont("helvetica", "bold"); d.setFontSize(10.5); d.setTextColor(...NAVY);
    d.text(d.splitTextToSize("LISTA DE VERIFICACIÓN DEL SISTEMA DE GESTIÓN DE SEGURIDAD, SALUD OCUPACIONAL Y MEDIO AMBIENTE (SSOMA) – CONTRATISTAS", 140), M, y);
    d.setFont("helvetica", "normal"); d.setFontSize(8); d.setTextColor(60, 60, 70);
    d.text(["Código: FP-SIG-R4-P001", "Edición: 2026 · Versión: 00"], W - M, y - 1, { align: "right" }); y += 13;
    const datosE = [["Razón social", e.razon], ["RUC", e.ruc], ["Actividad", e.actividad], ["Representante", e.representante], ["Cargo", e.cargo],
      ["Fecha de entrega", fmt(e.envio)], ["Evaluador", e.evaluador || (det.usuario || {}).nombre || ""], ["Fecha de evaluación", fmt(e.evaluacion || det.hoy)]];
    d.setFontSize(8);
    for (let i = 0; i < datosE.length; i += 2) {
      [0, 1].forEach(j => { const it = datosE[i + j]; if (!it) return; const x = M + j * CW / 2; caja(x, y, 34, 6, [238, 241, 247]); caja(x + 34, y, CW / 2 - 34, 6);
        d.setFont("helvetica", "bold"); d.setTextColor(...NAVY); d.text(it[0], x + 1.5, y + 4); d.setFont("helvetica", "normal"); d.setTextColor(30, 30, 30); d.text(String(it[1] || "").slice(0, 60), x + 35.5, y + 4); });
      y += 6;
    }
    y += 4;
    const res = resultado(p.total);
    caja(M, y, CW, 9, [238, 241, 247]); d.setFont("helvetica", "bold"); d.setFontSize(10); d.setTextColor(...NAVY);
    d.text(`PUNTAJE OBTENIDO: ${nota(p.total)}%   ·   RESULTADO: ${p.pend ? "EVALUACIÓN INCOMPLETA" : res.toUpperCase()}`, M + 3, y + 6); y += 13;
    const cols = [12, 52, 52, 10, 10, 10, CW - 146];  // ítem, requisito, documento, C, NC, NA, observación
    const heads = ["Ítem", "Requisito", "Documento", "C", "NC", "N/A", "Observación"];
    const secs = seccionesDe(det.requisitos);
    secs.forEach(s => {
      if (y > 260) nuevaPag();
      d.setFillColor(...NAVY); d.rect(M, y, CW, 6.5, "F"); d.setTextColor(255, 255, 255); d.setFont("helvetica", "bold"); d.setFontSize(8.5);
      d.text(s.cliente ? `${s.nombre.toUpperCase()} (NO SUMA AL PUNTAJE)` : `${s.nombre.toUpperCase()} (${s.peso}%)`, M + 2, y + 4.5); y += 6.5;
      let x = M; d.setFontSize(7.5); heads.forEach((h, i) => { caja(x, y, cols[i], 5.5, [238, 241, 247]); d.setTextColor(...NAVY); d.text(h, x + cols[i] / 2, y + 3.8, { align: "center" }); x += cols[i]; }); y += 5.5;
      d.setFont("helvetica", "normal"); d.setFontSize(7.2);
      s.items.forEach(q => {
        const v = ev[q.item] || {}, txt = [[q.item], d.splitTextToSize(q.requisito, cols[1] - 2), d.splitTextToSize(q.documento, cols[2] - 2), [], [], [], d.splitTextToSize(v.obs || "", cols[6] - 2)];
        const h = Math.max(6, ...txt.map(t => t.length * 3.1 + 2.2));
        if (y + h > 285) nuevaPag();
        let x = M; txt.forEach((t, i) => { caja(x, y, cols[i], h); d.setTextColor(30, 30, 30); if (t.length) d.text(t, x + 1, y + 3.6); x += cols[i]; });
        const mark = { "Cumple": 3, "No cumple": 4, "N/A": 5 }[v.resultado];
        if (mark) { let mx = M; for (let i = 0; i < mark; i++) mx += cols[i]; d.setFont("helvetica", "bold"); d.setFontSize(10); d.text("X", mx + cols[mark] / 2, y + h / 2 + 1.5, { align: "center" }); d.setFont("helvetica", "normal"); d.setFontSize(7.2); }
        y += h;
      });
      if (s.cliente) { y += 4; return; }
      const ps = p.sec[s.nombre]; caja(M, y, CW, 5.5, [247, 248, 251]); d.setFont("helvetica", "bold"); d.setTextColor(...NAVY);
      d.text(`PUNTAJE: ${ps ? nota(Math.round(ps.p * 10) / 10) : 0} de ${s.peso}`, W - M - 2, y + 3.8, { align: "right" }); d.setFont("helvetica", "normal"); y += 9;
    });
    if (y > 250) nuevaPag();
    d.setFontSize(8); d.setTextColor(30, 30, 30);
    d.text(["Escala: 95% - 100% Aprobado (puede trabajar sin restricciones) · 90% - 94% Aprobado con observaciones (levantar en 3 días)",
      "· < 90% No aprobado (no puede iniciar ni continuar actividades hasta regularizar).",
      "“La aprobación no exime de fiscalización en campo ni de cumplimiento legal vigente.”"], M, y); y += 22;
    d.line(M + 10, y, M + 75, y); d.line(W - M - 75, y, W - M - 10, y);
    d.text("Firma del evaluador SSOMA", M + 42.5, y + 4, { align: "center" }); d.text("Firma del representante de la contratista", W - M - 42.5, y + 4, { align: "center" });
    d.save(`FP-SIG-R4-P001_${e.ruc}_${(e.razon || "").replace(/[^A-Za-z0-9]+/g, "_").slice(0, 40)}.pdf`);
  }
})();
