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
    del.append(window.icono("basura"), " Eliminar");
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
    seed: (Math.random() * 2 ** 31) | 0,
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

// Caché de imágenes insertadas (dataURL → Image)
const cacheImagenes = new Map();
function imagenDe(dataUrl) {
  let img = cacheImagenes.get(dataUrl);
  if (!img) {
    img = new Image();
    img.src = dataUrl;
    img.onload = () => redibujar();
    cacheImagenes.set(dataUrl, img);
  }
  return img;
}

// Generador pseudoaleatorio con semilla (mulberry32): el ruido de lápiz,
// crayola y aerosol debe verse idéntico cada vez que se redibuja el trazo
function rngDe(semilla) {
  let a = semilla >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Dibuja los segmentos suavizados de un trazo; anchoDe(p0, p1) da el grosor.
// Solo para trazos opacos: con transparencia los traslapes se ven como cuentas.
function trazarSegmentos(c, pts, anchoDe, dx = 0, dy = 0) {
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1], p1 = pts[i];
    c.beginPath();
    c.lineWidth = Math.max(0.5, anchoDe(p0, p1));
    const mx = (p0.x + p1.x) / 2 + dx, my = (p0.y + p1.y) / 2 + dy;
    c.moveTo(p0.x + dx, p0.y + dy);
    c.quadraticCurveTo(p0.x + dx, p0.y + dy, mx, my);
    c.lineTo(p1.x + dx, p1.y + dy);
    c.stroke();
  }
}

// Dibuja el trazo completo como UNA sola ruta con grosor constante:
// necesario para herramientas semitransparentes (sin traslapes visibles)
function trazarRuta(c, pts, ancho, dx = 0, dy = 0) {
  c.beginPath();
  c.lineWidth = Math.max(0.5, ancho);
  c.moveTo(pts[0].x + dx, pts[0].y + dy);
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1], p1 = pts[i];
    c.quadraticCurveTo(p0.x + dx, p0.y + dy, (p0.x + p1.x) / 2 + dx, (p0.y + p1.y) / 2 + dy);
  }
  const fin = pts[pts.length - 1];
  c.lineTo(fin.x + dx, fin.y + dy);
  c.stroke();
}

const presionMedia = pts => pts.reduce((s, p) => s + p.p, 0) / pts.length;

function dibujarTrazo(c, t) {
  if (t.tool === "image") {
    const img = imagenDe(t.dataUrl);
    if (img.complete && img.naturalWidth) c.drawImage(img, t.x, t.y, t.w, t.h);
    return;
  }
  const pts = t.puntos;
  if (pts.length < 2) return;

  c.save();
  c.lineCap = "round";
  c.lineJoin = "round";
  c.strokeStyle = t.color;
  c.fillStyle = t.color;

  const presion = (p0, p1) => (p0.p + p1.p) / 2;
  const rng = rngDe(t.seed || 1);

  switch (t.tool) {
    case "eraser":
      c.globalCompositeOperation = "destination-out";
      trazarSegmentos(c, pts, () => t.size * 3);
      break;

    case "marker": // resaltador: ancho plano, semitransparente
      c.globalAlpha = 0.35;
      trazarRuta(c, pts, t.size * 2.5);
      break;

    case "ballpoint": // bolígrafo: línea delgada y uniforme
      trazarRuta(c, pts, Math.max(1, t.size * 0.55));
      break;

    case "pencil": { // lápiz: fino, grafito tenue con doble pasada irregular
      const anchoLapiz = t.size * 0.7 * presionMedia(pts) * 1.6;
      c.globalAlpha = 0.55;
      trazarRuta(c, pts, anchoLapiz);
      c.globalAlpha = 0.25;
      trazarRuta(c, pts, anchoLapiz * 0.7, (rng() - 0.5) * 1.6, (rng() - 0.5) * 1.6);
      break;
    }

    case "brush": { // pincel: una sola pasada opaca, ancha, con puntas afiladas
      const n = pts.length;
      const afilar = i => Math.min(1, (i + 1) / 5, (n - i) / 5);
      let i = 0;
      trazarSegmentos(c, pts, (p0, p1) => {
        const w = t.size * 2 * Math.pow(presion(p0, p1), 1.3) * 1.8 * afilar(i);
        i++;
        return w;
      });
      break;
    }

    case "calligraphy": { // caligrafía: plumilla plana a 45°, opaca
      trazarSegmentos(c, pts, (p0, p1) => {
        const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
        return t.size * 1.8 * (0.25 + Math.abs(Math.sin(ang - Math.PI / 4)) * 1.3);
      });
      break;
    }

    case "crayon": { // crayola: cuerpo ceroso uniforme + grano en los bordes
      const anchoCera = t.size * 1.4 * (0.8 + presionMedia(pts) * 0.6);
      c.globalAlpha = 0.8;
      trazarRuta(c, pts, anchoCera);
      c.globalAlpha = 0.22;
      pts.forEach(p => {
        for (let k = 0; k < 3; k++) {
          const ang = rng() * Math.PI * 2;
          const dist = (0.3 + rng() * 0.55) * anchoCera;
          c.beginPath();
          c.arc(p.x + Math.cos(ang) * dist, p.y + Math.sin(ang) * dist,
            0.6 + rng() * 1.2, 0, Math.PI * 2);
          c.fill();
        }
      });
      break;
    }

    case "neon": { // neón: halo brillante del color + núcleo claro (a propósito)
      const anchoNeon = t.size * 1.4 * (0.7 + presionMedia(pts) * 0.6);
      c.shadowColor = t.color;
      c.shadowBlur = t.size * 3;
      trazarRuta(c, pts, anchoNeon);
      c.shadowBlur = 0;
      c.strokeStyle = "rgba(255,255,255,0.85)";
      trazarRuta(c, pts, anchoNeon * 0.45);
      break;
    }

    case "dashed": // línea punteada: guiones redondeados uniformes
      c.setLineDash([t.size * 2.5, t.size * 2.2]);
      trazarRuta(c, pts, t.size * (0.6 + presionMedia(pts) * 0.8));
      break;

    case "spray": { // aerosol: nube de puntos alrededor del recorrido
      c.globalAlpha = 0.28;
      const radio = t.size * 2.2;
      pts.forEach(p => {
        const n = 6 + Math.round(t.size * 1.5);
        for (let k = 0; k < n; k++) {
          const ang = rng() * Math.PI * 2;
          const dist = Math.sqrt(rng()) * radio * (0.5 + p.p);
          const r = 0.5 + rng() * Math.max(0.8, t.size * 0.12);
          c.beginPath();
          c.arc(p.x + Math.cos(ang) * dist, p.y + Math.sin(ang) * dist, r, 0, Math.PI * 2);
          c.fill();
        }
      });
      break;
    }

    default: // pluma: grosor sensible a la presión
      trazarSegmentos(c, pts, (p0, p1) => t.size * presion(p0, p1) * 1.6);
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

// ---------- Paleta de colores propia ----------
(function initPaleta() {
  const input = document.getElementById("ed-color");
  const btn = document.getElementById("ed-color-btn");
  const pop = document.getElementById("ed-palette");
  const grid = document.getElementById("palette-grid");
  const custom = document.getElementById("palette-custom");
  if (!input || !btn || !pop || !grid) return;

  const colores = [
    "#1a1a2e", "#5b5670", "#8a8698", "#ffffff",
    "#6d5ce8", "#9a54e0", "#c94fd0", "#e85cb0",
    "#e5484d", "#f5651a", "#f5a524", "#f2d024",
    "#30a46c", "#12b3a6", "#2f9be8", "#4657e5"
  ];

  const pintaBtn = () => { btn.style.background = input.value; };
  const marca = () => {
    [...grid.children].forEach(s =>
      s.classList.toggle("sel", s.dataset.c.toLowerCase() === input.value.toLowerCase()));
  };
  const cerrar = () => pop.classList.add("hidden");
  const abrir = () => { pop.classList.remove("hidden"); marca(); };

  colores.forEach(c => {
    const s = document.createElement("button");
    s.type = "button";
    s.className = "swatch" + (c.toLowerCase() === "#ffffff" ? " swatch-blanco" : "");
    s.dataset.c = c;
    s.style.background = c;
    s.setAttribute("aria-label", "Color " + c);
    s.addEventListener("click", () => {
      input.value = c;
      pintaBtn();
      marca();
      cerrar();
    });
    grid.appendChild(s);
  });

  btn.addEventListener("click", ev => {
    ev.stopPropagation();
    pop.classList.contains("hidden") ? abrir() : cerrar();
  });
  // "Personalizado" abre el selector nativo para cualquier color
  if (custom) custom.addEventListener("click", () => input.click());
  input.addEventListener("input", () => { pintaBtn(); marca(); });
  document.addEventListener("click", ev => {
    if (!pop.contains(ev.target) && ev.target !== btn) cerrar();
  });

  pintaBtn();
})();

// Autoguardado cada 20 s mientras el editor está abierto
setInterval(() => {
  if (!editor.classList.contains("hidden")) guardarNota();
}, 20000);

// ---------- API para el módulo de IA (js/ai.js) ----------
window.notasAPI = {
  editorAbierto: () => !editor.classList.contains("hidden"),
  hayTrazos: () => trazos.length > 0,
  // PNG del lienzo actual (incluye fondo blanco)
  exportarPNG() {
    return canvas.toDataURL("image/png");
  },
  // Inserta una imagen generada como elemento de la nota, centrada
  insertarImagen(dataUrl) {
    const img = imagenDe(dataUrl);
    const colocar = () => {
      const rect = canvas.getBoundingClientRect();
      const maxW = rect.width * 0.6;
      const escala = Math.min(maxW / img.naturalWidth, 1);
      const w = img.naturalWidth * escala;
      const h = img.naturalHeight * escala;
      trazos.push({
        tool: "image",
        dataUrl,
        x: (rect.width - w) / 2,
        y: Math.max(20, (rect.height - h) / 2),
        w, h
      });
      rehacer = [];
      redibujar();
      guardarNota();
    };
    if (img.complete && img.naturalWidth) colocar();
    else img.addEventListener("load", colocar, { once: true });
  }
};
