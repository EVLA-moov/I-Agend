/* ============ IRIS — funciones de IA (Google Gemini, modelo BYOK) ============
   La clave de API la pone cada usuario en Ajustes y vive solo en su dispositivo
   (localStorage). El código público nunca contiene claves. */
"use strict";

const IA = {
  MODELO_TEXTO: "gemini-2.5-flash",
  MODELO_IMAGEN: "gemini-2.5-flash-image",
  get clave() { return localStorage.getItem("iris.gemini_key") || ""; },
  set clave(v) { localStorage.setItem("iris.gemini_key", v); }
};

async function llamarGemini(modelo, parts, generationConfig) {
  if (!IA.clave) throw new Error("SIN_CLAVE");

  const body = { contents: [{ parts }] };
  if (generationConfig) body.generationConfig = generationConfig;

  let resp;
  try {
    resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": IA.clave
        },
        body: JSON.stringify(body)
      }
    );
  } catch {
    throw new Error("Sin conexión a internet. Intenta de nuevo.");
  }

  if (!resp.ok) {
    if (resp.status === 400 || resp.status === 403) {
      throw new Error("La clave de API no es válida. Revísala en Ajustes.");
    }
    if (resp.status === 429) {
      throw new Error("Se alcanzó el límite de uso de la API. Espera un momento e intenta de nuevo.");
    }
    throw new Error(`Error del servicio de IA (${resp.status}). Intenta de nuevo.`);
  }

  const data = await resp.json();
  const partes = data.candidates?.[0]?.content?.parts;
  if (!partes || !partes.length) {
    throw new Error("La IA no devolvió resultado. Intenta de nuevo.");
  }
  return partes;
}

function pngBase64DelLienzo() {
  // toDataURL → "data:image/png;base64,XXXX"; la API quiere solo el base64
  return window.notasAPI.exportarPNG().split(",")[1];
}

// ---------- Ajustes ----------
const modalAjustes = document.getElementById("modal-ajustes");
const ajClave = document.getElementById("aj-clave");
const ajEstado = document.getElementById("aj-estado");

document.getElementById("btn-ajustes").addEventListener("click", () => {
  ajClave.value = IA.clave;
  ajEstado.textContent = IA.clave ? "Hay una clave guardada en este dispositivo." : "";
  ajEstado.className = "ajustes-estado";
  modalAjustes.classList.remove("hidden");
});

document.getElementById("aj-guardar").addEventListener("click", () => {
  IA.clave = ajClave.value.trim();
  modalAjustes.classList.add("hidden");
});

document.getElementById("aj-probar").addEventListener("click", async ev => {
  const btn = ev.currentTarget;
  const claveAnterior = IA.clave;
  IA.clave = ajClave.value.trim();
  if (!IA.clave) {
    IA.clave = claveAnterior;
    ajEstado.textContent = "Primero pega una clave.";
    ajEstado.className = "ajustes-estado error";
    return;
  }
  btn.disabled = true;
  ajEstado.textContent = "Probando conexión…";
  ajEstado.className = "ajustes-estado spinner";
  try {
    await llamarGemini(IA.MODELO_TEXTO, [{ text: "Responde únicamente: OK" }]);
    ajEstado.textContent = "✓ Conexión correcta. La clave funciona.";
    ajEstado.className = "ajustes-estado ok";
  } catch (e) {
    IA.clave = claveAnterior;
    ajEstado.textContent = e.message === "SIN_CLAVE" ? "Primero pega una clave." : e.message;
    ajEstado.className = "ajustes-estado error";
  } finally {
    btn.disabled = false;
  }
});

// Cerrar modales de IA al tocar el fondo
[modalAjustes,
 document.getElementById("modal-ia-texto"),
 document.getElementById("modal-ia-imagen")
].forEach(m => m.addEventListener("click", ev => {
  if (ev.target === m) m.classList.add("hidden");
}));

function exigirClave() {
  if (IA.clave) return true;
  modalAjustes.classList.remove("hidden");
  ajEstado.textContent = "Para usar la IA necesitas pegar tu clave de API aquí.";
  ajEstado.className = "ajustes-estado error";
  return false;
}

// ---------- Escritura a mano → texto ----------
const modalTexto = document.getElementById("modal-ia-texto");
const txtEstado = document.getElementById("ia-texto-estado");
const txtResultado = document.getElementById("ia-texto-resultado");
const btnCopiar = document.getElementById("ia-texto-copiar");
const btnTareas = document.getElementById("ia-texto-tareas");

document.getElementById("ed-ia-texto").addEventListener("click", async ev => {
  if (!exigirClave()) return;
  if (!window.notasAPI.hayTrazos()) {
    txtEstado.textContent = "La nota está vacía: escribe algo primero.";
    txtEstado.className = "ajustes-estado error";
    txtResultado.classList.add("hidden");
    btnCopiar.classList.add("hidden");
    btnTareas.classList.add("hidden");
    modalTexto.classList.remove("hidden");
    return;
  }

  const btn = ev.currentTarget;
  btn.disabled = true;
  txtResultado.classList.add("hidden");
  btnCopiar.classList.add("hidden");
  btnTareas.classList.add("hidden");
  txtEstado.textContent = "Leyendo tu escritura…";
  txtEstado.className = "ajustes-estado spinner";
  modalTexto.classList.remove("hidden");

  try {
    const partes = await llamarGemini(IA.MODELO_TEXTO, [
      { inline_data: { mime_type: "image/png", data: pngBase64DelLienzo() } },
      { text: "Transcribe el texto manuscrito de esta imagen. Devuelve únicamente el texto transcrito, respetando los saltos de línea. Si no hay texto legible, responde exactamente: (sin texto legible)" }
    ]);
    const texto = partes.map(p => p.text || "").join("").trim();
    txtEstado.textContent = "";
    txtEstado.className = "ajustes-estado";
    txtResultado.value = texto;
    txtResultado.classList.remove("hidden");
    btnCopiar.classList.remove("hidden");
    btnTareas.classList.remove("hidden");
  } catch (e) {
    txtEstado.textContent = e.message === "SIN_CLAVE" ? "Configura tu clave en Ajustes." : e.message;
    txtEstado.className = "ajustes-estado error";
  } finally {
    btn.disabled = false;
  }
});

document.getElementById("ia-texto-cerrar").addEventListener("click", () =>
  modalTexto.classList.add("hidden"));

btnCopiar.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(txtResultado.value);
    btnCopiar.textContent = "✓ Copiado";
    setTimeout(() => (btnCopiar.textContent = "Copiar"), 1600);
  } catch {
    txtResultado.select();
    document.execCommand("copy");
  }
});

// Crea una tarea por cada línea no vacía del texto reconocido
btnTareas.addEventListener("click", () => {
  const lineas = txtResultado.value.split("\n").map(l => l.trim()).filter(Boolean);
  if (!lineas.length) return;
  if (window.crearTareasDesdeTexto) {
    window.crearTareasDesdeTexto(lineas);
    modalTexto.classList.add("hidden");
  }
});

// ---------- Boceto → imagen ----------
const modalImagen = document.getElementById("modal-ia-imagen");
const imgEstado = document.getElementById("ia-img-estado");
const imgResultado = document.getElementById("ia-img-resultado");
const imgDescargar = document.getElementById("ia-img-descargar");
const imgInsertar = document.getElementById("ia-img-insertar");
const imgGenerar = document.getElementById("ia-img-generar");

document.getElementById("ed-ia-imagen").addEventListener("click", () => {
  if (!exigirClave()) return;
  imgEstado.textContent = window.notasAPI.hayTrazos()
    ? "" : "La nota está vacía: dibuja un boceto primero.";
  imgEstado.className = "ajustes-estado" + (window.notasAPI.hayTrazos() ? "" : " error");
  imgResultado.classList.add("hidden");
  imgDescargar.classList.add("hidden");
  imgInsertar.classList.add("hidden");
  modalImagen.classList.remove("hidden");
});

imgGenerar.addEventListener("click", async () => {
  if (!exigirClave() || !window.notasAPI.hayTrazos()) return;

  const estilo = document.getElementById("ia-img-prompt").value.trim();
  imgGenerar.disabled = true;
  imgResultado.classList.add("hidden");
  imgDescargar.classList.add("hidden");
  imgInsertar.classList.add("hidden");
  imgEstado.textContent = "Generando imagen… esto puede tardar unos segundos";
  imgEstado.className = "ajustes-estado spinner";

  try {
    const partes = await llamarGemini(
      IA.MODELO_IMAGEN,
      [
        { inline_data: { mime_type: "image/png", data: pngBase64DelLienzo() } },
        { text: "Convierte este boceto a mano en una imagen terminada de alta calidad, conservando la composición y los elementos del dibujo original." + (estilo ? ` Estilo deseado: ${estilo}.` : "") }
      ],
      { responseModalities: ["TEXT", "IMAGE"] }
    );
    const parteImg = partes.find(p => p.inlineData?.data || p.inline_data?.data);
    if (!parteImg) throw new Error("La IA no devolvió una imagen. Intenta describir mejor el estilo.");
    const inline = parteImg.inlineData || parteImg.inline_data;
    const dataUrl = `data:${inline.mimeType || inline.mime_type || "image/png"};base64,${inline.data}`;

    imgResultado.src = dataUrl;
    imgResultado.classList.remove("hidden");
    imgDescargar.href = dataUrl;
    imgDescargar.classList.remove("hidden");
    imgInsertar.classList.remove("hidden");
    imgEstado.textContent = "";
    imgEstado.className = "ajustes-estado";
  } catch (e) {
    imgEstado.textContent = e.message === "SIN_CLAVE" ? "Configura tu clave en Ajustes." : e.message;
    imgEstado.className = "ajustes-estado error";
  } finally {
    imgGenerar.disabled = false;
  }
});

document.getElementById("ia-img-cerrar").addEventListener("click", () =>
  modalImagen.classList.add("hidden"));

imgInsertar.addEventListener("click", () => {
  window.notasAPI.insertarImagen(imgResultado.src);
  modalImagen.classList.add("hidden");
});
