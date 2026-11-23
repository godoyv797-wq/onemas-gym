# Historial de Cambios y Decisiones de Diseño

Registro cronológico de requerimientos y características implementadas en ONE+ Gym:

---

### Versión 1.0.0
* **Página pública de ONE+ Gym:**
  * Nombre, ofertas de apertura, lista de precios detallada y horarios de atención (Lunes a viernes 8-12 y 15-23, sábados 9-12).
  * Tienda de suplementos (proteínas, yogur griego, colágeno, pre-entreno, creatina).
  * Ubicación geográfica (Palermo, Salta, Argentina) y botones directos de WhatsApp.
  * Diseño visual eco-design adaptado de *LaWebVerde* con selector de tema claro/oscuro.

* **Backend FastAPI y Libro de Visitas:**
  * Endpoints `GET /api/mensajes`, `POST /api/mensajes` y `DELETE /api/mensajes/{id}`.
  * Borrado protegido mediante clave `ADMIN_KEY` en `.env`.
  * Persistencia en `mensajes.json`.

---

### Versión 1.1.0
* **Seguridad y Título Heroico:**
  * Ocultamiento total de credenciales en pantalla y código cliente.
  * Botón para mostrar/ocultar contraseña en el login administrativo.
  * Integración del componente animado `<StrokeText />` con GSAP y tipografía Google Fonts **Archivo Black**.
* **Gráficas y Búsquedas:**
  * Gráficas Chart.js: Flujo de personas por horario/días y Balance de Ingresos vs. Egresos.
  * Buscadores y filtros de fecha en todas las herramientas del panel de administración.

---

### Versión 1.2.0
* **Check-in de Socios por DNI:**
  * Módulo en la barra lateral con buscador por DNI.
  * Descuento automático de clases semanales para planes con límite.
  * Visualización del estado de suscripción y clases restantes.
* **Componente Reutilizable Toast:**
  * Reemplazo de todos los `alert()` nativos por avisos no intrusivos en la esquina inferior derecha.
* **Skeletons de Carga:**
  * Animación de pulso gris mientras se cargan listas y mensajes.

---

### Versión 1.3.0
* **Modales con Scrollbar y Cierre:**
  * Modales para Inscribir/Editar socios, Agregar productos de stock y Registrar máquinas con barra de desplazamiento estilizada y botón 'X'.
  * Menú de tres puntitos en tablas con modal de advertencia de borrado en rojo.

---

### Versión 1.4.0
* **Formato de Fechas Unificado:**
  * Migración estricta de todas las fechas a `DD/MM/YYYY` (y `DD/MM/YYYY HH:MM`).
* **Flujo Horario Dinámico:**
  * Cada confirmación de check-in almacena día y hora y actualiza la curva de afluencia de gente en el Dashboard.

---

### Versión 1.5.0
* **Regla Automática de Cuotas Vencidas a las 12hs:**
  * El día posterior al vencimiento ($D+1$) al instante que sean las 12:00 hs, el socio pasa automáticamente a `Vencido` tanto en frontend como en backend.
* **Módulo de Cobro Avanzado:**
  * Modal `#modal-cobro-cuota` con opción de mantener plan o cambiarlo.
  * Pago de hasta **3 meses por adelantado** con cálculo en tiempo real.
* **Marcador Visual de Filtros:**
  * Botones de estado con clase `.filter-btn-active` y banner informativo `#socios-active-filter-indicator`.

---

### Versión 1.6.0
* **Migración a Base de Datos Supabase (PostgreSQL en la Nube):**
  * Creación de `supabase_schema.sql` con definición de tablas relacionales (`socios`, `stock`, `maquinas`, `finanzas_movimientos`, `checkins_log`, `flujo_asistencia`, `mensajes`), índices y políticas de seguridad RLS.
  * Módulo `database.py` con arquitectura híbrida: lee y escribe en Supabase PostgREST cuando está configurado, con fallback automático transparente a archivos JSON locales.
  * Script de migración `migrate_to_supabase.py` para sembrar todos los datos existentes en la nube con un solo comando.
  * Plantilla `.env.example` con variables de entorno para Supabase.
