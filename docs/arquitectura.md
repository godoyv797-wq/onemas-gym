# Arquitectura Técnica — ONE+ Gym

Este documento detalla las decisiones técnicas, patrones y estructura del sistema.

---

## 1. Patrón de Arquitectura
El proyecto utiliza una arquitectura desacoplada pero unificada en despliegue:
* **Backend:** API REST construida con FastAPI que sirve tanto los endpoints de datos JSON como los archivos estáticos de la interfaz (`index.html`, `styles.css`, `script.js`).
* **Frontend:** Single Page Application (SPA) en Vanilla JavaScript que consume la API REST local mediante `fetch()`.
* **Persistencia Dual (Cloud & Local):** 
  * **Supabase (PostgreSQL en la nube):** Conexión principal mediante API REST PostgREST para base de datos relacional escalable.
  * **Flat-File JSON (`gym_data.json` y `mensajes.json`):** Respaldo local y fallback automático transparente en caso de operar sin conexión a la nube.

---

## 2. Diagrama de Flujo

```
[ Navegador Web ]
       │
       ├── GET /  ──> index.html
       ├── GET /styles.css  ──> styles.css
       └── GET /script.js  ──> script.js
       │
       ├── POST /api/admin/socios/checkin  ──> [ FastAPI ] ──> [ Supabase / gym_data.json ]
       ├── POST /api/admin/socios/cobrar   ──> [ FastAPI ] ──> [ Supabase / gym_data.json ]
       └── GET /api/mensajes               ──> [ FastAPI ] ──> [ Supabase / mensajes.json ]
```

---

## 3. Manejo de Estado en Frontend
El archivo `script.js` utiliza un objeto global reactivo:
```javascript
const APP_STATE = {
  theme: "light" | "dark",
  adminToken: string | null,
  sociosData: Array,
  stockData: Array,
  maquinasData: Array,
  finanzasData: Object,
  mensajesData: Array,
  flujoAsistencia: Object,
  checkinsLog: Array,
  chartAttendance: Chart | null,
  chartFinances: Chart | null,
  currentSocioFilterEstado: string
};
```
Cada mutación de datos invoca a `adminRefreshAll()`, actualizando en cascada los KPIs, las tablas y las gráficas interactivas.

---

## 4. Estrategia de Migración Futura
Si el gimnasio escala y requiere sincronización multiusuario con molinetes de acceso físico:
1. Reemplazar la capa de lectura/escritura de `gym_data.json` en `main.py` por **SQLModel / SQLAlchemy** conectado a **SQLite** (local) o **Supabase** (PostgreSQL en la nube).
2. Los endpoints REST mantendrán exactamente el mismo contrato, por lo que el frontend no requerirá modificaciones.
