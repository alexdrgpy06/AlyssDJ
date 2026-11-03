---
change: 2026-11-03-arquitectura-documentada
type: retro
domains: [ui, audio, library, automix, platform]
paths: [docs/arquitectura/**, scripts/test-arquitectura.js, .specs/domains/**]
commits: []
status: approved
rev: 1
approved_rev: 1
approved_hash: 9028358a7a33053ddd61d6bdc267deea9f54fd449663a88c79f00e1f0d2db847
approved_by: Alejandro Ramirez
approved_at: 2026-11-03
---
# Requirements · 2026-11-03-arquitectura-documentada

## Contexto

Alejandro pide analizar componentes, vistas y funciones, **esquematizarlos** y dejar documentado qué debe hacer cada función, dónde debe vivir y de qué depende, con comprobaciones visuales, QA y lógica. El análisis de hoy (`analisis.md`, en esta carpeta) muestra: 33 módulos de interfaz (~8 000 líneas) con `app.js` (1 184 líneas) como módulo-dios; 9 dominios SDD que no cubren FX, stems, sampler/MIDI, jog, géneros, exportación, actualizador ni ajustes; `paths:` obsoletos (el dominio `video` apunta a archivos que ya no existen); persistencia repartida en cuatro prefijos de `localStorage`; ~14 módulos sin prueba de lógica; capturas sin comparación contra una referencia y ocho PNG huérfanos.

## Requisitos

### REQ-1: Mapa de arquitectura por capas
THE SYSTEM SHALL documentar en `docs/arquitectura/` un mapa por capas (proceso principal, preload, compartido, interfaz) con, por módulo, su responsabilidad, sus exportaciones públicas, sus dependencias y quién lo usa, y los diagramas Mermaid de dependencias entre capas.

### REQ-2: Contrato de cada función pública
THE SYSTEM SHALL describir, para cada módulo y función pública relevante, qué debe hacer, entradas y salidas, efectos secundarios, errores y dónde debe vivir (y qué hoy está en el sitio equivocado).

### REQ-3: Vistas y componentes
THE SYSTEM SHALL documentar cada vista (Mezcla, Librería, Automix, Ondas) y cada componente de la interfaz (deck, mezclador, librería, panel de AutoMix, ajustes, diálogos) con su estructura, los IDs que posee, su estado y los eventos que emite o recibe.

### REQ-4: Flujos de datos e IPC
THE SYSTEM SHALL documentar el camino del audio de cada deck, los canales IPC (canal → manejador → llamador) y las rutas del protocolo `app://`, y las claves de persistencia (`localStorage` y `userData`) con su dueño.

### REQ-5: Matriz de QA por componente
THE SYSTEM SHALL mantener una matriz que asigne a cada componente su comprobación de **lógica** (prueba unitaria), **visual** (captura con referencia) y **QA** (autoprueba de arranque o manual), marcando los huecos actuales.

### REQ-6: Comprobación visual con referencia
WHEN se ejecuta la comprobación visual THE SYSTEM SHALL generar las capturas clave en silencio (sin ventana visible) y compararlas con una referencia aprobada, fallando si la diferencia supera un umbral, y SHALL permitir aprobar una referencia nueva de forma explícita.

### REQ-7: Dominios SDD completos
THE SYSTEM SHALL cubrir con dominios SDD (`fx`, `stems`, `sampler-midi`, `jog`, `genres`, `export`, `updater`, `settings`) lo que hoy no tiene dominio, corregir los `paths:` obsoletos y retirar el dominio `video` si ya no aplica, de modo que `sdd drift` no liste archivos sin cubrir.

### REQ-8: La documentación no se queda atrás
THE SYSTEM SHALL tener una prueba (`test-arquitectura.js`) que falle si un módulo de `main/`, `shared/`, `preload/` o `renderer/` no aparece en el mapa, si el mapa cita un archivo que no existe, o si un canal IPC registrado no está documentado.

### REQ-9: Deuda priorizada
THE SYSTEM SHALL listar, con prioridad y esfuerzo, las desviaciones entre lo que cada módulo debe hacer y lo que hace (por ejemplo, trocear `app.js`, unificar la persistencia, unificar la compacidad de layout), sin ejecutarlas en este cambio.

## Fuera de alcance

- Refactorizar el código: cada desviación se resuelve en su propio cambio.
- Cambiar el comportamiento de la aplicación.
