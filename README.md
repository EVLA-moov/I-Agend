# IRIS — Agenda y Notas para iPad

PWA (aplicación web instalable) con agenda, tareas, recordatorios y notas de
escritura a mano con Apple Pencil. Sin dependencias ni paso de compilación:
HTML, CSS y JavaScript puros.

## Funciones (v1)

- **Hoy**: resumen del día con tareas pendientes (incluye vencidas) y eventos.
- **Calendario**: vista mensual con indicadores por día; toca un día para ver
  o agregar sus tareas y eventos.
- **Tareas**: captura rápida con Enter, filtros (pendientes / hoy / próximas /
  completadas), prioridades con color y fechas de vencimiento.
- **Recordatorios**: al crear una tarea o evento con hora y "Recordarme",
  la app avisa con una notificación del sistema (vía service worker, compatible
  con la app instalada en iOS) y un aviso en pantalla. El ícono de la app
  muestra un globito con el número de tareas vencidas o de hoy (iOS 16.4+).
  Nota: iOS no permite notificaciones programadas con la app totalmente
  cerrada sin un servidor de push; los avisos llegan con la app abierta o
  al volver a ella.
- **Notas**: lienzo de dibujo con soporte de Apple Pencil — presión,
  puntos de alta frecuencia (coalesced events), deshacer/rehacer y modo
  "Solo Pencil" (rechazo de palma). Once estilos de trazo: pluma, bolígrafo,
  lápiz, pincel, caligrafía, crayola, aerosol, neón, línea punteada,
  subrayador y borrador (los estilos con textura usan ruido con semilla
  para redibujarse idénticos). Las notas se guardan como trazos vectoriales
  en IndexedDB con miniatura automática.
- **Listas de pendientes**: además de las tareas sueltas, puedes crear listas
  con nombre (Compras, Escuela…) desde la vista Tareas; cada tarea puede
  pertenecer a una lista y conservar fecha, prioridad y recordatorio.
- **Offline**: el service worker deja la app disponible sin conexión.
- **IA (v2, modelo BYOK)**: en Ajustes (⚙️) cada usuario pega su propia clave de
  la API de Google Gemini (gratuita, de [aistudio.google.com/apikey](https://aistudio.google.com/apikey)).
  La clave se guarda solo en el dispositivo — nunca en el código ni en el repositorio.
  Con ella, el editor de notas ofrece:
  - **✨ Texto**: convierte la escritura a mano en texto digital; puedes copiarlo
    o crear una tarea por cada línea reconocida.
  - **🎨 Imagen**: convierte el boceto en una imagen terminada (estilo Noema
    Playground), con opción de describir el estilo, descargarla o insertarla
    en la nota.

## Probar en la PC

```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Abre <http://localhost:8321>.

## Instalar en el iPad

La forma recomendada es publicarla en un hosting con HTTPS gratuito
(requisito de iOS para service worker y pantalla completa):

1. Crea un repositorio en GitHub y sube estos archivos.
2. En el repositorio: **Settings → Pages → Deploy from a branch → main**.
3. En el iPad, abre la URL `https://<tu-usuario>.github.io/<repo>/` en Safari.
4. Toca **Compartir → Agregar a pantalla de inicio**. IRIS quedará instalada
   como app a pantalla completa con su propio ícono.

## Estructura

```
index.html            Estructura de la app (vistas, editor, modal)
css/styles.css        Estilos, tema claro/oscuro automático
js/app.js             Tareas, eventos, calendario, recordatorios
js/notes.js           Notas de escritura a mano (canvas + IndexedDB)
js/ai.js              Funciones de IA (Gemini, clave BYOK en el dispositivo)
sw.js                 Service worker (modo offline)
manifest.webmanifest  Manifiesto PWA
icons/                Íconos (SVG + PNG para iOS)
serve.ps1             Servidor local de pruebas (PowerShell)
```

## Datos

Todo se guarda **en el dispositivo**: tareas y eventos en `localStorage`,
notas en `IndexedDB`. No hay servidor ni cuenta.

## Próximos pasos posibles

- Notificaciones push reales (requiere servidor; iOS 16.4+).
- Repetición de tareas y hábitos.
- Resumir notas y crear tareas con lenguaje natural usando IA.
