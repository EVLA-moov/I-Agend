/* ============ IRIS — notas de escritura a mano (Apple Pencil) ============ */
"use strict";

// Las notas se guardan en IndexedDB como trazos vectoriales + miniatura PNG.
// Cada nota: {id, titulo, trazos, thumb, actualizada}
// Cada trazo: {tool, color, size, puntos:[{x, y, p}]}   (p = presión 0–1)

const DB_NAME = "iris-notas";
const DB_STORE = "notas";

function abrirDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function dbTodas() {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(DB_STORE).objectStore(DB_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
async function dbGuardar(nota) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(nota);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
async function dbBorrar(id) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

// ---------- Galería ----------
async function renderNotas() {
  const grid = document.getElementById("notas-grid");
  const notas = (await dbTodas()).sort((a, b) => b.actualizada - a.actualizada);
  grid.innerHTML = "";

  const nueva = document.createElement("button");
  nueva.className = "note-new";
  nueva.textContent = "＋ Nueva nota";
  nueva.addEventListener("click", nuevaNota);
  grid.appendChild(nueva);

  notas.forEach(nota => {
    const card = document.createElement("div");
    card.className = "note-card";

    const btn = document.createElement("button");
    btn.className = "note-card";
    btn.style.boxShadow = "none";

    const img = document.createElement("img");
    img.className = "note-thumb";
    img.alt = nota.titulo || "Nota";
    if (nota.thumb) img.src = nota.thumb;
    btn.appendChild(img);

    const info = document.createElement("div");
    info.className = "note-info";
    const name = document.createElement("div");
    name.className = "note-name";
    name.textContent = nota.titulo || "Sin título";
    const date = document.createElement("div");
    date.className = "note-date";
    date.textContent = new Date(nota.actualizada).toLocaleDateString("es-MX", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
    });
    info.append(name, date);
    btn.appendChild(info);
    btn.addEventListener("click", () => abrirEditor(nota));

    const del = document.createElement("button");
    del.className = "note-del";
    del.textContent = "🗑 Eliminar";
    del.addEventListener("click", async ev => {
      ev.stopPropagation();
      await dbBorrar(nota.id);
      renderNotas();
    });

    card.append(btn, del);
    grid.appendChild(card);
  });
}
window.renderNotas = renderNotas;

function nuevaNota() {
  abrirEditor({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    titulo: "",
    trazos: [],
    thumb: "",
    actualizada: Date.now()
  });
}
window.nuevaNota = nuevaNota;

// ---------- Editor ----------
const editor = document.getElementById("editor-notas");
const canvas = document.getElementById("ed-canvas");
const ctx = canvas.getContext("2d");

let notaActual = null;
let trazos = [];        // trazos confirmados
let rehacer = [];       // pila de rehacer
let trazoActivo = null; // trazo en curso
let herramienta = "pen";

function ajustarCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  redibujar();
}
window.addEventListener("resize", () => {
  if (!editor.classList.contains("hidden")) ajustarCanvas();
});

function abrirEditor(nota) {
  notaActual = nota;
  trazos = (nota.trazos || []).map(t => ({ ...t, puntos: [...t.puntos] }));
  rehacer = [];
  document.getElementById("ed-titulo").value = nota.titulo || "";
  editor.classList.remove("hidden");
  requestAnimationFrame(ajustarCanvas);
}

document.getElementById("ed-volver").addEventListener("click", async () => {
  await guardarNota();
  editor.classList.add("hidden");
  renderNotas();
});

async function guardarNota() {
  if (!notaActual) return;
  const titulo = document.getElementById("ed-titulo").value.trim();
  // No guardar notas totalmente vacías y sin título
  if (!trazos.length && !titulo) return;

  // Miniatura
  const thumbCanvas = document.createElement("canvas");
  thumbCanvas.width = 400;
  thumbCanvas.height = 300;
  const tctx = thumbCanvas.getContext("2d");
  tctx.fillStyle = "#fff";
  tctx.fillRect(0, 0, 400, 300);
  const escala = Math.min(400 / canvas.getBoundingClientRect().width, 1);
  tctx.scale(escala, escala);
  trazos.forEach(t => dibujarTrazo(tctx, t));

  notaActual.titulo = titulo;
  notaActual.trazos = trazos;
  notaActual.thumb = thumbCanvas.toDataURL("image/png");
  notaActual.actualizada = Date.now();
  await dbGuardar(notaActual);
}

// ---------- Herramientas ----------
document.querySelectorAll(".toolbar-tools .tool").forEach(btn => {
  btn.addEventListener("click", () => {
    herramienta = btn.dataset.tool;
    document.querySelectorAll(".toolbar-tools .tool").forEach(b =>
      b.classList.toggle("active", b === btn));
  });
});

document.getElementById("ed-undo").addEventListener("click", () => {
  if (trazos.length) {
    rehacer.push(trazos.pop());
    redibujar();
  }
});
document.getElementById("ed-redo").addEventListener("click", () => {
  if (rehacer.length) {
    trazos.push(rehacer.pop());
    redibujar();
  }
});
document.getElementById("ed-clear").addEventListener("click", () => {
  if (!trazos.length) return;
  rehacer = [...trazos.reverse()];
  trazos = [];
  redibujar();
});

// ---------- Dibujo con Pointer Events (Apple Pencil incluido) ----------
function puntoDesdeEvento(ev) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ev.clientX - rect.left,
    y: ev.clientY - rect.top,
    p: ev.pressure && ev.pressure > 0 ? ev.pressure : 0.5
  };
}

function permitido(ev) {
  const soloPencil = document.getElementById("ed-solo-pencil").checked;
  if (soloPencil) return ev.pointerType === "pen";
  return true;
}

canvas.addEventListener("pointerdown", ev => {
  if (!permitido(ev)) return;
  ev.preventDefault();
  try { canvas.setPointerCapture(ev.pointerId); } catch { /* algunos entornos no lo soportan */ }
  trazoActivo = {
    tool: herramienta,
    color: document.getElementById("ed-color").value,
    size: Number(document.getElementById("ed-grosor").value),
    puntos: [puntoDesdeEvento(ev)]
  };
});

canvas.addEventListener("pointermove", ev => {
  if (!trazoActivo || !permitido(ev)) return;
  ev.preventDefault();
  // getCoalescedEvents da los puntos intermedios de alta frecuencia del Pencil
  let evs = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [];
  if (!evs.length) evs = [ev];
  evs.forEach(e => trazoActivo.puntos.push(puntoDesdeEvento(e)));
  redibujar();
  dibujarTrazo(ctx, trazoActivo);
});

function terminarTrazo(ev) {
  if (!trazoActivo) return;
  if (trazoActivo.puntos.length > 1) {
    trazos.push(trazoActivo);
    rehacer = [];
  }
  trazoActivo = null;
  redibujar();
}
canvas.addEventListener("pointerup", terminarTrazo);
canvas.addEventListener("pointercancel", terminarTrazo);

function dibujarTrazo(c, t) {
  const pts = t.puntos;
  if (pts.length < 2) return;

  c.save();
  c.lineCap = "round";
  c.lineJoin = "round";

  if (t.tool === "eraser") {
    c.globalCompositeOperation = "destination-out";
    c.strokeStyle = "rgba(0,0,0,1)";
  } else if (t.tool === "marker") {
    c.globalAlpha = 0.35;
    c.strokeStyle = t.color;
  } else {
    c.strokeStyle = t.color;
  }

  const base = t.tool === "eraser" ? t.size * 3 : t.tool === "marker" ? t.size * 2.5 : t.size;

  // Segmentos con grosor variable según presión, suavizados con puntos medios
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1], p1 = pts[i];
    c.beginPath();
    c.lineWidth = Math.max(0.5, base * (t.tool === "marker" ? 1 : (p0.p + p1.p) / 2 * 1.6));
    const mx = (p0.x + p1.x) / 2, my = (p0.y + p1.y) / 2;
    c.moveTo(p0.x, p0.y);
    c.quadraticCurveTo(p0.x, p0.y, mx, my);
    c.lineTo(p1.x, p1.y);
    c.stroke();
  }
  c.restore();
}

function redibujar() {
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, rect.width, rect.height);
  trazos.forEach(t => dibujarTrazo(ctx, t));
}

// Autoguardado cada 20 s mientras el editor está abierto
setInterval(() => {
  if (!editor.classList.contains("hidden")) guardarNota();
}, 20000);
