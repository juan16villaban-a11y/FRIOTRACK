/* Flujo del contratista: datos → video → examen → certificado */
(function () {
  const $ = s => document.querySelector(s);
  const esc = window.fpEsc, fmt = window.fpFecha, nota = window.fpNota, api = window.fpApi;

  let ini = { youtube: "", enlace: "", notaMinima: 14, preguntas: 10, empresas: [] };
  let avance = null;
  const EMPRESAS = ((window.FP_CONFIG || {}).EMPRESAS || [{ nombre: "Friopacking", logoWeb: "assets/logo.png", logoCertificado: "assets/logo-certificado.jpg" }]);
  let grupo = "";
  const TIPO_UI = {
    Contratista: { icono: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/></svg>`, titulo: "Contratista", txt: "Vengo a realizar un trabajo o servicio", sede: "Sede donde trabajarás", empresa: "Empresa contratista", ruc: "RUC de tu empresa contratista", rucOpc: false },
    Visitante: { icono: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>`, titulo: "Visitante", txt: "Visita, reunión, auditoría o proveedor sin realizar trabajos", sede: "Sede que visitas", empresa: "Empresa o institución", ruc: "RUC de tu empresa (opcional)", rucOpc: true },
    Transportista: { icono: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>`, titulo: "Transportista", txt: "Conductor de vehículo de carga o despacho", sede: "Sede a la que llegas", empresa: "Empresa de transporte", ruc: "RUC de la empresa de transporte (opcional)", rucOpc: true }
  };
  let tipo = (function () { const q = (new URLSearchParams(location.search).get("tipo") || "").toLowerCase(); return Object.keys(TIPO_UI).find(k => k.toLowerCase() === q) || "Contratista"; })();
  const tcfg = () => (ini.tipos || []).find(t => t.tipo === tipo) || ini;
  function pintarTipos() {
    const activos = (ini.tipos || [{ tipo: "Contratista" }, { tipo: "Visitante" }, { tipo: "Transportista" }]).map(t => t.tipo);
    if (activos.indexOf(tipo) < 0) tipo = activos[0];
    $("#tipo-opts").innerHTML = activos.map(t => { const u = TIPO_UI[t]; return `<button type="button" class="tipo" role="radio" aria-checked="${tipo === t}" data-t="${t}"><span class="ti" aria-hidden="true">${u.icono}</span><span><b>${u.titulo}</b><small>${u.txt}</small></span></button>`; }).join("");
    $("#tipo-opts").querySelectorAll(".tipo").forEach(b => b.onclick = () => { tipo = b.dataset.t; const pb = $("#p1-prev"); pb.hidden = true; delete pb.dataset.forzar; pintarTipos(); });
    aplicarTipo();
  }
  function aplicarTipo() {
    const u = TIPO_UI[tipo], c = tcfg(), es = t => tipo === t;
    $("#w-cargo").hidden = !es("Contratista"); $("#w-area").hidden = !es("Contratista");
    $("#w-visita").hidden = !es("Visitante"); $("#w-placa").hidden = !es("Transportista"); $("#w-licencia").hidden = !es("Transportista");
    $("#l-sede").textContent = u.sede; $("#l-empresa").textContent = u.empresa; $("#l-ruc").textContent = u.ruc;
    $("#ruc-hint").hidden = !es("Contratista");
    $("#f-empresa").placeholder = es("Visitante") ? "Ej. Auditores Asociados SAC" : es("Transportista") ? "Ej. Transportes del Norte SAC" : "Ej. Servicios Generales del Sur SAC";
    if (c.preguntas) $("#c-preg").textContent = c.preguntas;
    if (c.notaMinima) $("#c-min").textContent = c.notaMinima;
    const m = c.meses || 12; $("#c-vig").textContent = m % 12 ? m + " meses" : m === 12 ? "1 año" : (m / 12) + " años";
  }
  const logos = {};   // logos del certificado ya cargados, por empresa
  const plantillas = {};   // diseños de certificado (JPG) por empresa
  let persona = null, examen = [], resp = [], actual = 0, videoListo = false, player = null, timer = null;

  // Datos iniciales (video, nota mínima, empresas ya registradas)
  const iniP = api("inicio").then(r => {
    ini = r; pintarTipos();
    $("#c-min").textContent = r.notaMinima;
    $("#c-preg").textContent = r.preguntas;
    $("#f-sede").innerHTML = `<option value="">Elige la sede</option>` + (r.sedes || []).map(x => `<option>${esc(x)}</option>`).join("");
  }).catch(e => mostrarError("#p1-err", e.message.indexOf("config") >= 0 ? e.message : "No hay conexión con el servidor. Revisa tu internet y recarga la página."));

  // Logos y sellos para el PDF
  const sellos = {}, iconos = {};
  EMPRESAS.forEach(e => {
    if (e.plantilla) fetch(e.plantilla).then(r => { if (!r.ok) throw 0; return r.blob(); })
      .then(b => new Promise(ok => { const f = new FileReader(); f.onload = () => ok(f.result); f.readAsDataURL(b); }))
      .then(d => plantillas[e.nombre] = d).catch(() => {});
    if (e.icono) fetch(e.icono).then(r => { if (!r.ok) throw 0; return r.blob(); })
      .then(b => new Promise(ok => { const f = new FileReader(); f.onload = () => ok(f.result); f.readAsDataURL(b); }))
      .then(d => iconos[e.nombre] = d).catch(() => {});
    if (e.selloImagen) fetch(e.selloImagen).then(r => { if (!r.ok) throw 0; return r.blob(); })
      .then(b => new Promise(ok => { const f = new FileReader(); f.onload = () => ok(f.result); f.readAsDataURL(b); }))
      .then(d => sellos[e.nombre] = d).catch(() => {});
    if (!e.logoCertificado) return;
    fetch(e.logoCertificado).then(r => { if (!r.ok) throw 0; return r.blob(); })
      .then(b => new Promise(ok => { const f = new FileReader(); f.onload = () => ok(f.result); f.readAsDataURL(b); }))
      .then(d => logos[e.nombre] = d).catch(() => {});
  });

  // Selector de empresa del grupo (se puede preseleccionar con ?empresa=frioteam)
  function pintarEmpresas() {
    $("#grupo-opts").innerHTML = EMPRESAS.map(e => `<button type="button" class="company" role="radio" aria-checked="${grupo === e.nombre}" data-g="${esc(e.nombre)}">
      <span class="radio"></span>${e.logoWeb ? `<img src="${esc(e.logoWeb)}" alt="${esc(e.nombre)}">` : `<span class="wordmark">${esc(e.nombre)}</span>`}</button>`).join("");
    $("#grupo-opts").setAttribute("role", "radiogroup");
    $("#grupo-opts").querySelectorAll(".company").forEach(b => b.onclick = () => { grupo = b.dataset.g; $("#grupo-box").classList.remove("bad"); pintarEmpresas(); });
  }
  (function () {
    const q = (new URLSearchParams(location.search).get("empresa") || "").toLowerCase();
    const e = EMPRESAS.find(x => (x.enlace || x.nombre).toLowerCase() === q || x.nombre.toLowerCase() === q);
    if (e) grupo = e.nombre; else if (EMPRESAS.length === 1) grupo = EMPRESAS[0].nombre;
    pintarEmpresas();
  })();
  pintarTipos();

  function mostrarError(sel, msg) { const e = $(sel); e.textContent = msg; e.hidden = !msg; }
  function paso(n) {
    [1, 2, 3, 4].forEach(i => $("#p" + i).hidden = i !== n);
    document.querySelectorAll("#steps li").forEach(li => {
      const s = +li.dataset.s; li.className = s === n ? "cur" : s < n ? "done" : "";
      if (s === n) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    });
    const top = document.querySelector(".zona").getBoundingClientRect().top + window.scrollY - 12;
    if (window.scrollY > top) window.scrollTo({ top, behavior: "smooth" });
  }

  /* ---------- 1. Datos ---------- */
  // Al escribir el RUC, se completa la razón social si la empresa ya está registrada en homologación
  let rucBuscado = "";
  $("#f-ruc").addEventListener("input", async () => {
    const ruc = $("#f-ruc").value.replace(/\D/g, ""), emp = $("#f-empresa"), h = $("#ruc-hint");
    if (ruc.length !== 11) { if (emp.readOnly) { emp.readOnly = false; emp.value = ""; } h.textContent = "Pídelo a tu supervisor. Con él te vinculamos a la homologación de tu empresa."; h.className = "hint"; return; }
    if (ruc === rucBuscado) return; rucBuscado = ruc;
    try {
      const r = await api("empresa_ruc", { ruc });
      if ($("#f-ruc").value.replace(/\D/g, "") !== ruc) return;
      if (r) { emp.value = r.razon; emp.readOnly = true; emp.classList.remove("bad"); h.textContent = "Empresa registrada en la plataforma de homologación."; h.className = "hint t-ok"; }
      else { if (emp.readOnly) { emp.readOnly = false; emp.value = ""; } h.textContent = "Tu empresa aún no está registrada en homologación. Puedes rendir la inducción, pero no estarás habilitado hasta que tu empresa sea homologada."; h.className = "hint t-warn"; }
    } catch (_) { }
  });
  $("#p1").addEventListener("submit", async e => {
    e.preventDefault();
    const v = id => $(id).value.trim().replace(/\s+/g, " ");
    const p = { tipo, visita: v("#f-visita"), placa: v("#f-placa").toUpperCase(), licencia: v("#f-licencia").toUpperCase(), nombre: v("#f-nombre"), dni: v("#f-dni").replace(/\s/g, "").toUpperCase(), empresa: v("#f-empresa"), ruc: v("#f-ruc").replace(/\D/g, ""), sede: $("#f-sede").value, cargo: v("#f-cargo"), area: $("#f-area").value, correo: v("#f-correo") };
    const errs = [];
    if (!grupo) { errs.push("Elige a qué empresa del grupo vas a ingresar."); $("#grupo-box").classList.add("bad"); }
    p.grupo = grupo;
    const marca = (id, mal) => $(id).classList.toggle("bad", mal);
    marca("#f-nombre", p.nombre.length < 5); if (p.nombre.length < 5) errs.push("Escribe tus nombres y apellidos completos.");
    const dniMal = !/^[0-9A-Z]{8,12}$/.test(p.dni); marca("#f-dni", dniMal); if (dniMal) errs.push("El documento debe tener entre 8 y 12 caracteres, solo letras y números.");
    const rucMal = tipo === "Contratista" ? p.ruc.length !== 11 : p.ruc && p.ruc.length !== 11;
    marca("#f-ruc", rucMal); if (rucMal) errs.push("El RUC debe tener 11 dígitos.");
    marca("#f-empresa", !p.empresa); if (!p.empresa) errs.push("Indica tu empresa.");
    if (tipo !== "Contratista") p.cargo = tipo === "Visitante" ? "Visitante" : "Conductor";
    if (tipo === "Visitante") { marca("#f-visita", p.visita.length < 3); if (p.visita.length < 3) errs.push("Indica a quién visitas."); }
    if (tipo === "Transportista") {
      marca("#f-placa", p.placa.length < 5); if (p.placa.length < 5) errs.push("Indica la placa del vehículo.");
      marca("#f-licencia", p.licencia.length < 5); if (p.licencia.length < 5) errs.push("Indica tu licencia de conducir.");
    }
    marca("#f-sede", !p.sede); if (!p.sede) errs.push("Elige la sede donde trabajarás.");
    marca("#f-cargo", !p.cargo); if (!p.cargo) errs.push("Indica tu cargo o puesto.");
    const mailMal = p.correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.correo); marca("#f-correo", mailMal); if (mailMal) errs.push("Revisa tu correo o déjalo en blanco.");
    if (errs.length) { const b = $("#p1-err"); b.innerHTML = errs.map(esc).join("<br>"); b.hidden = false; return; }
    mostrarError("#p1-err", "");
    persona = p;
    const go = $("#p1-go"); go.disabled = true; go.innerHTML = `<span class="spin"></span> Verificando…`;
    let prev = null;
    try { await iniP; prev = await api("vigente", { dni: p.dni, grupo: p.grupo, tipo }); } catch (_) { }
    go.disabled = false; go.innerHTML = `Continuar al video <span class="arrow">→</span>`;
    const pb = $("#p1-prev");
    if (prev && prev.bloqueado) {
      pb.innerHTML = `<strong>${esc(prev.mensaje)}</strong>`; pb.className = "notice bad"; pb.hidden = false; return;
    }
    pb.className = "notice ok";
    if (prev && !pb.dataset.forzar) {
      pb.innerHTML = `<strong>Ya tienes una inducción de ${esc(tipo.toLowerCase())} vigente en ${esc(prev.grupo)} hasta el ${fmt(prev.vence)}.</strong><span>Puedes descargar de nuevo tu certificado o rendir la inducción otra vez.</span>
        <div class="actions"><button type="button" class="btn btn-primary btn-sm" id="pv-cert">Descargar mi certificado</button><button type="button" class="btn btn-ghost btn-sm" id="pv-otra">Rendir otra vez</button></div><span class="hint" id="pv-msg"></span>`;
      pb.hidden = false;
      $("#pv-cert").onclick = () => entregar(certDatos(prev), $("#pv-msg"));
      $("#pv-otra").onclick = () => { pb.dataset.forzar = "1"; pb.hidden = true; irVideo(); };
      return;
    }
    irVideo();
  });
  document.querySelectorAll("#p1 .inp").forEach(i => i.addEventListener("input", () => i.classList.remove("bad")));

  /* ---------- 2. Video ---------- */
  function irVideo() {
    videoListo = false; clearInterval(timer);
    if (player && player.destroy) { try { player.destroy(); } catch (_) { } } player = null;
    const body = $("#p2-body"), go = $("#p2-go"), V = tcfg(); go.disabled = true;
    if (V.youtube) {
      $("#p2-sub").textContent = "Míralo completo para continuar. No se puede adelantar.";
      body.innerHTML = `<div class="player"><div id="yt"></div></div>
        <div class="watch"><div class="meter"><i id="w-bar"></i></div><span class="pct" id="w-pct">0%</span><span class="msg" id="w-msg">Pulsa reproducir para empezar.</span></div>`;
      cargarYT().then(() => {
        let visto = 0;
        player = new YT.Player("yt", {
          videoId: V.youtube, playerVars: { rel: 0, modestbranding: 1, playsinline: 1, disablekb: 1 },
          events: { onStateChange: ev => { if (ev.data === YT.PlayerState.PLAYING) $("#w-msg").textContent = "Reproduciendo…"; if (ev.data === YT.PlayerState.ENDED && visto >= player.getDuration() - 4) listo(); } }
        });
        timer = setInterval(() => {
          if (!player || !player.getCurrentTime) return;
          const t = player.getCurrentTime(), d = player.getDuration() || 0;
          if (t > visto + 2) { player.seekTo(visto, true); $("#w-msg").textContent = "No se puede adelantar el video."; return; }
          if (t > visto) visto = t;
          const pct = d ? Math.min(100, Math.round(visto / d * 100)) : 0;
          $("#w-pct").textContent = pct + "%"; $("#w-bar").style.width = pct + "%";
          if (d && visto >= d - 1) listo();
        }, 500);
      }).catch(() => { body.innerHTML = `<div class="notice bad"><strong>No se pudo cargar el video.</strong><span>Revisa tu conexión a internet y vuelve a intentarlo.</span></div>`; });
    } else if (V.enlace) {
      $("#p2-sub").textContent = "El video se abre en una pestaña nueva. Míralo completo y vuelve aquí.";
      body.innerHTML = `<div class="notice"><div class="actions"><a class="btn btn-primary" href="${esc(V.enlace)}" target="_blank" rel="noopener">Abrir el video de inducción</a></div></div>
        <label class="check"><input type="checkbox" id="vid-ok"> Declaro que vi el video de inducción completo.</label>`;
      $("#vid-ok").addEventListener("change", e => { videoListo = e.target.checked; go.disabled = !videoListo; });
    } else {
      body.innerHTML = `<div class="player"><div class="empty"><div><strong>Aún no se ha cargado el video de inducción.</strong><br>Avisa al responsable de Seguridad y Salud en el Trabajo.</div></div></div>`;
    }
    paso(2);
  }
  function listo() {
    if (videoListo) return; videoListo = true; clearInterval(timer);
    $("#w-pct").textContent = "100%"; $("#w-bar").style.width = "100%"; $("#w-msg").textContent = "Video completado. Ya puedes rendir el examen.";
    $("#p2-go").disabled = false;
  }
  let ytP = null;
  function cargarYT() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (ytP) return ytP;
    ytP = new Promise((ok, ko) => {
      window.onYouTubeIframeAPIReady = ok;
      const s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; s.onerror = ko; document.head.appendChild(s);
      setTimeout(() => ko(new Error("tiempo agotado")), 20000);
    });
    return ytP;
  }
  $("#p2-back").addEventListener("click", () => { clearInterval(timer); if (player && player.pauseVideo) player.pauseVideo(); paso(1); });
  $("#p2-go").addEventListener("click", () => { if (videoListo) irExamen(); });

  /* ---------- 3. Examen ---------- */
  async function irExamen() {
    if (player && player.pauseVideo) player.pauseVideo();
    $("#p3-body").innerHTML = `<div class="loading"><span class="spin"></span>Preparando tu examen…</div>`;
    paso(3);
    try { examen = await api("examen", { tipo }); }
    catch (e) { $("#p3-body").innerHTML = `<div class="notice bad"><strong>No se pudo cargar el examen.</strong><span>Revisa tu conexión.</span><div class="actions"><button class="btn btn-ghost btn-sm" id="ex-retry" type="button">Intentar de nuevo</button></div></div>`; $("#ex-retry").onclick = irExamen; return; }
    resp = examen.map(() => null); actual = 0; pintarPregunta();
  }
  function pintarPregunta(marcarFaltantes) {
    const q = examen[actual], n = examen.length, ult = actual === n - 1, faltan = resp.filter(x => !x).length;
    $("#p3-body").innerHTML = `
      <div class="pane" style="padding:0">
        <div class="qhead"><span class="qcount">Pregunta ${actual + 1} de ${n}</span>
          <div class="dots" role="group" aria-label="Ir a la pregunta">${examen.map((_, i) => `<button type="button" class="dot${resp[i] ? " answered" : ""}${i === actual ? " current" : ""}${marcarFaltantes && !resp[i] ? " missing" : ""}" data-i="${i}" aria-label="Pregunta ${i + 1}${resp[i] ? ", respondida" : ""}">${i + 1}</button>`).join("")}</div></div>
        <div class="qtext" id="qtext">${esc(q.q)}</div>
        <div class="opts" role="radiogroup" aria-labelledby="qtext">${q.opciones.map(o => `<button type="button" class="option" role="radio" aria-checked="${resp[actual] === o.k}" data-k="${esc(o.k)}"><span class="key">${esc(o.k)}</span><span>${esc(o.t)}</span></button>`).join("")}</div>
        <div class="err" id="p3-err" role="alert" ${marcarFaltantes && faltan ? "" : "hidden"}>Te falta${faltan === 1 ? "" : "n"} ${faltan} pregunta${faltan === 1 ? "" : "s"} por responder (marcadas en rojo).</div>
        <div class="actions between">
          <button class="btn btn-ghost" id="q-prev" type="button" ${actual === 0 ? "disabled" : ""}>← Anterior</button>
          ${ult ? `<button class="btn btn-primary" id="q-send" type="button">Enviar examen</button>` : `<button class="btn btn-navy" id="q-next" type="button" ${resp[actual] ? "" : "disabled"}>Siguiente <span class="arrow">→</span></button>`}
        </div>
      </div>`;
    $("#p3-body").querySelectorAll(".option").forEach(b => b.onclick = () => {
      resp[actual] = b.dataset.k;
      pintarPregunta(marcarFaltantes);
      // Avanza solo a la siguiente pregunta tras una pausa breve
      if (!ult) { const desde = actual; clearTimeout(avance); avance = setTimeout(() => { if (actual === desde) { actual++; pintarPregunta(marcarFaltantes); } }, 260); }
    });
    $("#p3-body").querySelectorAll(".dot").forEach(d => d.onclick = () => { actual = +d.dataset.i; pintarPregunta(marcarFaltantes); });
    $("#q-prev").onclick = () => { actual--; pintarPregunta(marcarFaltantes); };
    if (!ult) $("#q-next").onclick = () => { actual++; pintarPregunta(marcarFaltantes); };
    else $("#q-send").onclick = enviar;
  }
  async function enviar() {
    if (resp.some(x => !x)) { pintarPregunta(true); return; }
    const b = $("#q-send"); b.disabled = true; b.innerHTML = `<span class="spin"></span> Calificando…`;
    try {
      const r = await api("enviar", { persona, respuestas: examen.map((q, i) => ({ id: q.id, k: resp[i] })) });
      resultado(r);
    } catch (e) {
      b.disabled = false; b.textContent = "Enviar examen";
      const er = $("#p3-err"); er.textContent = /Comunícate|Datos|RUC|sede|empresa/i.test(e.message) ? e.message : "No se pudo enviar el examen. Revisa tu conexión e inténtalo de nuevo."; er.hidden = false;
    }
  }

  /* ---------- 4. Resultado ---------- */
  function certHTML(r) {
    const e = EMPRESAS.find(x => x.nombre === r.grupo) || {};
    if (e.plantilla) {
      // Vista previa sobre el diseño real
      const C = PLANTILLA.campos, pct = (v, t) => (v / t * 100).toFixed(2) + "%";
      const campo = (k, txt) => { const [x0, y0, x1, y1] = C[k]; return `<span class="cp-f" style="left:${pct(x0 + 16, PLANTILLA.ancho)};top:${pct(y0, PLANTILLA.alto)};width:${pct(x1 - x0 - 32, PLANTILLA.ancho)};height:${pct(y1 - y0, PLANTILLA.alto)}">${esc(txt)}</span>`; };
      const [qx0, qy0, qx1, qy1] = C.qr;
      return `<div class="cert-plantilla" aria-label="Vista previa del certificado"><img src="${esc(e.plantilla)}" alt="">
        ${campo("nombre", String(r.nombre).toUpperCase())}${campo("dni", r.dni)}${campo("empresa", r.empresa)}${campo("cargo", r.cargo)}${campo("nota", nota(r.nota) + " / 20 · Aprobado")}
        ${campo("emision", fmt(r.fecha))}${campo("vence", fmt(r.vence))}${campo("codigo", r.codigo)}
        <span class="cp-qr" style="left:${pct(qx0, PLANTILLA.ancho)};top:${pct(qy0, PLANTILLA.alto)};width:${pct(qx1 - qx0, PLANTILLA.ancho)};height:${pct(qy1 - qy0, PLANTILLA.alto)}">QR</span></div>`;
    }
    return `<div class="cert" aria-label="Vista previa del certificado">${(EMPRESAS.find(e => e.nombre === r.grupo) || {}).logoWeb ? `<img src="${esc(EMPRESAS.find(e => e.nombre === r.grupo).logoWeb)}" alt="${esc(r.grupo)}">` : `<div class="ct" style="font-size:28px;letter-spacing:0">${esc(r.grupo)}</div>`}<div class="ct">CERTIFICADO DE INDUCCIÓN</div><p>Se certifica que</p><div class="cn">${esc(r.nombre)}</div>
      <p>identificado(a) con documento N.° ${esc(r.dni)}, de la empresa contratista ${esc(r.empresa)}, aprobó la Inducción de Seguridad y Salud en el Trabajo de ${esc(r.grupo)} para personal contratista con nota ${nota(r.nota)}/20.</p>
      <div class="meta"><span>Emitido<b>${fmt(r.fecha)}</b></span><span>Válido hasta<b>${fmt(r.vence)}</b></span><span>Código<b>${esc(r.codigo)}</b></span></div></div>`;
  }
  // Para visitantes y transportistas, el campo "cargo" del certificado indica su tipo de ingreso
  function certDatos(r) {
    r = Object.assign({}, r);
    if (r.tipo === "Transportista") r.cargo = "Conductor" + (r.placa ? " · Placa " + r.placa : "");
    else if (r.tipo === "Visitante") r.cargo = "Visitante";
    return r;
  }
  function resultado(r) {
    r = certDatos(r);
    const p = $("#p4"), pct = Math.round(r.nota / 20 * 100);
    if (r.aprobado) {
      p.innerHTML = `<div class="result"><div class="ring" style="--p:${pct}"><div><div><b>${nota(r.nota)}</b><small>de 20</small></div></div></div>
        <div class="txt"><span class="tag ok">Aprobado</span><h2>¡Felicitaciones, ${esc(r.nombre.split(" ")[0])}!</h2><p>Respondiste bien ${r.correctas} de ${r.total} preguntas. Tu inducción está vigente hasta el <b>${fmt(r.vence)}</b>.</p></div></div>
        ${r.habilitado === undefined ? "" : r.habilitado ? `<div class="notice ok"><span><b>Estás habilitado para ingresar${r.tipo && r.tipo !== "Contratista" ? " como " + esc(r.tipo.toLowerCase()) : ""} a la sede ${esc(r.sede)}${r.hasta ? " hasta el " + fmt(r.hasta) : ""}.</b> Presenta tu constancia o tu DNI en vigilancia.</span></div>`
          : `<div class="notice warn"><span><b>Aprobaste la inducción, pero aún no estás habilitado para ingresar.</b> ${esc((r.motivos || []).join(" · "))}. Coordina con tu empresa.</span></div>`}
        ${certHTML(r)}
        <div class="actions between"><button class="btn btn-ghost" id="r-new" type="button">Nueva inducción</button><button class="btn btn-primary" id="r-cert" type="button">Descargar certificado (PDF)</button></div>
        <div class="hint" id="r-msg" aria-live="polite"></div>`;
      $("#r-cert").onclick = () => entregar(r, $("#r-msg"));
      entregar(r, $("#r-msg"), true);
    } else {
      p.innerHTML = `<div class="result"><div class="ring" style="--p:${pct};--c:var(--bad)"><div><div><b>${nota(r.nota)}</b><small>de 20</small></div></div></div>
        <div class="txt"><span class="tag bad">No aprobado</span><h2>Necesitas ${r.notaMinima} o más</h2><p>Respondiste bien ${r.correctas} de ${r.total} preguntas. Vuelve a ver el video y rinde el examen otra vez; las preguntas cambian en cada intento.</p></div></div>
        <div class="actions between"><button class="btn btn-ghost" id="r-new" type="button">Nueva inducción</button><button class="btn btn-navy" id="r-retry" type="button">Volver a ver el video</button></div>`;
      $("#r-retry").onclick = irVideo;
    }
    $("#r-new").onclick = reiniciar;
    paso(4);
  }
  function reiniciar() {
    persona = null; examen = []; resp = [];
    ["#f-nombre", "#f-dni", "#f-ruc", "#f-empresa", "#f-cargo", "#f-correo", "#f-visita", "#f-placa", "#f-licencia"].forEach(s => $(s).value = ""); $("#f-area").selectedIndex = 0; $("#f-sede").selectedIndex = 0; $("#f-empresa").readOnly = false; rucBuscado = "";
    const pb = $("#p1-prev"); pb.hidden = true; delete pb.dataset.forzar; mostrarError("#p1-err", "");
    paso(1);
  }

  /* ---------- Certificado PDF ---------- */
  // Dirección de la página de verificación (misma web, carpeta /verificar/)
  function urlVerificacion(codigo) {
    return (window.FP_RAIZ || "../") + "verificar/?c=" + encodeURIComponent(codigo);
  }
  /* ---------- Sello del certificado ----------
     tipo: "imagen" (sello SST de la empresa), "octagono" (Cero Accidentes en vector), "circular" (sello de tinta) */
  function dibujarSello(d, tipo, cx, cy, o) {
    const rad = a => a * Math.PI / 180;
    const fill = c => d.setFillColor(c[0], c[1], c[2]);
    const ink = c => d.setTextColor(c[0], c[1], c[2]);
    const stroke = c => d.setDrawColor(c[0], c[1], c[2]);
    // Texto en arco. arriba: se lee de izquierda a derecha por la parte superior; abajo: por la inferior.
    function arco(txt, R, centro, abajo, giro) {
      const chars = [...txt], esp = 0.18;
      const anchos = chars.map(ch => d.getTextWidth(ch) + esp);
      const total = anchos.reduce((a, b) => a + b, 0) - esp;
      let a = centro + (abajo ? -1 : 1) * (total / R) * 90 / Math.PI;   // grados
      chars.forEach((ch, i) => {
        const w = anchos[i] - esp, paso = anchos[i] / R * 180 / Math.PI;
        const phi = rad(a + (abajo ? 1 : -1) * (w / 2 / R) * 180 / Math.PI + giro);
        const px = cx + R * Math.cos(phi), py = cy - R * Math.sin(phi);
        if (!abajo) { d.text(ch, px - (w / 2) * Math.sin(phi), py - (w / 2) * Math.cos(phi), { angle: phi * 180 / Math.PI - 90 }); }
        else { d.text(ch, px + (w / 2) * Math.sin(phi), py + (w / 2) * Math.cos(phi), { angle: phi * 180 / Math.PI + 90 }); }
        a += (abajo ? 1 : -1) * paso;
      });
    }
    // Texto recto girado alrededor del centro del sello
    function recto(txt, dx, dy, giro) {
      const g = rad(giro), w = d.getTextWidth(txt);
      const x0 = dx - w / 2;
      const x = cx + x0 * Math.cos(g) + dy * Math.sin(g), y = cy - x0 * Math.sin(g) + dy * Math.cos(g);
      d.text(txt, x, y, { angle: giro });
    }

    if (tipo === "imagen" && o.imagen) {
      const ip = d.getImageProperties(o.imagen), h = o.r * 2, w = h * ip.width / ip.height;
      d.addImage(o.imagen, "JPEG", cx - w / 2, cy - h / 2, w, h);
      return;
    }

    if (tipo === "octagono") {
      const R = o.r * 0.66, T = o.tinta;
      const oct = (r) => { const p = []; for (let i = 0; i < 8; i++) { const t = rad(22.5 + i * 45); p.push([cx + r * Math.cos(t), cy - r * Math.sin(t)]); } return p; };
      const poly = (pts, modo) => { d.lines(pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]), pts[0][0], pts[0][1], [1, 1], modo, true); };
      fill(T); poly(oct(R), "F");
      stroke([255, 255, 255]); d.setLineWidth(0.7); poly(oct(R - 1.2), "S");
      // texto curvo superior
      ink(T); d.setFont("helvetica", "bold"); d.setFontSize(8.6);
      arco("SEGURIDAD Y SALUD EN EL TRABAJO", R + 3.2, 90, false, 0);
      // centro
      ink([255, 255, 255]);
      d.setFontSize(19); recto("CERO", 0, 0.6, 0);
      d.setFontSize(7.4); recto("ACCIDENTES", 0, 4.9, 0);
      // banda inferior
      const bw = R * 2.35, bh = 4.2, by = cy + R * 0.74;
      fill(o.oscuro); d.rect(cx - bw / 2, by, bw, bh, "F");
      ink([255, 255, 255]); d.setFontSize(6.2); d.text("UN FUTURO SIN RIESGOS", cx, by + 3.1, { align: "center" });
      ink(T); d.setFont("helvetica", "bolditalic"); d.setFontSize(8); d.text("Un futuro seguro", cx, by + bh + 3.8, { align: "center" });
      return;
    }

    // Utilidades de dibujo
    const poligono = (pts, modo) => d.lines(pts.slice(1).map((q, i) => [q[0] - pts[i][0], q[1] - pts[i][1]]), pts[0][0], pts[0][1], [1, 1], modo, true);
    const cinta = (x0, y0, ang, largo, ancho, c) => {   // cola de cinta con corte en V
      const a = rad(ang), u = [Math.sin(a), Math.cos(a)], n = [Math.cos(a), -Math.sin(a)], h = ancho / 2;
      const P = (k, m) => [x0 + u[0] * k + n[0] * m, y0 + u[1] * k + n[1] * m];
      fill(c); poligono([P(0, -h), P(0, h), P(largo, h), P(largo - ancho * 0.5, 0), P(largo, -h)], "F");
    };
    const check = (x, y, t, c, lw) => { stroke(c); d.setLineWidth(lw); d.setLineCap && d.setLineCap("round"); d.setLineJoin && d.setLineJoin("round"); d.lines([[t * 0.35, t * 0.35], [t * 0.75, -t * 0.8]], x - t * 0.5, y, [1, 1], "S", false); };
    const oscurecer = (c, f) => c.map(v => Math.round(v * f));
    const anio = o.anio;

    if (tipo === "medalla") {
      // Medalla con borde de engranaje (como el isotipo), cintas y el ícono de la empresa
      const T = o.tinta, Dk = o.oscuro, r = o.r;
      cinta(cx - 5, cy + r * 0.45, -24, r * 1.05, 8, oscurecer(T, 0.75));
      cinta(cx + 5, cy + r * 0.45, 24, r * 1.05, 8, T);
      const dientes = 22, ro = r, ri = r - 2.4, pts = [];
      for (let i = 0; i < dientes; i++) {
        const a0 = 360 / dientes * i;
        [[a0 - 4.2, ri], [a0 - 2.6, ro], [a0 + 2.6, ro], [a0 + 4.2, ri]].forEach(([a, rr]) => pts.push([cx + rr * Math.cos(rad(a)), cy - rr * Math.sin(rad(a))]));
      }
      fill(T); poligono(pts, "F"); d.circle(cx, cy, ri + 0.2, "F");
      fill(Dk); d.circle(cx, cy, r - 3.4, "F");
      stroke([255, 255, 255]); d.setLineWidth(0.35); d.circle(cx, cy, r - 4.4, "S");
      stroke(T); d.setLineWidth(0.5); d.circle(cx, cy, r - 10.6, "S");
      ink([255, 255, 255]); d.setFont("helvetica", "bold"); d.setFontSize(5.6);
      arco("SEGURIDAD Y SALUD EN EL TRABAJO", r - 7.9, 90, false, 0);
      ink(T); d.setFontSize(5.6);
      arco("INDUCCIÓN APROBADA", r - 5.6, 270, true, 0);
      [200, -20].forEach(a => { fill(T); d.circle(cx + (r - 7) * Math.cos(rad(a)), cy - (r - 7) * Math.sin(rad(a)), 0.6, "F"); });
      if (o.icono) { const s = 9.5; d.addImage(o.icono, "JPEG", cx - s / 2, cy - s / 2 - 2, s, s); }
      ink([255, 255, 255]); d.setFontSize(7); d.text(anio, cx, cy + 6.6, { align: "center" });
      return;
    }

    if (tipo === "escudo") {
      // Escudo con casco de seguridad, check y cinta "CERO ACCIDENTES"
      const T = o.tinta, Dk = o.oscuro, W = o.r * 1.42, H = o.r * 1.75, ty = cy - H * 0.52;
      const escudo = (x, y, w, h, c) => {
        fill(c);
        d.lines([[w, 0], [0, h * 0.42], [0, h * 0.30, -w * 0.30, h * 0.50, -w / 2, h * 0.58], [-w * 0.20, -h * 0.08, -w / 2, -h * 0.28, -w / 2, -h * 0.58]], x - w / 2, y, [1, 1], "F", true);
      };
      escudo(cx, ty - 1.2, W + 2.4, H + 2.6, T);
      escudo(cx, ty, W, H, Dk);
      stroke(T); d.setLineWidth(0.3);
      // texto superior
      ink([255, 255, 255]); d.setFont("helvetica", "bold"); d.setFontSize(5.4);
      d.text("INDUCCIÓN SST", cx, ty + 5.8, { align: "center" });
      // casco
      const hx = cx, hy = ty + H * 0.47, hw = W * 0.56, hh = hw * 0.55;
      fill([255, 255, 255]);
      d.lines([[0, -hh * 1.33, hw, -hh * 1.33, hw, 0]], hx - hw / 2, hy, [1, 1], "F", true);
      d.roundedRect(hx - hw * 0.66, hy - 0.4, hw * 1.32, 2.4, 1.1, 1.1, "F");
      fill(T); d.roundedRect(hx - 1.1, hy - hh + 0.9, 2.2, hh - 1.4, 0.8, 0.8, "F");
      // check
      fill(T); d.circle(hx + hw * 0.52, hy - hh * 0.25, 3.1, "F");
      stroke([255, 255, 255]); check(hx + hw * 0.52, hy - hh * 0.2, 3.2, [255, 255, 255], 0.7);
      // cinta
      const by = ty + H * 0.62, bw = W * 1.36, bh = 5.6;
      fill(oscurecer(T, 0.7));
      poligono([[cx - bw / 2 - 3.6, by + 1.6], [cx - bw / 2 + 0.6, by + 1.6], [cx - bw / 2 + 0.6, by + bh + 1.6], [cx - bw / 2 - 3.6, by + bh + 1.6], [cx - bw / 2 - 2.1, by + 1.6 + bh / 2]], "F");
      poligono([[cx + bw / 2 + 3.6, by + 1.6], [cx + bw / 2 - 0.6, by + 1.6], [cx + bw / 2 - 0.6, by + bh + 1.6], [cx + bw / 2 + 3.6, by + bh + 1.6], [cx + bw / 2 + 2.1, by + 1.6 + bh / 2]], "F");
      fill(T); d.rect(cx - bw / 2, by, bw, bh, "F");
      ink(Dk); d.setFont("helvetica", "bold"); d.setFontSize(7.4); d.text("CERO ACCIDENTES", cx, by + 3.9, { align: "center" });
      // año y empresa
      ink([255, 255, 255]); d.setFontSize(6.4); d.text(anio, cx, ty + H * 0.86, { align: "center" });
      return;
    }

    if (tipo === "roseta") {
      // Roseta de premio con borde ondulado, cintas y check grande
      const T = o.tinta, Dk = o.oscuro, r = o.r;
      cinta(cx - 5, cy + r * 0.45, -22, r * 1.0, 7.5, Dk);
      cinta(cx + 5, cy + r * 0.45, 22, r * 1.0, 7.5, T);
      fill(T); const n = 30;
      for (let i = 0; i < n; i++) { const a = rad(360 / n * i); d.circle(cx + (r - 1.6) * Math.cos(a), cy - (r - 1.6) * Math.sin(a), 1.9, "F"); }
      d.circle(cx, cy, r - 1.6, "F");
      fill([255, 255, 255]); d.circle(cx, cy, r - 3.3, "F");
      stroke(T); d.setLineWidth(0.4); d.circle(cx, cy, r - 4.3, "S");
      ink(Dk); d.setFont("helvetica", "bold"); d.setFontSize(5.7);
      arco("SEGURIDAD Y SALUD EN EL TRABAJO", r - 7.6, 90, false, 0);
      d.setFontSize(5.9); arco(String(o.empresa).toUpperCase() + " · " + anio, r - 5.3, 270, true, 0);
      [195, -15].forEach(a => { fill(T); d.circle(cx + (r - 6.5) * Math.cos(rad(a)), cy - (r - 6.5) * Math.sin(rad(a)), 0.55, "F"); });
      fill(Dk); d.circle(cx, cy, r - 10.2, "F");
      check(cx + 0.4, cy - 0.6, 7.6, T, 1.6);
      ink([255, 255, 255]); d.setFontSize(4.8); d.text("APROBADO", cx, cy + 6.2, { align: "center" });
      return;
    }

    // Sello circular de tinta, ligeramente girado
    const T = o.tinta, giro = -12, R = o.r;
    if (d.GState) d.setGState(new d.GState({ opacity: 0.88 }));
    stroke(T); d.setLineWidth(1.1); d.circle(cx, cy, R, "S");
    d.setLineWidth(0.35); d.circle(cx, cy, R - 1.8, "S");
    d.circle(cx, cy, R - 8.4, "S");
    ink(T); d.setFont("helvetica", "bold"); d.setFontSize(6);
    arco("SEGURIDAD Y SALUD EN EL TRABAJO", R - 5.9, 90, false, giro);
    d.setFontSize(6.6);
    arco(String(o.empresa).toUpperCase() + "  ·  " + o.anio, R - 3.6, 270, true, giro);
    // separadores
    [180, 0].forEach(a => { const t = rad(a + giro), rr = R - 5.1; fill(T); d.circle(cx + rr * Math.cos(t), cy - rr * Math.sin(t), 0.7, "F"); });
    // centro
    d.setFont("helvetica", "bold");
    d.setFontSize(6.4); recto("INDUCCIÓN", 0, -4.2, giro);
    d.setFontSize(10.5); recto("APROBADA", 0, 1.4, giro);
    d.setLineWidth(0.35);
    const g = rad(giro), L = (x1, y1, x2, y2) => d.line(cx + x1 * Math.cos(g) + y1 * Math.sin(g), cy - x1 * Math.sin(g) + y1 * Math.cos(g), cx + x2 * Math.cos(g) + y2 * Math.sin(g), cy - x2 * Math.sin(g) + y2 * Math.cos(g));
    L(-8.5, 3.4, 8.5, 3.4);
    d.setFontSize(6.4); recto("SST", 0, 7.4, giro);
    if (d.GState) d.setGState(new d.GState({ opacity: 1 }));
  }


  /* Certificado sobre el diseño de la empresa (plantilla JPG).
     Las posiciones están en píxeles del diseño original (1491 × 1055 px):
     cada campo es la caja gris donde va el dato [izquierda, arriba, derecha, abajo]. */
  const PLANTILLA = {
    ancho: 1491, alto: 1055,
    campos: {
      nombre:  [467, 513, 993, 566],
      dni:     [467, 581, 993, 634],
      empresa: [467, 650, 993, 702],
      cargo:   [467, 718, 993, 771],
      nota:    [467, 786, 993, 839],
      emision: [1145, 535, 1450, 577],
      vence:   [1145, 620, 1450, 663],
      codigo:  [1145, 706, 1450, 749],
      qr:      [1051, 768, 1215, 924]
    },
    color: [10, 30, 99]
  };
  function pdfPlantilla(r, fondo) {
    const { jsPDF } = window.jspdf;
    const d = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const kx = 297 / PLANTILLA.ancho, ky = 210 / PLANTILLA.alto, C = PLANTILLA.campos, col = PLANTILLA.color;
    d.addImage(fondo, "JPEG", 0, 0, 297, 210);
    // Escribe un texto dentro de una caja: lo achica si no entra
    const caja = (k, txt, tam, negrita) => {
      const [x0, y0, x1, y1] = C[k], x = (x0 + 16) * kx, ancho = (x1 - x0 - 32) * kx, cy = (y0 + y1) / 2 * ky;
      d.setFont("helvetica", negrita ? "bold" : "normal"); let t = tam; d.setFontSize(t);
      while (d.getTextWidth(txt) > ancho && t > 7) { t -= 0.5; d.setFontSize(t); }
      d.setTextColor(col[0], col[1], col[2]);
      d.text(txt, x, cy + t * 0.3528 * 0.36);
    };
    caja("nombre", String(r.nombre).toUpperCase(), 14, true);
    caja("dni", String(r.dni), 13, true);
    caja("empresa", String(r.empresa), 13, true);
    caja("cargo", String(r.cargo), 13, true);
    caja("nota", `${nota(r.nota)} / 20  ·  Aprobado`, 13, true);
    caja("emision", fmt(r.fecha), 12.5, true);
    caja("vence", fmt(r.vence), 12.5, true);
    caja("codigo", String(r.codigo), 12, true);
    // QR de verificación centrado en su recuadro
    const url = urlVerificacion(r.codigo);
    if (window.qrcode) {
      const [x0, y0, x1, y1] = C.qr, q = window.qrcode(0, "M"); q.addData(url); q.make();
      const n = q.getModuleCount(), lado = Math.min(x1 - x0, y1 - y0) * kx * 0.84, m = lado / n;
      const qx = (x0 + x1) / 2 * kx - lado / 2, qy = (y0 + y1) / 2 * ky - lado / 2;
      d.setFillColor(col[0], col[1], col[2]);
      for (let f = 0; f < n; f++) for (let c = 0; c < n; c++) if (q.isDark(f, c)) d.rect(qx + c * m, qy + f * m, m + 0.02, m + 0.02, "F");
      d.link(qx, qy, lado, lado, { url });
    }
    return d;
  }

  function pdf(r) {
    const gg = r.grupo || EMPRESAS[0].nombre;
    if (plantillas[gg]) return pdfPlantilla(r, plantillas[gg]);
    const { jsPDF } = window.jspdf;
    const d = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const W = 297, H = 210, P = 82;            // P = ancho del panel izquierdo
    const g = r.grupo || EMPRESAS[0].nombre, emp = EMPRESAS.find(e => e.nombre === g) || {};
    const hex = (h, def) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ""); if (!m) return def; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
    const NAVY = hex(emp.colorPanel, [10, 30, 99]), TEAL = hex(emp.colorAcento, [62, 198, 172]), INK = [28, 31, 38], GRIS = [107, 113, 124];
    const color = (c, f) => f ? d.setFillColor(c[0], c[1], c[2]) : d.setTextColor(c[0], c[1], c[2]);

    // Panel izquierdo de marca
    color(NAVY, 1); d.rect(0, 0, P, H, "F");
    color(TEAL, 1); d.rect(P, 0, 3, H, "F");
    const lg = logos[g];
    if (lg) { try { const ip = d.getImageProperties(lg); const lw = 62, lh = lw * ip.height / ip.width; d.addImage(lg, "JPEG", 10, 34 - lh, lw, lh); } catch (_) { } }
    else { d.setFont("helvetica", "bold"); d.setFontSize(26); color([255, 255, 255]); d.text(g, 12, 33); }
    d.setDrawColor(TEAL[0], TEAL[1], TEAL[2]); d.setLineWidth(0.8); d.line(12, 50, 30, 50);
    d.setFont("helvetica", "bold"); d.setFontSize(19); color([255, 255, 255]);
    d.text(["Inducción de", "Seguridad y Salud", "en el Trabajo"], 12, 62, { lineHeightFactor: 1.25 });
    d.setFont("helvetica", "normal"); d.setFontSize(10.5); color([207, 214, 238]);
    d.text("Personal contratista", 12, 90);
    // QR de verificación
    const url = urlVerificacion(r.codigo);
    if (window.qrcode) {
      const q = window.qrcode(0, "M"); q.addData(url); q.make();
      const n = q.getModuleCount(), lado = 24, m = lado / n, qx = 14, qy = 104;
      d.setFillColor(255, 255, 255); d.roundedRect(qx - 2.5, qy - 2.5, lado + 5, lado + 5, 1.5, 1.5, "F");
      d.setFillColor(10, 10, 30);
      for (let f = 0; f < n; f++) for (let c = 0; c < n; c++) if (q.isDark(f, c)) d.rect(qx + c * m, qy + f * m, m + 0.02, m + 0.02, "F");
      d.setFont("helvetica", "normal"); d.setFontSize(7.5); color([207, 214, 238]);
      d.text("Escanea para verificar", qx + lado + 5, qy + 10);
      d.text("este certificado", qx + lado + 5, qy + 13.5);
      d.link(qx, qy, lado, lado, { url });
    }
    // Vigencia y código al pie del panel
    const CLARO = TEAL.map(v => Math.round(v + (255 - v) * 0.35));
    d.setFontSize(8.5); color(CLARO); d.text("VÁLIDO HASTA", 12, 150);
    d.setFont("helvetica", "bold"); d.setFontSize(22); color([255, 255, 255]); d.text(fmt(r.vence), 12, 160);
    d.setFont("helvetica", "normal"); d.setFontSize(8.5); color(CLARO); d.text("CÓDIGO DE CERTIFICADO", 12, 176);
    d.setFont("courier", "bold"); d.setFontSize(12); color([255, 255, 255]); d.text(String(r.codigo), 12, 183);
    d.setFont("helvetica", "normal"); d.setFontSize(7.5); color([174, 182, 208]);
    d.text("Verificable con el área de SST de " + (r.grupo || EMPRESAS[0].nombre), 12, 193);

    // Contenido principal
    const X = P + 22, R = W - 20, CW = R - X;
    d.setFont("helvetica", "bold"); d.setFontSize(10); color(TEAL.map(v => Math.round(v * 0.62)));
    d.text("CERTIFICADO DE INDUCCIÓN", X, 34, { charSpace: 0.8 });
    d.setFont("helvetica", "bold"); d.setFontSize(30); color(NAVY);  // título en el color de la marca
    d.text("Constancia de aprobación", X, 48);
    d.setFont("helvetica", "normal"); d.setFontSize(12); color(GRIS);
    d.text(g + " certifica que", X, 66);
    // Nombre (se reduce si es muy largo)
    let fs = 28; d.setFont("helvetica", "bold"); d.setFontSize(fs);
    const nombre = String(r.nombre).toUpperCase();
    while (d.getTextWidth(nombre) > CW && fs > 16) { fs -= 1; d.setFontSize(fs); }
    color(NAVY); d.text(nombre, X, 81);
    d.setDrawColor(201, 207, 220); d.setLineWidth(0.3); d.line(X, 86, R, 86);
    d.setFont("helvetica", "normal"); d.setFontSize(12); color(INK);
    const par = `identificado(a) con documento N.° ${r.dni}, de la empresa contratista ${r.empresa}, en el cargo de ${r.cargo}, ha completado la inducción de Seguridad y Salud en el Trabajo para personal contratista y aprobó la evaluación correspondiente.`;
    d.text(d.splitTextToSize(par, CW), X, 97, { lineHeightFactor: 1.55 });

    // Tres datos
    const cajas = [["NOTA OBTENIDA", nota(r.nota) + " / 20"], ["FECHA DE EMISIÓN", fmt(r.fecha)], ["VÁLIDO HASTA", fmt(r.vence)]];
    const bw = (CW - 12) / 3;
    cajas.forEach((c, i) => {
      const bx = X + i * (bw + 6);
      d.setFillColor(238, 241, 247); d.roundedRect(bx, 124, bw, 22, 2, 2, "F");
      d.setFont("helvetica", "normal"); d.setFontSize(8); color(GRIS); d.text(c[0], bx + 6, 132);
      d.setFont("helvetica", "bold"); d.setFontSize(15); color(NAVY); d.text(c[1], bx + 6, 141);
    });

    // Sello en lugar de firma
    const tipoSello = window.FP_SELLO || emp.sello || (window.FP_CONFIG || {}).SELLO || "imagen";
    const oscuro = NAVY.reduce((a, v) => a + v, 0) < 200 ? NAVY : [17, 19, 26];
    dibujarSello(d, tipoSello, R - 28, 174, { r: 21, tinta: TEAL.map(v => Math.round(v * 0.8)), oscuro, empresa: g, anio: String(r.fecha).slice(0, 4), imagen: sellos[g], icono: iconos[g] });
    d.setFont("helvetica", "bold"); d.setFontSize(10); color(INK); d.text("Área de Seguridad y Salud en el Trabajo", X, 180);
    d.setFont("helvetica", "normal"); d.setFontSize(9.5); color(GRIS); d.text(g, X, 185);
    d.setFontSize(8); d.text("Documento generado automáticamente por la plataforma de inducción.", X, 192);
    return d;
  }
  const guardados = {};
  async function entregar(r, msg, soloGuardar) {
    if (!window.jspdf) { msg.textContent = "No se pudo preparar el PDF. Recarga la página."; return; }
    const doc = pdf(r);
    const archivo = `Certificado_Induccion_${String(r.grupo || "").replace(/[^A-Za-z0-9]+/g, "")}_${String(r.nombre).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_")}_${r.dni}.pdf`;
    if (!soloGuardar) doc.save(archivo);
    if (guardados[r.codigo]) return;
    guardados[r.codigo] = true;
    msg.textContent = "Guardando tu certificado…";
    try {
      const res = await api("certificado", { codigo: r.codigo, pdf: doc.output("datauristring").split(",")[1] });
      msg.textContent = res.enviado ? "Listo. También te enviamos el certificado a tu correo." : "Tu certificado quedó registrado.";
    } catch (e) { guardados[r.codigo] = false; msg.textContent = "Tu resultado quedó registrado. Descarga tu certificado con el botón."; }
  }

  paso(1);
})();
