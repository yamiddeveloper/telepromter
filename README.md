# Teleprompter

Teleprompter web sin dependencias. Abre `index.html` con un servidor local:

```bash
python3 -m http.server 5173
```

y entra en http://localhost:5173.

- Guiones guardados automáticamente en el navegador (biblioteca, importar/descargar `.txt`).
- Desplazamiento suave con velocidad, tamaño, interlineado, ancho y línea de lectura ajustables en vivo.
- **Modo voz** (`V`): sigue lo que lees con el reconocimiento de voz del navegador (Chrome/Edge).
- Espejo horizontal/vertical, pantalla completa, cuenta regresiva, compatible con mandos de presentación (RePág/AvPág).
- Sintaxis: `# Título`, `**énfasis**`, `[nota que no se lee]`.

Pulsa `?` dentro del teleprompter para ver todos los atajos.
