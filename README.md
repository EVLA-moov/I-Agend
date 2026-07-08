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
  la app avisa con una notificación y un aviso en pantalla (con la app abierta).
- **Notas**: lienzo de dibujo con soporte de Apple Pencil — presión,
  puntos de alta frecuencia (coalesced events), pluma, resaltador, borrador,
  deshacer/rehacer y modo "Solo Pencil" (rechazo de palma). Las notas se
  guardan como trazos vectoriales en IndexedDB con miniatura automática.
- **Offline**: el service worker deja la app disponible sin conexión.

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
sw.js                 Service worker (modo offline)
manifest.webmanifest  Manifiesto PWA
icons/                Íconos (SVG + PNG para iOS)
serve.ps1             Servidor local de pruebas (PowerShell)
```

## Datos

Todo se guarda **en el dispositivo**: tareas y eventos en `localStorage`,
notas en `IndexedDB`. No hay servidor ni cuenta.

## Próximos pasos posibles

- IA: convertir escritura a mano en texto y generar imágenes desde bocetos
  (requiere clave de API de un proveedor como Anthropic/OpenAI/Gemini).
- Notificaciones push reales (requiere servidor; iOS 16.4+).
- Repetición de tareas y hábitos.
