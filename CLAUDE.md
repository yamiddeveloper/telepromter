# Teleprompter

Teleprompter web estático en HTML, CSS y JavaScript sin dependencias ni paso de build. La interfaz y los comentarios están en español.

## Ejecutar

```bash
python3 -m http.server 5173 --bind 127.0.0.1
```

Abre http://localhost:5173. La misma configuración está en `.claude/launch.json`. No hay tests ni linter.

## Estructura

- `index.html`: marcado de la app. Carga Google Fonts y `app.js`.
- `styles.css`: estilos.
- `app.js`: toda la lógica, dentro de una IIFE en modo estricto. Secciones: Utilidades, Estado (ajustes y guiones), Editor, Controles de ajustes, Teleprompter, Modo voz e Inicio.

## Convenciones

- No agregar dependencias ni herramientas de build sin pedirlo.
- Los datos persisten en `localStorage` a través del helper `store`, que tolera almacenamiento no disponible.
- Mantener en español los textos de la interfaz y los comentarios.
- El modo voz usa el reconocimiento de voz del navegador (Chrome/Edge).
