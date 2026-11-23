# Convenciones de Código — ONE+ Gym

### 1. Formato de Fechas
* Todas las fechas visibles en tablas, tooltips, modales y WhatsApp deben formatearse como:
  * `DD/MM/YYYY` (ej: `15/11/2026`)
  * `DD/MM/YYYY HH:MM` (ej: `03/11/2026 19:30` para asistencias y mensajes)
* Para sincronizar con `<input type="date">` (que internamente requiere formato ISO `YYYY-MM-DD`), utilizar siempre las funciones auxiliares de `script.js`:
  * `toIsoDate(ddmmyyyy)` al poblar el formulario.
  * `toDdmmyyyy(isoDate)` al leer el valor y guardarlo en la base de datos.

### 2. Notificaciones Toast (Sin `alert()`)
* Los `alert()` nativos están prohibidos en el código.
* Se debe usar el componente `Toast`:
  ```javascript
  Toast.success("Título descriptivo", "Qué pasó y cómo proceder.");
  Toast.error("Título de error", "Detalle del error y qué hacer.");
  ```

### 3. Seguridad y Backend
* No almacenar credenciales de administrador en el código cliente.
* La clave de administración (`ADMIN_KEY`) se inyecta desde el archivo `.env` en el servidor FastAPI.
* El endpoint de login `POST /api/admin/login` valida credenciales y entrega el token de sesión.

### 4. Estilos y Modo Oscuro
* El proyecto sigue la estética eco-design de *LaWebVerde*.
* Utilizar siempre variables CSS de color (`var(--accent-green)`, `var(--bg-primary)`, `var(--text-primary)`, etc.).
* Asegurar que todo nuevo componente soporte `[data-theme="dark"]` y `[data-theme="light"]`.
