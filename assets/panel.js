/* Panel de seguimiento: requiere la clave; se actualiza solo */
(function () {
  const $ = s => document.querySelector(s);
  const esc = window.fpEsc, fmt = window.fpFecha, nota = window.fpNota, api = window.fpApi;
  const CADA = Math.max(10, Number((window.FP_CONFIG || {}).ACTUALIZAR_CADA_SEGUNDOS) || 30) * 1000;
  const TXT = { vigente: "Vigente", porvencer: "Por vencer", vencido: "Vencido", desaprobado: "Desaprobado" };
  const COLOR = { vigente: "var(--ok)", porvencer: "var(--warn-mark)", vencido: "var(--bad)", desaprobado: "var(--line-2)" };

  const EMPRESAS = ((window.FP_CONFIG || {}).EMPRESAS || []).map(e => e.nombre);
  let grupoSel = "";
  let clave = "", data = { registros: [], hoy: "", hoja: "" }, ultimaCarga = 0, timer = null, reloj = null, conocidos = null, nuevos = new Set(), cargando = false;
  const ss = (k, v) => { try { if (v === undefined) return sessionStorage.getItem(k); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (_) { return null; } };

  const dias = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);
  const estado = r => { if (!r.aprobado) return "desaprobado"; const d = dias(data.hoy, r.vence); return d < 0 ? "vencido" : d <= 30 ? "porvencer" : "vigente"; };
  // Registros de la empresa del grupo elegida (o de todas)
  const delGrupo = () => grupoSel ? data.registros.filter(r => r.grupo === grupoSel) : data.registros;
  // Último intento de cada persona en cada empresa del grupo
  const ultimos = () => { const s = new Set(); return delGrupo().filter(r => { const k = r.dni + "|" + r.grupo + "|" + r.tipo; if (s.has(k)) return false; s.add(k); return true; }); };

  /* ---------- Acceso ---------- */
  $("#login").addEventListener("submit", async e => {
    e.preventDefault();
    clave = $("#clave").value.trim(); if (!clave) return;
    const b = $("#l-go"); b.disabled = true; b.innerHTML = `<span class="spin"></span> Entrando…`; $("#l-err").textContent = "";
    const ok = await iniciar(true);
    b.disabled = false; b.textContent = "Entrar";
    if (ok) { ss("fp-clave", clave); entrar(); }
  });
  // Primero identifica al usuario: los responsables de sede (Solicitante) solo ven «Trabajos en sede»
  async function iniciar(desdeLogin) {
    let u;
    try { u = await api("sesion", { clave }); }
    catch (e) {
      if (desdeLogin) $("#l-err").textContent = /Clave/i.test(e.message) ? "Clave incorrecta." : e.message.indexOf("config") >= 0 ? e.message : "No hay conexión con el servidor. Inténtalo de nuevo.";
      return false;
    }
    window.fpUsuario = u;
    if (u.solicitante) { $("#quien").textContent = u.nombre + (u.nombre.indexOf(u.sede) >= 0 ? "" : " · Sede " + u.sede); return true; }
    return cargar(desdeLogin);
  }
  function entrar() {
    const sol = !!(window.fpUsuario || {}).solicitante;
    document.querySelectorAll(".modtabs button").forEach(b => b.hidden = sol && b.dataset.mod !== "tra");
    document.dispatchEvent(new CustomEvent("fp:login", { detail: clave }));
    $("#acceso").hidden = true; $("#dash").hidden = false; $("#topright").hidden = false;
    $("#live").hidden = sol;
    if (sol) { mostrarModulo("tra"); return; }
    $("#hoja").href = data.hoja || "#";
    programar();
  }
  $("#salir").addEventListener("click", () => {
    ss("fp-clave", null); clave = ""; document.dispatchEvent(new CustomEvent("fp:logout")); clearTimeout(timer); clearInterval(reloj);
    data = { registros: [], hoy: "", hoja: "" }; conocidos = null; window.fpUsuario = null; $("#quien").textContent = "";
    document.querySelectorAll(".modtabs button").forEach(b => b.hidden = false);
    mostrarModulo("ind");
    $("#dash").hidden = true; $("#topright").hidden = true; $("#acceso").hidden = false; $("#clave").value = "";
  });

  /* ---------- Pestañas de módulos ---------- */
  function mostrarModulo(m) {
    document.querySelectorAll(".modtabs button").forEach(x => x.setAttribute("aria-selected", x.dataset.mod === m));
    document.querySelectorAll("#dash > .mod").forEach(x => x.hidden = x.id !== "mod-" + m);
    document.dispatchEvent(new CustomEvent("fp:modulo", { detail: m }));
  }
  document.querySelectorAll(".modtabs button").forEach(b => b.addEventListener("click", () => mostrarModulo(b.dataset.mod)));

  /* ---------- Carga y actualización automática ---------- */
  async function cargar(desdeLogin) {
    if (cargando) return false; cargando = true;
    try {
      const d = await api("registros", { clave });
      const ids = new Set(d.registros.map(r => r.codigo));
      if (conocidos) {
        const llegados = d.registros.filter(r => !conocidos.has(r.codigo));
        nuevos = new Set(llegados.map(r => r.codigo));
        if (llegados.length) aviso(llegados);
      }
      conocidos = ids; data = d; ultimaCarga = Date.now();
      window.fpUsuario = d.usuario;
      if (d.usuario) {
        $("#quien").textContent = d.usuario.nombre + (d.usuario.admin ? " · Administrador" : d.usuario.nombre.indexOf(d.usuario.sede) >= 0 ? "" : " · Sede " + d.usuario.sede);
        const fs = $("#f-sede"), cur = fs.value; fs.hidden = !d.usuario.admin;
        fs.innerHTML = `<option value="">Todas las sedes</option>` + (d.usuario.sedes || []).map(x => `<option ${x === cur ? "selected" : ""}>${esc(x)}</option>`).join("");
      }
      estadoVivo("on"); pintar();
      return true;
    } catch (e) {
      if (/Clave/i.test(e.message)) {
        if (desdeLogin) $("#l-err").textContent = "Clave incorrecta.";
        else $("#salir").click();
      } else if (desdeLogin) $("#l-err").textContent = e.message.indexOf("config") >= 0 ? e.message : "No hay conexión con el servidor. Inténtalo de nuevo.";
      else estadoVivo("err");
      return false;
    } finally { cargando = false; }
  }
  function programar() {
    clearTimeout(timer); clearInterval(reloj);
    timer = setTimeout(async function ciclo() {
      if (!document.hidden && clave) await cargar(false);
      if (clave) timer = setTimeout(ciclo, CADA);
    }, CADA);
    reloj = setInterval(() => { if (ultimaCarga && !$("#live").classList.contains("err")) $("#live-t").textContent = "En vivo · actualizado hace " + tiempo(Date.now() - ultimaCarga); }, 1000);
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && clave && Date.now() - ultimaCarga > CADA) cargar(false); });
  function tiempo(ms) { const s = Math.floor(ms / 1000); return s < 60 ? s + " s" : Math.floor(s / 60) + " min"; }
  function estadoVivo(m) {
    const l = $("#live"); l.classList.toggle("err", m === "err");
    $("#live-t").textContent = m === "err" ? "Sin conexión · reintentando" : "En vivo · actualizado hace 0 s";
  }
  let toastT = null;
  function aviso(llegados) {
    const t = $("#toast"), r = llegados[0];
    t.innerHTML = llegados.length === 1
      ? `Nueva inducción en ${esc(r.grupo)}: <b>${esc(r.nombre)}</b> · ${esc(r.empresa)} · nota ${nota(r.nota)}`
      : `<b>${llegados.length} inducciones nuevas</b> registradas`;
    t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 6000);
  }

  /* ---------- Pintado ---------- */
  function pintarSeg() {
    const nombres = [...new Set(EMPRESAS.concat(data.registros.map(r => r.grupo)))];
    const cuenta = g => { const s = new Set(); data.registros.forEach(r => { if (!g || r.grupo === g) s.add(r.dni + "|" + r.grupo); }); return s.size; };
    $("#seg").innerHTML = [["", "Todo el grupo"]].concat(nombres.map(n => [n, n])).map(([v, t]) => `<button type="button" role="tab" aria-selected="${grupoSel === v}" data-g="${esc(v)}">${esc(t)}<span class="n">${cuenta(v)}</span></button>`).join("");
    $("#titulo").textContent = grupoSel ? "Inducciones en " + grupoSel : "Estado de las inducciones";
  }
  function pintar() {
    pintarSeg();
    const lat = ultimos();
    const c = { vigente: 0, porvencer: 0, vencido: 0, desaprobado: 0 }; lat.forEach(r => c[estado(r)]++);
    const filtro = $("#f-estado").value;
    $("#kpis").innerHTML = [["vigente", "k-ok", "Con inducción vigente"], ["porvencer", "k-warn", "Vencen en 30 días o menos"], ["vencido", "k-bad", "Con inducción vencida"], ["desaprobado", "k-mute", "Desaprobados en su último intento"]]
      .map(k => `<button type="button" class="kpi ${k[1]}" data-e="${k[0]}" aria-pressed="${filtro === k[0]}"><b>${c[k[0]]}</b><span>${k[2]}</span></button>`).join("");

    // Vencen pronto: por vencer + vencidos en los últimos 30 días
    const pronto = lat.filter(r => r.aprobado && dias(data.hoy, r.vence) <= 30 && dias(data.hoy, r.vence) >= -30).sort((a, b) => a.vence.localeCompare(b.vence)).slice(0, 8);
    $("#pronto").innerHTML = pronto.length ? pronto.map(r => { const d = dias(data.hoy, r.vence); return `<li><div class="who"><b>${esc(r.nombre)}</b><span>${esc(r.empresa)} · vence ${fmt(r.vence)}</span></div><span class="days${d < 0 ? " past" : ""}">${d < 0 ? "venció hace " + (-d) + " d" : d === 0 ? "vence hoy" : "en " + d + " d"}</span></li>`; }).join("")
      : `<li class="empty-s">No hay inducciones por vencer en los próximos 30 días.</li>`;

    // Por empresa
    const emp = {}; lat.forEach(r => { const e = emp[r.empresa] = emp[r.empresa] || { vigente: 0, porvencer: 0, vencido: 0, desaprobado: 0, t: 0 }; e[estado(r)]++; e.t++; });
    const ord = Object.entries(emp).sort((a, b) => b[1].t - a[1].t);
    $("#emp-n").textContent = ord.length ? ord.length + " empresa" + (ord.length === 1 ? "" : "s") : "";
    $("#empresas").innerHTML = ord.length ? ord.slice(0, 8).map(([n, e]) => `<div class="brow"><span class="name">${esc(n)}</span><span class="n">${e.vigente + e.porvencer} de ${e.t} vigentes</span><div class="stack">${["vigente", "porvencer", "vencido", "desaprobado"].filter(k => e[k]).map(k => `<i style="flex:${e[k]};background:${COLOR[k]}" title="${TXT[k]}: ${e[k]}"></i>`).join("")}</div></div>`).join("")
      : `<div class="empty-s">Aún no hay empresas registradas.</div>`;

    // Filtro de empresas
    const sel = $("#f-empresa"), cur = sel.value;
    const nombres = [...new Set(delGrupo().map(r => r.empresa))].sort((a, b) => a.localeCompare(b, "es"));
    sel.innerHTML = `<option value="">Todas las empresas</option>` + nombres.map(n => `<option ${n === cur ? "selected" : ""}>${esc(n)}</option>`).join("");
    tabla();
  }
  function filtrados() {
    const q = $("#q").value.trim().toLowerCase(), st = $("#f-estado").value, em = $("#f-empresa").value, se = $("#f-sede").value, ti = $("#f-tipo").value;
    const base = $("#f-ultimo").checked ? ultimos() : delGrupo();
    return { base, list: base.filter(r => (!q || `${r.nombre} ${r.dni} ${r.empresa}`.toLowerCase().includes(q)) && (!st || estado(r) === st) && (!em || r.empresa === em) && (!se || r.sede === se) && (!ti || r.tipo === ti)) };
  }
  function tabla() {
    const { base, list } = filtrados();
    $("#conteo").textContent = data.registros.length ? `Mostrando ${list.length} de ${base.length} registros` : "";
    if (!data.registros.length) { $("#filas").innerHTML = `<tr><td colspan="8" class="empty">Aún no hay inducciones. Cuando un contratista termine el examen, aparecerá aquí automáticamente.</td></tr>`; return; }
    if (!list.length) { $("#filas").innerHTML = `<tr><td colspan="8" class="empty">Ningún registro coincide con los filtros.</td></tr>`; return; }
    $("#filas").innerHTML = list.map(r => {
      const e = estado(r), d = r.aprobado ? dias(data.hoy, r.vence) : 0;
      return `<tr class="${nuevos.has(r.codigo) ? "nuevo" : ""}"><td class="num">${fmt(r.fecha)}</td><td><span class="gtag">${esc(r.grupo)}</span>${r.sede ? `<span class="sub">Sede ${esc(r.sede)}</span>` : ""}${r.tipo && r.tipo !== "Contratista" ? `<span class="sub"><b>${esc(r.tipo)}</b>${r.placa ? " · " + esc(r.placa) : ""}</span>` : ""}</td>
        <td><b>${esc(r.nombre)}</b><span class="sub">${esc(r.dni)}${r.correo ? " · " + esc(r.correo) : ""}</span></td>
        <td>${esc(r.empresa)}<span class="sub">${r.ruc ? "RUC " + esc(r.ruc) + " · " : ""}${esc(r.cargo)}${r.area ? " · " + esc(r.area) : ""}</span></td>
        <td class="num"><b>${nota(r.nota)}</b><span class="sub">${r.correctas}/${r.total} correctas</span></td>
        <td><span class="pill p-${e}">${TXT[e]}</span></td>
        <td class="num">${r.aprobado ? fmt(r.vence) + `<span class="sub">${d < 0 ? "hace " + (-d) + " días" : d === 0 ? "hoy" : "en " + d + " días"}</span>` : "—"}</td>
        <td>${r.certificado ? `<a href="${esc(r.certificado)}" target="_blank" rel="noopener">Ver PDF</a><span class="sub">${esc(r.codigo)}</span>` : `<span class="sub">${r.aprobado ? esc(r.codigo) : "—"}</span>`}</td></tr>`;
    }).join("");
  }
  ["#q", "#f-estado", "#f-empresa", "#f-sede", "#f-tipo", "#f-ultimo"].forEach(s => $(s).addEventListener(s === "#q" ? "input" : "change", () => { nuevos = new Set(); s === "#f-estado" ? pintar() : tabla(); }));
  $("#seg").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; grupoSel = b.dataset.g; $("#f-empresa").value = ""; nuevos = new Set(); pintar(); });
  $("#kpis").addEventListener("click", e => { const k = e.target.closest(".kpi"); if (!k) return; const sel = $("#f-estado"); sel.value = sel.value === k.dataset.e ? "" : k.dataset.e; nuevos = new Set(); pintar(); });

  /* ---------- Exportar CSV (abre en Excel) ---------- */
  $("#csv").addEventListener("click", () => {
    const { list } = filtrados();
    const cols = ["Código", "Fecha", "Tipo de ingreso", "Ingresa a", "Sede", "Nombres y apellidos", "DNI / CE", "Empresa", "RUC", "Cargo", "Área", "Correo", "Nota", "Correctas", "Total", "Resultado", "Vence", "Estado", "Certificado", "Placa", "Persona que visita"];
    const q = v => { v = String(v == null ? "" : v); return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
    const filas = list.map(r => [r.codigo, fmt(r.fecha), r.tipo, r.grupo, r.sede, r.nombre, r.dni, r.empresa, r.ruc, r.cargo, r.area, r.correo, String(r.nota).replace(".", ","), r.correctas, r.total, r.aprobado ? "Aprobado" : "Desaprobado", r.aprobado ? fmt(r.vence) : "", TXT[estado(r)], r.certificado, r.placa, r.visita].map(q).join(";"));
    const blob = new Blob(["﻿" + [cols.join(";")].concat(filas).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `Inducciones_contratistas_${grupoSel ? grupoSel + "_" : ""}${data.hoy || "export"}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });

  // Sesión guardada en esta pestaña
  const guardada = ss("fp-clave");
  if (guardada) { clave = guardada; iniciar(false).then(ok => { if (ok) entrar(); else { clave = ""; ss("fp-clave", null); } }); }
})();
