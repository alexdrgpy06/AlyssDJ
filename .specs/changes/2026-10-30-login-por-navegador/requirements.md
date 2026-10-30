---
change: 2026-10-30-login-por-navegador
type: fix
domains: [auth]
paths: [main/main.js, main/auth-import.js, preload/app.js, renderer/app.js, renderer/index.html, renderer/styles.css, docs/**]
commits: []
status: approved
rev: 1
approved_rev: 1
approved_hash: 1b71d265bda018cdbdb1252534b785eadf8398b09f0634140dbdb3de1efdba0a
approved_by: Alejandro Ramirez
approved_at: 2026-10-30
---
# Requirements · login-por-navegador

## Contexto
Al pulsar "Iniciar sesión", Google responde "No puedes acceder: es posible que no sean seguros este navegador o la app" porque bloquea el inicio de sesión dentro de ventanas embebidas de Electron. Sin sesión, YouTube Music mete anuncios y no hay playlists, Me gusta ni importación. Se necesita una vía que no dependa de iniciar sesión dentro de la app.

## Requisitos

### REQ-1: Diálogo de inicio de sesión
WHEN el usuario pulsa "Iniciar sesión" THE SYSTEM SHALL mostrar un diálogo que explique el bloqueo de Google y ofrezca (a) importar la sesión desde un navegador instalado, como opción recomendada, y (b) intentar el inicio de sesión directo.

### REQ-2: Importar desde el navegador
WHEN el usuario elige un navegador y pulsa Importar THE SYSTEM SHALL extraer sus cookies con yt-dlp a un archivo temporal, copiar a la sesión de AlyssDJ únicamente las cookies de dominios youtube.com y google.com, eliminar el archivo temporal y recargar los decks y la biblioteca.

### REQ-3: Solo los datos necesarios
WHEN se importan cookies THE SYSTEM SHALL descartar las de cualquier otro dominio y no escribir sus valores en logs ni en disco, salvo el archivo temporal de permisos 0600 que se elimina al terminar, aunque la importación falle.

### REQ-4: Errores comprensibles
IF yt-dlp no está disponible, el navegador no tiene perfil, no hay cookies de YouTube o la extracción falla THEN THE SYSTEM SHALL mostrar la causa y qué hacer, sin modificar la sesión actual.

### REQ-5: Navegadores detectados
WHEN se abre el diálogo THE SYSTEM SHALL listar los navegadores con perfil encontrado en el equipo (Firefox, Chrome, Chromium, Brave, Edge, Vivaldi u Opera) y, si no hay ninguno, permitir elegir uno a mano.

### REQ-6: Login directo con otra huella
WHEN el usuario elige el inicio de sesión directo THE SYSTEM SHALL abrir la ventana de Google con una huella de Firefox, y si Google la bloquea THE SYSTEM SHALL dejar visible la opción de importar desde el navegador.

### REQ-7: Estado de sesión
WHEN termina una importación o un inicio de sesión THE SYSTEM SHALL actualizar el indicador de sesión según la presencia de la cookie de sesión de YouTube, y avisar de si hay Premium en uso (sin anuncios) cuando se pueda saber.

## Fuera de alcance
- Guardar o pedir contraseñas.
- Leer o conservar cookies de sitios distintos de youtube.com y google.com.
- Sincronizar la sesión de vuelta al navegador.
