/* Panel SSOMA: personal habilitado y personal vetado */
(function () {
  const $ = s => document.querySelector(s);
  const esc = window.fpEsc, fmt = window.fpFecha, api = window.fpApi;
  const boxH = $("#mod-hab"), boxV = $("#mod-vet");
  let clave = "", hab = null, vet = null, fh = { q: "", estado: "", sede: "", empresa: "", tipo: "" }, fv = { q: "", estado: "activos" }, prefill = null;
  const dias = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);
  const usuario = () => window.fpUsuario || {};
  let tt = null;
  function toast(m) { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => t.hidden = true, 6000); }
  const csv = (nombre, cols, filas) => {
    const q = v => { v = String(v == null ? "" : v); return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
    const blob = new Blob(["﻿" + [cols.join(";")].concat(filas.map(f => f.map(q).join(";"))).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  };

  document.addEventListener("fp:login", e => { if ((window.fpUsuario || {}).solicitante) return; clave = e.detail; cargarVet(true); });
  document.addEventListener("fp:logout", () => { clave = ""; hab = vet = null; boxH.innerHTML = boxV.innerHTML = ""; });
  document.addEventListener("fp:modulo", e => { if (e.detail === "hab") cargarHab(); if (e.detail === "vet") cargarVet(); });

  /* ================= PERSONAL HABILITADO ================= */
  async function cargarHab() {
    if (!clave) return;
    if (!hab) boxH.innerHTML = `<div class="loading"><span class="spin"></span>Cargando personal…</div>`;
    try { hab = await api("habilitados", { clave }); pintarHab(); }
    catch (x) { boxH.innerHTML = `<div class="notice bad">${esc(x.message)}</div>`; }
  }
  const estadoH = t => t.vetado ? "vetado" : !t.habilitado ? "no" : dias(hab.hoy, t.hasta) <= 30 ? "pronto" : "ok";
  function pintarHab() {
    const T = hab.trabajadores, u = hab.usuario || {};
    const c = { ok: 0, pronto: 0, no: 0, vetado: 0 }; T.forEach(t => c[estadoH(t)]++);
    const empresas = [...new Set(T.map(t => t.empresa))].sort((a, b) => String(a).localeCompare(String(b), "es"));
    const L = T.filter(t => (!fh.estado || estadoH(t) === fh.estado || (fh.estado === "hab" && t.habilitado)) && (!fh.sede || t.sede === fh.sede || t.empresaSedes.indexOf(fh.sede) >= 0)
      && (!fh.empresa || t.empresa === fh.empresa) && (!fh.tipo || t.tipo === fh.tipo) && (!fh.q || `${t.nombre} ${t.dni} ${t.empresa} ${t.ruc}`.toLowerCase().includes(fh.q.toLowerCase())));
    boxH.innerHTML = `
      <div class="dash-head"><div><span class="eyebrow" style="color:var(--teal-ink)">Control de ingreso${u.admin ? "" : " · Sede " + esc(u.sede)}</span><h1>Personal habilitado</h1></div>
        <div class="actions"><button class="btn btn-ghost btn-sm" id="p-csv" type="button">Exportar a Excel</button><button class="btn btn-ghost btn-sm" id="p-act" type="button">Actualizar</button></div></div>
      <div class="notice"><span><b>Contratistas:</b> inducción vigente + empresa homologada <b>o</b> autorización de trabajo vigente que los incluya + sin veto. <b>Visitantes y transportistas:</b> inducción vigente + sin veto. La habilitación dura hasta la fecha que venza primero.</span></div>
      <div class="kpis">${[["hab", "k-ok", c.ok + c.pronto, "Habilitados"], ["pronto", "k-warn", c.pronto, "Habilitación vence en 30 días"], ["no", "k-mute", c.no, "No habilitados"], ["vetado", "k-bad", c.vetado, "Vetados"]]
        .map(k => `<button type="button" class="kpi ${k[1]}" data-e="${k[0]}" aria-pressed="${fh.estado === k[0]}"><b>${k[2]}</b><span>${k[3]}</span></button>`).join("")}</div>
      <div class="toolbar"><input class="inp" id="p-q" type="search" placeholder="Buscar por nombre, DNI, empresa o RUC" value="${esc(fh.q)}" aria-label="Buscar">
        <select class="inp" id="p-est" aria-label="Estado"><option value="">Todos</option>${[["hab", "Habilitados"], ["pronto", "Vencen en 30 días"], ["no", "No habilitados"], ["vetado", "Vetados"]].map(o => `<option value="${o[0]}" ${fh.estado === o[0] ? "selected" : ""}>${o[1]}</option>`).join("")}</select>
        <select class="inp" id="p-sede" aria-label="Sede"><option value="">Todas las sedes</option>${(u.sedes || []).map(x => `<option ${fh.sede === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select>
        <select class="inp" id="p-tipo" aria-label="Tipo"><option value="">Todos los tipos</option>${["Contratista", "Visitante", "Transportista"].map(x => `<option ${fh.tipo === x ? "selected" : ""}>${x}</option>`).join("")}</select>
        <select class="inp" id="p-emp" aria-label="Empresa"><option value="">Todas las empresas</option>${empresas.map(x => `<option ${fh.empresa === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></div>
      <div class="count-s">${L.length} de ${T.length} personas</div>
      <div class="tablebox"><table><thead><tr><th>Persona</th><th>Empresa</th><th>Sede</th><th>Inducción</th><th>Habilita por</th><th>Estado</th><th></th></tr></thead><tbody>
      ${L.length ? L.map(t => { const e = estadoH(t), h = window.fpEstadoHom(t.empresaEstado); return `<tr>
        <td><b>${esc(t.nombre)}</b><span class="sub">${esc(t.dni)} · ${esc(t.cargo)}${t.placa ? " · " + esc(t.placa) : ""}</span>${t.tipo !== "Contratista" ? `<span class="gtag">${esc(t.tipo)}</span>` : ""}</td>
        <td>${esc(t.empresa)}<span class="sub">${t.ruc ? "RUC " + esc(t.ruc) : "Sin RUC"}</span></td>
        <td>${esc(t.sede || "—")}<span class="sub">${esc(t.grupo)}</span></td>
        <td class="num">${t.induccionVence ? fmt(t.induccionVence) + `<span class="sub">${t.induccionVence < hab.hoy ? "vencida" : "vigente"}</span>` : "—"}</td>
        <td>${t.tipo !== "Contratista" ? `<span class="sub">Solo inducción</span>` : /^Autorización/.test(t.via) ? `<span class="st st-aprobado">${esc(t.via)}</span><span class="sub">trabajo en sede</span>` : `<span class="st ${h[0]}">${esc(h[1])}</span>${t.empresaVence ? `<span class="sub">vence ${fmt(t.empresaVence)}</span>` : ""}`}</td>
        <td>${t.habilitado ? `<span class="pill ${e === "pronto" ? "p-porvencer" : "p-vigente"}">Habilitado</span><span class="sub">hasta ${fmt(t.hasta)}${e === "pronto" ? " · en " + dias(hab.hoy, t.hasta) + " d" : ""}</span>`
          : `<span class="pill ${t.vetado ? "p-vencido" : "p-desaprobado"}">${t.vetado ? "Vetado" : "No habilitado"}</span><span class="sub motivos">${t.motivos.map(esc).join("<br>")}</span>`}</td>
        <td>${t.vetado ? "" : `<button class="btn btn-ghost btn-sm" type="button" data-vetar="${esc(t.dni)}">Vetar</button>`}</td></tr>`; }).join("")
        : `<tr><td colspan="7" class="empty">${T.length ? "Nadie coincide con los filtros." : "Aún no hay personal con inducción."}</td></tr>`}
      </tbody></table></div>`;
    const re = () => pintarHab();
    $("#p-q").oninput = e => { fh.q = e.target.value; const pos = e.target.selectionStart; re(); const i = $("#p-q"); i.focus(); i.setSelectionRange(pos, pos); };
    $("#p-est").onchange = e => { fh.estado = e.target.value; re(); };
    $("#p-sede").onchange = e => { fh.sede = e.target.value; re(); };
    $("#p-emp").onchange = e => { fh.empresa = e.target.value; re(); };
    $("#p-tipo").onchange = e => { fh.tipo = e.target.value; re(); };
    boxH.querySelectorAll(".kpi").forEach(b => b.onclick = () => { fh.estado = fh.estado === b.dataset.e ? "" : b.dataset.e; re(); });
    $("#p-act").onclick = () => cargarHab();
    $("#p-csv").onclick = () => csv(`Personal_habilitado_${hab.hoy}.csv`,
      ["Tipo", "Nombres y apellidos", "DNI / CE", "Cargo", "Placa", "Empresa", "RUC", "Sede", "Empresa del grupo", "Inducción vence", "Habilita por", "Homologación", "Homologación vence", "Estado", "Habilitado hasta", "Motivos"],
      L.map(t => [t.tipo, t.nombre, t.dni, t.cargo, t.placa, t.empresa, t.ruc, t.sede, t.grupo, fmt(t.induccionVence), t.via, t.empresaEstado, fmt(t.empresaVence), t.vetado ? "Vetado" : t.habilitado ? "Habilitado" : "No habilitado", fmt(t.hasta), t.motivos.join(" / ")]));
    boxH.querySelectorAll("[data-vetar]").forEach(b => b.onclick = () => {
      const t = T.find(x => x.dni === b.dataset.vetar); prefill = { dni: t.dni, nombre: t.nombre, empresa: t.empresa, ruc: t.ruc };
      document.querySelector('.modtabs button[data-mod="vet"]').click();
    });
  }

  /* ================= VETADOS ================= */
  async function cargarVet(silencio) {
    if (!clave) return;
    if (!silencio && !vet) boxV.innerHTML = `<div class="loading"><span class="spin"></span>Cargando…</div>`;
    try { vet = await api("v_lista", { clave }); badge(); if (!boxV.hidden) pintarVet(); }
    catch (x) { if (!silencio) boxV.innerHTML = `<div class="notice bad">${esc(x.message)}</div>`; }
  }
  function badge() { const n = vet.vetados.filter(v => v.activo).length, b = $("#badge-vet"); b.textContent = n; b.hidden = !n; }
  function pintarVet() {
    const u = vet.usuario || {}, V = vet.vetados, p = prefill || {};
    const L = V.filter(v => (fv.estado === "todos" || (fv.estado === "activos" ? v.activo : !v.activo)) &&
      (!fv.q || `${v.nombre} ${v.dni} ${v.empresa}`.toLowerCase().includes(fv.q.toLowerCase())));
    boxV.innerHTML = `
      <div class="dash-head"><div><span class="eyebrow" style="color:var(--teal-ink)">Restricción de ingreso</span><h1>Personal vetado</h1></div>
        <div class="actions"><button class="btn btn-ghost btn-sm" id="v-csv" type="button">Exportar a Excel</button></div></div>
      <div class="vet-grid">
        <form class="box" id="v-form" novalidate><h2>Registrar veto</h2>
          <p class="hint">El veto aplica en <b>todo el grupo</b>: la persona no podrá rendir la inducción ni figurar como habilitada. El motivo es interno; el trabajador solo verá «Comunícate con el área SSOMA».</p>
          <div class="grid2">
            <div class="field"><label for="v-dni">DNI / CE</label><input class="inp" id="v-dni" maxlength="12" value="${esc(p.dni || "")}"></div>
            <div class="field"><label for="v-nom">Nombres y apellidos</label><input class="inp" id="v-nom" value="${esc(p.nombre || "")}"></div>
            <div class="field"><label for="v-emp">Empresa</label><input class="inp" id="v-emp" value="${esc(p.empresa || "")}"></div>
            <div class="field"><label for="v-ruc">RUC (opcional)</label><input class="inp" id="v-ruc" inputmode="numeric" maxlength="11" value="${esc(p.ruc || "")}"></div>
            <div class="field"><label for="v-hasta">Vigente hasta</label><input class="inp" id="v-hasta" type="date" min="${esc(vet.hoy)}"><span class="hint">Déjalo vacío para un veto permanente.</span></div>
            <div class="field"><label for="v-sede">Sede que veta</label>${u.admin ? `<select class="inp" id="v-sede"><option value="">Todas (administrador)</option>${(u.sedes || []).map(x => `<option>${esc(x)}</option>`).join("")}</select>` : `<input class="inp" id="v-sede" value="${esc(u.sede)}" disabled>`}</div>
          </div>
          <div class="field"><label for="v-mot">Motivo (interno)</label><textarea class="inp" id="v-mot" rows="3" placeholder="Ej. Incumplió el bloqueo LOTO en la cámara 3 el 12/10/2026"></textarea></div>
          <span class="err" id="v-err" role="alert" hidden></span>
          <button class="btn btn-navy" id="v-go" type="submit">Registrar veto</button>
        </form>
        <div style="display:flex;flex-direction:column;gap:12px;min-width:0">
          <div class="toolbar"><input class="inp" id="v-q" type="search" placeholder="Buscar por nombre, DNI o empresa" value="${esc(fv.q)}" aria-label="Buscar">
            <div class="seg" role="tablist">${[["activos", "Activos"], ["levantados", "Levantados"], ["todos", "Todos"]].map(o => `<button type="button" role="tab" data-f="${o[0]}" aria-selected="${fv.estado === o[0]}">${o[1]}<span class="n">${o[0] === "todos" ? V.length : V.filter(v => o[0] === "activos" ? v.activo : !v.activo).length}</span></button>`).join("")}</div></div>
          <ul class="vlist">${L.length ? L.map(v => `<li class="vcard${v.activo ? "" : " off"}" data-id="${esc(v.id)}">
            <div class="vtop"><div><b>${esc(v.nombre)}</b><span class="sub">${esc(v.dni)}${v.empresa ? " · " + esc(v.empresa) : ""}</span></div>
              <span class="pill ${v.activo ? "p-vencido" : "p-desaprobado"}">${v.activo ? "Vetado" : v.estado === "Levantado" ? "Levantado" : "Vencido"}</span></div>
            <p class="vmot">${esc(v.motivo)}</p>
            <div class="vmeta"><span>Sede ${esc(v.sede)}</span><span>Desde ${fmt(v.fecha)}</span><span>${v.hasta ? "Hasta " + fmt(v.hasta) : "Permanente"}</span><span>Por ${esc(v.por)}</span></div>
            ${v.estado === "Levantado" ? `<div class="vmeta"><span>Levantado el ${fmt(v.fLev)} por ${esc(v.levPor)}: ${esc(v.motLev)}</span></div>` : ""}
            ${v.puedeLevantar ? `<details class="vlev"><summary>Levantar veto</summary><textarea class="inp" rows="2" placeholder="Motivo del levantamiento"></textarea><button class="btn btn-ghost btn-sm" type="button" data-lev="${esc(v.id)}">Confirmar levantamiento</button><span class="err" hidden></span></details>`
              : v.activo ? `<span class="hint">Solo la sede ${esc(v.sede)} o el administrador pueden levantarlo.</span>` : ""}
          </li>`).join("") : `<li class="empty">${V.length ? "Nada que mostrar con este filtro." : "No hay personas vetadas."}</li>`}</ul>
        </div></div>`;
    prefill = null;
    $("#v-q").oninput = e => { fv.q = e.target.value; const pos = e.target.selectionStart; pintarVet(); const i = $("#v-q"); i.focus(); i.setSelectionRange(pos, pos); };
    boxV.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { fv.estado = b.dataset.f; pintarVet(); });
    $("#v-form").onsubmit = registrar;
    boxV.querySelectorAll("[data-lev]").forEach(b => b.onclick = () => levantar(b));
    $("#v-csv").onclick = () => csv(`Personal_vetado_${vet.hoy}.csv`,
      ["DNI / CE", "Nombres y apellidos", "Empresa", "RUC", "Sede que veta", "Motivo", "Desde", "Hasta", "Registrado por", "Estado", "Levantado el", "Levantado por", "Motivo del levantamiento"],
      L.map(v => [v.dni, v.nombre, v.empresa, v.ruc, v.sede, v.motivo, fmt(v.fecha), v.hasta ? fmt(v.hasta) : "Permanente", v.por, v.activo ? "Activo" : v.estado === "Levantado" ? "Levantado" : "Vencido", fmt(v.fLev), v.levPor, v.motLev]));
    if (p.dni) $("#v-mot").focus();
  }
  async function registrar(e) {
    e.preventDefault();
    const er = $("#v-err"), b = $("#v-go"), g = id => $(id).value.trim(); er.hidden = true;
    const veto = { dni: g("#v-dni"), nombre: g("#v-nom"), empresa: g("#v-emp"), ruc: g("#v-ruc"), hasta: g("#v-hasta"), motivo: g("#v-mot"), sede: usuario().admin ? g("#v-sede") : "" };
    if (!/^[0-9A-Za-z]{8,12}$/.test(veto.dni)) { er.textContent = "Escribe un DNI o CE válido."; er.hidden = false; return; }
    if (veto.nombre.length < 5) { er.textContent = "Escribe el nombre completo."; er.hidden = false; return; }
    if (veto.motivo.length < 10) { er.textContent = "Describe el motivo (mínimo 10 caracteres)."; er.hidden = false; return; }
    b.disabled = true; b.innerHTML = `<span class="spin"></span> Registrando…`;
    try { vet = await api("v_agregar", { clave, veto }); fv.estado = "activos"; badge(); pintarVet(); hab = null; toast(`Veto registrado para ${veto.nombre}. Se avisó por correo a la sede.`); }
    catch (x) { b.disabled = false; b.textContent = "Registrar veto"; er.textContent = x.message; er.hidden = false; }
  }
  async function levantar(b) {
    const d = b.closest("details"), motivo = d.querySelector("textarea").value.trim(), er = d.querySelector(".err");
    er.hidden = true;
    if (motivo.length < 5) { er.textContent = "Indica el motivo del levantamiento."; er.hidden = false; return; }
    b.disabled = true;
    try { vet = await api("v_levantar", { clave, id: b.dataset.lev, motivo }); badge(); pintarVet(); hab = null; toast("Veto levantado."); }
    catch (x) { b.disabled = false; er.textContent = x.message; er.hidden = false; }
  }
})();
