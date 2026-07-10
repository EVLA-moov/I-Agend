/* ============ IRIS — agenda, tareas, calendario, recordatorios ============ */
"use strict";

// ---------- Almacenamiento ----------
const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  },
  set(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
};

let tareas = store.get("iris.tareas", []);   // {id, titulo, fecha, hora, prioridad, recordar, notas, hecha, avisada, lista}
let eventos = store.get("iris.eventos", []); // {id, titulo, fecha, hora, recordar, notas, avisado}
let listas = store.get("iris.listas", []);   // ["Compras", "Escuela", …]

const guardarTareas = () => store.set("iris.tareas", tareas);
const guardarEventos = () => store.set("iris.eventos", eventos);
const guardarListas = () => store.set("iris.listas", listas);

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ---------- Fechas ----------
const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const fmtFechaLarga = (d) =>
  d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
const fmtFechaCorta = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
};

// ---------- Navegación entre vistas ----------
const TITULOS = { hoy: "Hoy", calendario: "Calendario", tareas: "Tareas", notas: "Notas" };
let vistaActual = "hoy";

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => mostrarVista(tab.dataset.view));
});

function mostrarVista(nombre) {
  vistaActual = nombre;
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById("view-" + nombre).classList.add("active");
  document.querySelectorAll(".tab").forEach(t =>
    t.classList.toggle("active", t.dataset.view === nombre));
  document.getElementById("view-title").textContent = TITULOS[nombre];
  render();
}

// ---------- Render general ----------
function render() {
  document.getElementById("header-date").textContent = fmtFechaLarga(new Date());
  if (vistaActual === "hoy") renderHoy();
  if (vistaActual === "calendario") renderCalendario();
  if (vistaActual === "tareas") renderTareas();
  if (vistaActual === "notas" && window.renderNotas) window.renderNotas();
  if (typeof actualizarBadge === "function") actualizarBadge();
}

// ---------- Vista Hoy ----------
function renderHoy() {
  const h = new Date().getHours();
  const saludo = h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
  document.getElementById("saludo").textContent = `${saludo} 👋`;

  const hoy = hoyISO();
  const tHoy = tareas.filter(t => t.fecha === hoy && !t.hecha);
  const tVencidas = tareas.filter(t => t.fecha && t.fecha < hoy && !t.hecha);
  const eHoy = eventos.filter(e => e.fecha === hoy);

  const partes = [];
  partes.push(tHoy.length ? `${tHoy.length} tarea${tHoy.length > 1 ? "s" : ""} para hoy` : "Sin tareas para hoy");
  if (tVencidas.length) partes.push(`${tVencidas.length} vencida${tVencidas.length > 1 ? "s" : ""}`);
  partes.push(eHoy.length ? `${eHoy.length} evento${eHoy.length > 1 ? "s" : ""}` : "sin eventos");
  document.getElementById("resumen-dia").textContent = partes.join(" · ");

  const contT = document.getElementById("hoy-tareas");
  const pendientesHoy = [...tVencidas, ...tHoy].sort(ordenTareas);
  contT.innerHTML = "";
  if (!pendientesHoy.length) contT.innerHTML = `<p class="empty">Nada pendiente por hoy 🎉</p>`;
  pendientesHoy.forEach(t => contT.appendChild(elTarea(t)));

  const contE = document.getElementById("hoy-eventos");
  contE.innerHTML = "";
  const eOrd = [...eHoy].sort((a, b) => (a.hora || "99") < (b.hora || "99") ? -1 : 1);
  if (!eOrd.length) contE.innerHTML = `<p class="empty">Sin eventos programados</p>`;
  eOrd.forEach(e => contE.appendChild(elEvento(e)));
}

// ---------- Elementos de lista ----------
function ordenTareas(a, b) {
  if (a.fecha !== b.fecha) return (a.fecha || "9999") < (b.fecha || "9999") ? -1 : 1;
  if ((a.hora || "") !== (b.hora || "")) return (a.hora || "99") < (b.hora || "99") ? -1 : 1;
  return (b.prioridad || 0) - (a.prioridad || 0);
}

function elTarea(t) {
  const div = document.createElement("div");
  div.className = `task-item p${t.prioridad || 0}${t.hecha ? " done" : ""}`;

  const check = document.createElement("button");
  check.className = "task-check";
  check.setAttribute("aria-label", t.hecha ? "Marcar pendiente" : "Completar");
  check.textContent = t.hecha ? "✓" : "";
  check.addEventListener("click", () => {
    t.hecha = !t.hecha;
    guardarTareas();
    render();
  });

  const body = document.createElement("div");
  body.className = "task-body";
  const title = document.createElement("div");
  title.className = "task-title";
  title.textContent = t.titulo;
  body.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "task-meta";
  if (t.fecha) {
    const chip = document.createElement("span");
    const vencida = !t.hecha && t.fecha < hoyISO();
    chip.className = "meta-chip" + (vencida ? " overdue" : "");
    chip.textContent = (vencida ? "⚠ " : "📅 ") + fmtFechaCorta(t.fecha) + (t.hora ? ` · ${t.hora}` : "");
    meta.appendChild(chip);
  }
  if (t.recordar && t.hora) {
    const chip = document.createElement("span");
    chip.className = "meta-chip bell";
    chip.textContent = "🔔";
    meta.appendChild(chip);
  }
  if (t.lista) {
    const chip = document.createElement("span");
    chip.className = "meta-chip";
    chip.textContent = "📋 " + t.lista;
    meta.appendChild(chip);
  }
  if (t.notas) {
    const chip = document.createElement("span");
    chip.className = "meta-chip";
    chip.textContent = t.notas.length > 34 ? t.notas.slice(0, 34) + "…" : t.notas;
    meta.appendChild(chip);
  }
  if (meta.children.length) body.appendChild(meta);

  const del = document.createElement("button");
  del.className = "task-del";
  del.textContent = "✕";
  del.setAttribute("aria-label", "Eliminar tarea");
  del.addEventListener("click", () => {
    tareas = tareas.filter(x => x.id !== t.id);
    guardarTareas();
    render();
  });

  div.append(check, body, del);
  return div;
}

function elEvento(e) {
  const div = document.createElement("div");
  div.className = "event-item";

  const hora = document.createElement("div");
  hora.className = "event-hora";
  hora.textContent = e.hora || "—";

  const body = document.createElement("div");
  body.className = "event-body";
  const title = document.createElement("div");
  title.className = "event-title";
  title.textContent = e.titulo;
  body.appendChild(title);
  if (e.notas) {
    const n = document.createElement("div");
    n.className = "event-notas";
    n.textContent = e.notas;
    body.appendChild(n);
  }

  const del = document.createElement("button");
  del.className = "task-del";
  del.textContent = "✕";
  del.setAttribute("aria-label", "Eliminar evento");
  del.addEventListener("click", () => {
    eventos = eventos.filter(x => x.id !== e.id);
    guardarEventos();
    render();
  });

  div.append(hora, body, del);
  return div;
}

// ---------- Vista Tareas ----------
let filtroTareas = "pendientes";
let listaSel = "todas"; // "todas" o el nombre de una lista

document.querySelectorAll("#task-filters .chip").forEach(chip => {
  chip.addEventListener("click", () => {
    filtroTareas = chip.dataset.filter;
    document.querySelectorAll("#task-filters .chip").forEach(c =>
      c.classList.toggle("active", c === chip));
    renderTareas();
  });
});

document.getElementById("form-quick-task").addEventListener("submit", ev => {
  ev.preventDefault();
  const input = document.getElementById("quick-task-input");
  const titulo = input.value.trim();
  if (!titulo) return;
  tareas.push({
    id: uid(), titulo, fecha: "", hora: "", prioridad: 0, recordar: false,
    notas: "", hecha: false, avisada: false,
    lista: listaSel === "todas" ? "" : listaSel
  });
  guardarTareas();
  input.value = "";
  renderTareas();
});

// ---------- Listas de pendientes ----------
function renderListas() {
  const row = document.getElementById("listas-row");
  row.innerHTML = "";

  const pendientesDe = nombre =>
    tareas.filter(t => !t.hecha && (nombre === "todas" ? true : t.lista === nombre)).length;

  const chipDe = (nombre, etiqueta) => {
    const chip = document.createElement("button");
    chip.className = "chip" + (listaSel === nombre ? " active" : "");
    const n = pendientesDe(nombre);
    chip.textContent = etiqueta + (n ? ` (${n})` : "");
    chip.addEventListener("click", () => {
      listaSel = nombre;
      renderTareas();
    });
    return chip;
  };

  row.appendChild(chipDe("todas", "Todas"));
  listas.forEach(nombre => row.appendChild(chipDe(nombre, "📋 " + nombre)));

  // Eliminar la lista activa
  if (listaSel !== "todas") {
    const del = document.createElement("button");
    del.className = "chip chip-danger";
    del.textContent = "🗑 Eliminar lista";
    del.addEventListener("click", () => {
      if (!confirm(`¿Eliminar la lista "${listaSel}"? Sus tareas se conservan sin lista.`)) return;
      tareas.forEach(t => { if (t.lista === listaSel) t.lista = ""; });
      listas = listas.filter(n => n !== listaSel);
      listaSel = "todas";
      guardarTareas();
      guardarListas();
      renderTareas();
    });
    row.appendChild(del);
  }

  const nueva = document.createElement("button");
  nueva.className = "chip";
  nueva.textContent = "＋ Lista";
  nueva.addEventListener("click", () => {
    const nombre = (prompt("Nombre de la nueva lista (ej. Compras):") || "").trim();
    if (!nombre) return;
    if (!listas.includes(nombre)) {
      listas.push(nombre);
      guardarListas();
    }
    listaSel = nombre;
    renderTareas();
  });
  row.appendChild(nueva);
}

function renderTareas() {
  renderListas();
  const hoy = hoyISO();
  let lista;
  if (filtroTareas === "hoy") lista = tareas.filter(t => !t.hecha && t.fecha === hoy);
  else if (filtroTareas === "proximas") lista = tareas.filter(t => !t.hecha && t.fecha > hoy);
  else if (filtroTareas === "completadas") lista = tareas.filter(t => t.hecha);
  else lista = tareas.filter(t => !t.hecha);

  if (listaSel !== "todas") lista = lista.filter(t => t.lista === listaSel);

  const cont = document.getElementById("lista-tareas");
  cont.innerHTML = "";
  if (!lista.length) {
    cont.innerHTML = `<p class="empty">No hay tareas aquí</p>`;
    return;
  }
  [...lista].sort(ordenTareas).forEach(t => cont.appendChild(elTarea(t)));
}

// ---------- Vista Calendario ----------
let calFecha = new Date();          // mes visible
let calDiaSel = hoyISO();           // día seleccionado

document.getElementById("cal-prev").addEventListener("click", () => {
  calFecha.setMonth(calFecha.getMonth() - 1);
  renderCalendario();
});
document.getElementById("cal-next").addEventListener("click", () => {
  calFecha.setMonth(calFecha.getMonth() + 1);
  renderCalendario();
});

function renderCalendario() {
  const y = calFecha.getFullYear(), m = calFecha.getMonth();
  document.getElementById("cal-mes").textContent =
    calFecha.toLocaleDateString("es-MX", { month: "long", year: "numeric" });

  const grid = document.getElementById("cal-grid");
  grid.innerHTML = "";

  const primerDia = new Date(y, m, 1);
  // Semana inicia en lunes: getDay() da 0=domingo
  const offset = (primerDia.getDay() + 6) % 7;
  const inicio = new Date(y, m, 1 - offset);

  const hoy = hoyISO();
  for (let i = 0; i < 42; i++) {
    const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const btn = document.createElement("button");
    btn.className = "cal-day";
    if (d.getMonth() !== m) btn.classList.add("otro-mes");
    if (iso === hoy) btn.classList.add("hoy");
    if (iso === calDiaSel) btn.classList.add("sel");

    const num = document.createElement("span");
    num.textContent = d.getDate();
    btn.appendChild(num);

    const nT = tareas.filter(t => t.fecha === iso && !t.hecha).length;
    const nE = eventos.filter(e => e.fecha === iso).length;
    const dots = document.createElement("span");
    dots.className = "cal-dots";
    for (let k = 0; k < Math.min(nT + nE, 3); k++) dots.appendChild(document.createElement("i"));
    btn.appendChild(dots);

    btn.addEventListener("click", () => {
      calDiaSel = iso;
      renderCalendario();
    });
    grid.appendChild(btn);
  }

  // Detalle del día seleccionado
  const [sy, sm, sd] = calDiaSel.split("-").map(Number);
  document.getElementById("cal-dia-label").textContent =
    fmtFechaLarga(new Date(sy, sm - 1, sd));

  const cont = document.getElementById("cal-dia-items");
  cont.innerHTML = "";
  const eDia = eventos.filter(e => e.fecha === calDiaSel)
    .sort((a, b) => (a.hora || "99") < (b.hora || "99") ? -1 : 1);
  const tDia = tareas.filter(t => t.fecha === calDiaSel).sort(ordenTareas);
  if (!eDia.length && !tDia.length) {
    cont.innerHTML = `<p class="empty">Nada programado este día</p>`;
  }
  eDia.forEach(e => cont.appendChild(elEvento(e)));
  tDia.forEach(t => cont.appendChild(elTarea(t)));
}

// ---------- Modal nueva tarea / evento ----------
const modal = document.getElementById("modal");
let modalTipo = "tarea";

document.getElementById("btn-header-add").addEventListener("click", () => {
  if (vistaActual === "notas") {
    if (window.nuevaNota) window.nuevaNota();
    return;
  }
  abrirModal(vistaActual === "calendario" ? "evento" : "tarea");
});

document.querySelectorAll(".modal-tabs .chip").forEach(chip => {
  chip.addEventListener("click", () => setModalTipo(chip.dataset.mtab));
});

function setModalTipo(tipo) {
  modalTipo = tipo;
  document.querySelectorAll(".modal-tabs .chip").forEach(c =>
    c.classList.toggle("active", c.dataset.mtab === tipo));
  document.getElementById("m-row-prioridad").style.display = tipo === "tarea" ? "flex" : "none";
}

function abrirModal(tipo) {
  setModalTipo(tipo);
  document.getElementById("form-item").reset();
  document.getElementById("m-fecha").value =
    vistaActual === "calendario" ? calDiaSel : hoyISO();

  const sel = document.getElementById("m-lista");
  sel.innerHTML = "";
  const opt = document.createElement("option");
  opt.value = "";
  opt.textContent = "Ninguna";
  sel.appendChild(opt);
  listas.forEach(nombre => {
    const o = document.createElement("option");
    o.value = nombre;
    o.textContent = nombre;
    sel.appendChild(o);
  });
  sel.value = listaSel === "todas" ? "" : listaSel;

  modal.classList.remove("hidden");
  document.getElementById("m-titulo").focus();
}

document.getElementById("m-cancelar").addEventListener("click", () => modal.classList.add("hidden"));
modal.addEventListener("click", ev => { if (ev.target === modal) modal.classList.add("hidden"); });

document.getElementById("form-item").addEventListener("submit", ev => {
  ev.preventDefault();
  const item = {
    id: uid(),
    titulo: document.getElementById("m-titulo").value.trim(),
    fecha: document.getElementById("m-fecha").value,
    hora: document.getElementById("m-hora").value,
    recordar: document.getElementById("m-recordar").checked,
    notas: document.getElementById("m-notas").value.trim()
  };
  if (!item.titulo) return;

  if (item.recordar) pedirPermisoNotificaciones();

  if (modalTipo === "tarea") {
    item.prioridad = Number(document.getElementById("m-prioridad").value);
    item.lista = document.getElementById("m-lista").value;
    item.hecha = false;
    item.avisada = false;
    tareas.push(item);
    guardarTareas();
  } else {
    item.avisado = false;
    eventos.push(item);
    guardarEventos();
  }
  modal.classList.add("hidden");
  render();
});

// Crea tareas desde texto reconocido por la IA (una por línea)
window.crearTareasDesdeTexto = function (lineas) {
  lineas.forEach(titulo => {
    tareas.push({ id: uid(), titulo, fecha: "", hora: "", prioridad: 0, recordar: false, notas: "", hecha: false, avisada: false });
  });
  guardarTareas();
  mostrarToast(`✓ ${lineas.length} tarea${lineas.length > 1 ? "s" : ""} creada${lineas.length > 1 ? "s" : ""}`);
  render();
};

// ---------- Recordatorios ----------
function pedirPermisoNotificaciones() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function mostrarToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.remove("hidden");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add("hidden"), 6000);
}

function notificar(titulo, cuerpo) {
  mostrarToast(`🔔 ${titulo}${cuerpo ? " — " + cuerpo : ""}`);
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  // En la app instalada de iOS, new Notification() no existe: hay que usar el SW
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready
      .then(reg => reg.showNotification(titulo, {
        body: cuerpo,
        icon: "icons/icon-192.png",
        badge: "icons/icon-192.png"
      }))
      .catch(() => {
        try { new Notification(titulo, { body: cuerpo, icon: "icons/apple-touch-icon.png" }); }
        catch { /* solo queda el toast */ }
      });
  } else {
    try { new Notification(titulo, { body: cuerpo, icon: "icons/apple-touch-icon.png" }); }
    catch { /* solo queda el toast */ }
  }
}

// Globito con el número de pendientes en el ícono de la app (iOS 16.4+ instalada)
function actualizarBadge() {
  if (!("setAppBadge" in navigator)) return;
  const hoy = hoyISO();
  const n = tareas.filter(t => !t.hecha && t.fecha && t.fecha <= hoy).length;
  if (n > 0) navigator.setAppBadge(n).catch(() => {});
  else navigator.clearAppBadge().catch(() => {});
}

function revisarRecordatorios() {
  const ahora = new Date();
  const hoy = hoyISO();
  const horaAhora = `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`;

  tareas.forEach(t => {
    if (t.recordar && !t.avisada && !t.hecha && t.fecha === hoy && t.hora && t.hora <= horaAhora) {
      t.avisada = true;
      notificar("Tarea pendiente", t.titulo);
      guardarTareas();
    }
  });
  eventos.forEach(e => {
    if (e.recordar && !e.avisado && e.fecha === hoy && e.hora && e.hora <= horaAhora) {
      e.avisado = true;
      notificar("Evento ahora", e.titulo);
      guardarEventos();
    }
  });
  actualizarBadge();
}
setInterval(revisarRecordatorios, 30000);
// Al regresar a la app, revisar de inmediato lo que venció mientras tanto
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) revisarRecordatorios();
});

// ---------- Service worker (offline) ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

// ---------- Inicio ----------
render();
revisarRecordatorios();
