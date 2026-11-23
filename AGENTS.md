# AGENTS.md — Directivas y Reglas para Agentes de IA

> Este archivo contiene las directivas obligatorias que todo agente de Inteligencia Artificial debe leer, respetar y aplicar al trabajar en el código de **ONE+ Gym**.

---

## 1. Arquitectura del Proyecto

* **Backend:** **Python con FastAPI** en [`main.py`](main.py). Corre en el puerto `8000` con servidor Uvicorn.
* **Frontend:** **Vanilla JavaScript (ES6+)** en [`script.js`](script.js), **HTML5** en [`index.html`](index.html) y **CSS3** en [`styles.css`](styles.css).
  * **NO** agregar frameworks adicionales (como React, Angular o Vue) a menos que el usuario lo solicite explícitamente.
* **Persistencia:** Archivos planos JSON ([`gym_data.json`](gym_data.json) y [`mensajes.json`](mensajes.json)) codificados en UTF-8.

---

## 2. Reglas de Negocio Inmutables

### A. Regla de Vencimiento de Cuotas
* **Enunciado:** *"Cada vez que el día de vencimiento pase tiene que establecerlo como cuota vencida al instante que sean las 12 del día siguiente al que vence."*
* **Lógica:** Si el socio vence el día $D$, tiene acceso válido durante todo el día $D$. A partir de las **12:00 hs del día siguiente ($D+1$)**, su estado pasa automáticamente e inexorablemente a **`Vencido`**.
* **Implementación:** Tanto en backend (`calcular_estado_socio()`) como en frontend (`calcularEstadoCuotaSocio()`), esta regla se evalúa automáticamente al consultar datos o renderizar vistas.

### B. Cobro de Cuotas y Pago por Adelantado
* **Modal de Cobro:** Nunca realizar cobros automáticos ciegos. Siempre abrir el modal interactivo `#modal-cobro-cuota`.
* **Planes permitidos:**
  * *Pase Libre (Todos los días)*: \$28.000 (Clases ilimitadas)
  * *3 veces a la semana*: \$22.000 (3 clases semanales)
  * *Promo Amigos*: \$23.000 c/u (Clases ilimitadas)
  * *Personalizados*: \$43.000 (12 clases al mes con instructor)
  * *Clase individual*: \$8.000
* **Meses por adelantado:** **Máximo 3 meses**. Solo se permiten 1, 2 o 3 meses. El backend valida `1 <= meses <= 3`.
* **Cálculo de nueva fecha:** Si la cuota ya estaba vencida, el nuevo período inicia desde hoy. Si estaba al día, los meses se suman a su fecha de vencimiento actual.

### C. Check-in y Flujo Horario en Tiempo Real
* Con cada check-in exitoso vía DNI:
  * Se descuenta 1 clase si el socio tiene plan limitado (*3 veces a la semana* o *Personalizados*).
  * Se registra día (`lunes` a `sabado`) y bucket horario (`08:00` a `23:00`).
  * Se incrementa el contador de `flujo_asistencia` en el día y se actualiza el `promedio`.
  * La gráfica de Chart.js se actualiza dinámicamente en pantalla sin recargar.

---

## 3. Convenciones de Código y Formato

### A. Formato de Fechas: Estricto `DD/MM/YYYY`
* **Regla:** Todas las fechas mostradas en tablas, modales, tarjetas, badges, mensajes y WhatsApp **deben formatearse en `DD/MM/YYYY`** (o `DD/MM/YYYY HH:MM` para marcas de tiempo).
* En formularios con `<input type="date">`, convertir bidireccionalmente usando los helpers `toIsoDate()` para llenar el input y `toDdmmyyyy()` al leer y persistir.

### B. Sistema de Notificaciones (Prohibido `alert()`)
* **Nunca** utilizar `alert()` nativo del navegador.
* Usar siempre el componente reutilizable **`Toast`**:
  * `Toast.success(titulo, mensaje)` (verde)
  * `Toast.error(titulo, mensaje)` (rojo)
  * `Toast.warning(titulo, mensaje)` (amarillo)
  * `Toast.info(titulo, mensaje)` (azul)

### C. Seguridad y Credenciales
* Las contraseñas y claves de administrador (`ADMIN_KEY`) viven en el archivo `.env` y **solo se validan en el backend**.
* Nunca incrustar credenciales en texto plano en el frontend o mensajes visibles de error.

### D. Identidad Visual (Eco-Design LaWebVerde)
* Fuente de títulos: Google Fonts `'Archivo Black'`.
* Fuente de lectura: Google Fonts `'Roboto Slab'`.
* Colores primarios: Verde esmeralda `#10b981` (modo claro) / Verde neón `#00fc9f` (modo oscuro).
* Respetar siempre el soporte completo para modo claro y modo oscuro (`data-theme="dark"` / `"light"`).

---

## 4. Estructura de Directorios para Agentes
* `.agents/rules/`: Reglas desglosadas por dominio (negocio, estilo, seguridad).
* `.agents/skills/`: Procedimientos paso a paso para tareas recurrentes.
* `docs/`: Documentación técnica extendida y registro de cambios históricos.
