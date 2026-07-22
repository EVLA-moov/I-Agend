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

// Ventana propia para pedir texto (reemplaza prompt() nativo, que autocorrige
// y no combina con el diseño). Devuelve una promesa con el texto o null.
function pedirTexto({ titulo = "Nombre", placeholder = "", valor = "", ok = "Aceptar" } = {}) {
  return new Promise(resolve => {
    const modal = document.getElementById("modal-prompt");
    const form = document.getElementById("prompt-form");
    const input = document.getElementById("prompt-input");
    document.getElementById("prompt-titulo").textContent = titulo;
    document.getElementById("prompt-ok").textContent = ok;
    input.placeholder = placeholder;
    input.value = valor;
    modal.classList.remove("hidden");
    setTimeout(() => input.focus(), 50);

    const cerrar = (resultado) => {
      modal.classList.add("hidden");
      form.onsubmit = null;
      document.getElementById("prompt-cancelar").onclick = null;
      modal.onclick = null;
      resolve(resultado);
    };
    form.onsubmit = ev => { ev.preventDefault(); cerrar(input.value.trim() || null); };
    document.getElementById("prompt-cancelar").onclick = () => cerrar(null);
    modal.onclick = ev => { if (ev.target === modal) cerrar(null); };
  });
}
window.pedirTexto = pedirTexto;

// Crea un ícono SVG de la biblioteca de símbolos (#i-<nombre> en index.html)
window.icono = function (nombre) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "icn");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", "#i-" + nombre);
  svg.appendChild(use);
  return svg;
};

// ---------- Fechas ----------
const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
// Solo la primera letra en mayúscula ("Domingo, 12 de julio", no "12 De Julio")
const capitalizar = s => s.charAt(0).toUpperCase() + s.slice(1);
const fmtFechaLarga = (d) =>
  capitalizar(d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" }));
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
  document.getElementById("saludo").textContent = saludo;

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
  if (!pendientesHoy.length) contT.innerHTML = `<p class="empty">Todo en orden por hoy</p>`;
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
    chip.append(icono(vencida ? "alerta" : "calendario"),
      " " + fmtFechaCorta(t.fecha) + (t.hora ? ` · ${t.hora}` : ""));
    meta.appendChild(chip);
  }
  if (t.recordar && t.hora) {
    const chip = document.createElement("span");
    chip.className = "meta-chip bell";
    chip.appendChild(icono("campana"));
    meta.appendChild(chip);
  }
  if (t.lista) {
    const chip = document.createElement("span");
    chip.className = "meta-chip";
    chip.append(icono("lista"), " " + t.lista);
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
    mostrarToastAccion("Tarea eliminada", "Deshacer", () => {
      tareas.push(t);
      guardarTareas();
      render();
    });
  });

  // Tocar el cuerpo abre la ficha para ver/editar
  body.addEventListener("click", () => abrirModalEditar("tarea", t));

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
    mostrarToastAccion("Evento eliminado", "Deshacer", () => {
      eventos.push(e);
      guardarEventos();
      render();
    });
  });

  // Tocar el cuerpo abre la ficha para ver/editar
  body.addEventListener("click", () => abrirModalEditar("evento", e));

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

  // La tarea nueva debe quedar VISIBLE con el filtro activo: si el filtro pide
  // fecha, se la asignamos; si no encaja de ningún modo, volvemos a Pendientes
  let fecha = "";
  if (filtroTareas === "hoy") {
    fecha = hoyISO();
  } else if (filtroTareas === "proximas") {
    const m = new Date();
    m.setDate(m.getDate() + 1);
    fecha = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-${String(m.getDate()).padStart(2, "0")}`;
  } else if (filtroTareas === "completadas") {
    filtroTareas = "pendientes";   // una tarea nueva nunca está completada
    document.querySelectorAll("#task-filters .chip").forEach(c =>
      c.classList.toggle("active", c.dataset.filter === "pendientes"));
  }

  tareas.push({
    id: uid(), titulo, fecha, hora: "", prioridad: 0, recordar: false,
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

  const chipDe = (nombre, etiqueta, icn) => {
    const chip = document.createElement("button");
    chip.className = "chip" + (listaSel === nombre ? " active" : "");
    const n = pendientesDe(nombre);
    if (icn) chip.appendChild(icono(icn));
    chip.append(etiqueta + (n ? ` (${n})` : ""));
    chip.addEventListener("click", () => {
      listaSel = nombre;
      renderTareas();
    });
    return chip;
  };

  row.appendChild(chipDe("todas", "Todas"));
  listas.forEach(nombre => row.appendChild(chipDe(nombre, nombre, "lista")));

  // Eliminar la lista activa
  if (listaSel !== "todas") {
    const del = document.createElement("button");
    del.className = "chip chip-danger";
    del.append(icono("basura"), " Eliminar lista");
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
  nueva.addEventListener("click", async () => {
    const nombre = await pedirTexto({
      titulo: "Nueva lista",
      placeholder: "Ej. Compras",
      ok: "Crear"
    });
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

// Navegar por meses fijando el día 1: con setMonth() sobre un día 29-31 el
// desbordamiento saltaba meses (ej. 31 ene + 1 mes = "31 feb" = 3 de marzo)
document.getElementById("cal-prev").addEventListener("click", () => {
  calFecha = new Date(calFecha.getFullYear(), calFecha.getMonth() - 1, 1);
  renderCalendario();
});
document.getElementById("cal-next").addEventListener("click", () => {
  calFecha = new Date(calFecha.getFullYear(), calFecha.getMonth() + 1, 1);
  renderCalendario();
});

function renderCalendario() {
  const y = calFecha.getFullYear(), m = calFecha.getMonth();
  document.getElementById("cal-mes").textContent =
    capitalizar(calFecha.toLocaleDateString("es-MX", { month: "long", year: "numeric" }));

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
let editando = null;   // {tipo, id} cuando se edita un elemento existente

// Rellena el desplegable de listas y selecciona un valor
function poblarSelectLista(valor) {
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
  sel.value = valor || "";
}

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
  editando = null;
  setModalTipo(tipo);
  document.getElementById("form-item").reset();
  document.getElementById("m-fecha").value =
    vistaActual === "calendario" ? calDiaSel : hoyISO();
  poblarSelectLista(listaSel === "todas" ? "" : listaSel);

  // Modo "nuevo": pestañas visibles, sin título de edición ni botón eliminar
  document.querySelector("#modal .modal-tabs").classList.remove("hidden");
  document.getElementById("m-edit-title").classList.add("hidden");
  document.getElementById("m-eliminar").classList.add("hidden");

  modal.classList.remove("hidden");
  document.getElementById("m-titulo").focus();
}

// Abre la ficha de un elemento existente para verlo y editarlo
function abrirModalEditar(tipo, item) {
  editando = { tipo, id: item.id };
  setModalTipo(tipo);
  document.getElementById("form-item").reset();

  document.getElementById("m-titulo").value = item.titulo || "";
  document.getElementById("m-fecha").value = item.fecha || "";
  document.getElementById("m-hora").value = item.hora || "";
  document.getElementById("m-recordar").checked = !!item.recordar;
  document.getElementById("m-notas").value = item.notas || "";
  if (tipo === "tarea") {
    document.getElementById("m-prioridad").value = String(item.prioridad || 0);
    poblarSelectLista(item.lista || "");
  }

  // Modo "editar": oculta las pestañas (no se cambia el tipo), muestra
  // título de edición y el botón de eliminar
  document.querySelector("#modal .modal-tabs").classList.add("hidden");
  const titulo = document.getElementById("m-edit-title");
  titulo.textContent = tipo === "tarea" ? "Editar tarea" : "Editar evento";
  titulo.classList.remove("hidden");
  document.getElementById("m-eliminar").classList.remove("hidden");

  modal.classList.remove("hidden");
}

document.getElementById("m-cancelar").addEventListener("click", () => modal.classList.add("hidden"));
modal.addEventListener("click", ev => { if (ev.target === modal) modal.classList.add("hidden"); });

document.getElementById("form-item").addEventListener("submit", ev => {
  ev.preventDefault();
  const titulo = document.getElementById("m-titulo").value.trim();
  if (!titulo) return;
  const fecha = document.getElementById("m-fecha").value;
  const hora = document.getElementById("m-hora").value;
  const recordar = document.getElementById("m-recordar").checked;
  const notas = document.getElementById("m-notas").value.trim();
  if (recordar) pedirPermisoNotificaciones();

  // ---- Editar un elemento existente ----
  if (editando) {
    if (editando.tipo === "tarea") {
      const t = tareas.find(x => x.id === editando.id);
      if (t) {
        Object.assign(t, {
          titulo, fecha, hora, recordar, notas,
          prioridad: Number(document.getElementById("m-prioridad").value),
          lista: document.getElementById("m-lista").value,
          avisada: false   // permitir que el recordatorio vuelva a sonar
        });
      }
      guardarTareas();
    } else {
      const e = eventos.find(x => x.id === editando.id);
      if (e) Object.assign(e, { titulo, fecha, hora, recordar, notas, avisado: false });
      guardarEventos();
    }
    editando = null;
    modal.classList.add("hidden");
    render();
    return;
  }

  // ---- Crear nuevo ----
  const item = { id: uid(), titulo, fecha, hora, recordar, notas };
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

// Eliminar desde la ficha de edición (con opción de deshacer)
document.getElementById("m-eliminar").addEventListener("click", () => {
  if (!editando) return;
  const esTarea = editando.tipo === "tarea";
  const item = (esTarea ? tareas : eventos).find(x => x.id === editando.id);
  if (esTarea) {
    tareas = tareas.filter(x => x.id !== editando.id);
    guardarTareas();
  } else {
    eventos = eventos.filter(x => x.id !== editando.id);
    guardarEventos();
  }
  editando = null;
  modal.classList.add("hidden");
  render();
  if (item) {
    mostrarToastAccion(esTarea ? "Tarea eliminada" : "Evento eliminado", "Deshacer", () => {
      if (esTarea) { tareas.push(item); guardarTareas(); }
      else { eventos.push(item); guardarEventos(); }
      render();
    });
  }
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

// Toast con botón de acción (ej. "Deshacer" tras eliminar)
function mostrarToastAccion(msg, etiqueta, onAccion) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  const btn = document.createElement("button");
  btn.className = "toast-accion";
  btn.textContent = etiqueta;
  btn.addEventListener("click", () => {
    clearTimeout(toast._timer);
    toast.classList.add("hidden");
    onAccion();
  });
  toast.appendChild(btn);
  toast.classList.remove("hidden");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add("hidden"), 6000);
}
window.mostrarToastAccion = mostrarToastAccion; // usada también por notes.js

function notificar(titulo, cuerpo) {
  mostrarToast(`${titulo}${cuerpo ? " — " + cuerpo : ""}`);
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

// ¿Ya venció? Cuenta lo de días pasados, no solo lo de hoy: si la app estaba
// cerrada a la hora del aviso, el recordatorio debe sonar al volver
function yaVencio(fecha, hora, hoy, horaAhora) {
  if (!fecha) return false;
  if (fecha < hoy) return true;                       // de días anteriores
  return fecha === hoy && (!hora || hora <= horaAhora);
}

function revisarRecordatorios() {
  const ahora = new Date();
  const hoy = hoyISO();
  const horaAhora = `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`;

  const vencidos = [];
  tareas.forEach(t => {
    if (t.recordar && !t.avisada && !t.hecha && t.hora && yaVencio(t.fecha, t.hora, hoy, horaAhora)) {
      t.avisada = true;
      vencidos.push({ tipo: "tarea", titulo: t.titulo, atrasado: t.fecha < hoy });
    }
  });
  eventos.forEach(e => {
    if (e.recordar && !e.avisado && e.hora && yaVencio(e.fecha, e.hora, hoy, horaAhora)) {
      e.avisado = true;
      vencidos.push({ tipo: "evento", titulo: e.titulo, atrasado: e.fecha < hoy });
    }
  });

  if (vencidos.length) {
    guardarTareas();
    guardarEventos();
    if (vencidos.length === 1) {
      const v = vencidos[0];
      notificar(v.atrasado ? "Recordatorio atrasado"
        : (v.tipo === "tarea" ? "Tarea pendiente" : "Evento ahora"), v.titulo);
    } else {
      // Varios a la vez (típico al volver a abrir la app): un solo resumen
      notificar(`Tienes ${vencidos.length} recordatorios pendientes`,
        vencidos.map(v => v.titulo).join(" · "));
    }
  }
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

// Pedir almacenamiento persistente: sin esto el navegador puede purgar
// localStorage/IndexedDB (¡todas las tareas y notas!) si falta espacio
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}

// ---------- Inicio ----------
render();
revisarRecordatorios();
