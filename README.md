# ONE+ Gym — Sistema de Gestión y Web Oficial

Plataforma web integral para el gimnasio **ONE+** (Salta, Argentina). Combina una página web pública moderna con un Panel de Control de Administración para la gestión de socios, asistencias, cobro de cuotas, control de equipamiento, stock de tienda y libro de visitas.

---

## 🚀 Inicio Rápido

### 1. Requisitos Previos
* **Python 3.10+** instalado en el sistema.

### 2. Instalación de Dependencias
Abrí una terminal en la carpeta del proyecto y ejecutá:
```bash
pip install -r requirements.txt
```

### 3. Iniciar el Servidor
```bash
python main.py
```
O con Uvicorn directamente:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Accesos Web
* **Página Web Principal:** [http://localhost:8000](http://localhost:8000)
* **Documentación Interactiva Swagger API:** [http://localhost:8000/docs](http://localhost:8000/docs)
* **Documentación Alternativa ReDoc:** [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## 🔐 Credenciales del Panel de Administración

Para ingresar a la zona privada de administradores:
* **Usuario:** `administrador`
* **Contraseña:** `onemasadmin` (configurada en el archivo `.env`)

> [!NOTE]
> La contraseña cuenta con botón para alternar visibilidad (mostrar/ocultar) y las credenciales se validan exclusivamente en el backend (`/api/admin/login`).

---

## 🏋️‍♂️ Características Principales

### Página Web Pública
* **Diseño Visual Eco-Design:** Inspirado en *LaWebVerde*, con paleta esmeralda (`#10b981` / `#00fc9f`), alto contraste y modo claro/oscuro.
* **Encabezado Animado `<StrokeText />`:** Tipografía Google Fonts **Archivo Black** con trazo vectorial dinámico implementado con GSAP.
* **Secciones:** Servicios (Musculación, Cardio, Personalizados), Planes y Precios, Tienda de Suplementos (proteínas, yogur griego artesanal, colágeno, creatina), Ubicación (Salta, Palermo) y Horarios de atención.
* **Libro de Visitas:** Muro de reseñas en vivo con backend propio y moderación.

### Panel de Control de Administradores
* **Dashboard con Métricas:** KPIs de socios activos, cuotas al día, cuotas vencidas e ingresos mensuales.
* **Gráfica de Flujo Horario:** Muestra la afluencia de gente por hora y días, actualizada en tiempo real con cada check-in.
* **Módulo de Check-in por DNI:** Búsqueda rápida por número de documento, validación de estado de cuota y descuento automático de clases semanales para planes limitados.
* **Gente Inscripta y Cuotas:**
  * Tabla con búsqueda por texto y fecha de vencimiento (`DD/MM/YYYY`).
  * Botones de filtrado de estado con **marcador visual activo** y banner informativo.
  * Menú de tres puntitos: ver ficha completa, editar datos, cobrar cuota y borrado con modal de confirmación en rojo.
* **Cobro de Cuota y Renovación Avanzada:**
  * Opción para mantener el plan actual o cambiar a cualquiera de los planes de ONE+.
  * Permite abonar **1, 2 o hasta 3 meses por adelantado** (con límite de seguridad).
  * Cálculo dinámico del total y proyección automática del nuevo vencimiento.
* **Regla Automática de Cuotas Vencidas:**
  * Al pasar el día de vencimiento, la cuota pasa automáticamente a estado **`Vencido`** al instante que sean las **12:00 hs del día siguiente**.
* **Control de Stock y Tienda:** Monitoreo de existencias con alertas de stock mínimo, modal para agregar artículos y ajuste de unidades.
* **Estado de Máquinas:** Supervisión de equipamiento (Operativa, En mantenimiento, Fuera de servicio) y registro de última revisión técnica.
* **Sistema de Toasts:** Notificaciones emergentes elegantes en la esquina inferior derecha (verde para éxito, rojo para error), eliminando `alert()` nativos.

---

## 📂 Estructura del Proyecto

```plaintext
proyecto)/
├── README.md               # Documentación para personas (este archivo)
├── AGENTS.md               # Reglas y directivas para agentes de IA
├── .gitignore              # Archivos y carpetas excluidos de control de versiones
├── .env                    # Variables de entorno y claves de seguridad
├── requirements.txt        # Dependencias de Python
├── main.py                 # Backend con FastAPI y servidor ASGI
├── index.html              # Frontend HTML5 (Web pública y Dashboard admin)
├── styles.css              # Estilos CSS3 (Modo claro/oscuro, componentes y modales)
├── script.js               # Lógica JavaScript (Estado global, gráficos, API y eventos)
├── gym_data.json           # Persistencia de socios, máquinas, stock, finanzas y flujo
├── mensajes.json           # Persistencia de mensajes del libro de visitas
├── .agents/                # Reglas temáticas y habilidades modulares para agentes
│   ├── rules/              # Reglas de negocio y convenciones
│   └── skills/             # Guías paso a paso de tareas frecuentes
└── docs/                   # Documentación detallada de arquitectura y cambios
```

---

## 🛠️ Tecnologías Utilizadas
* **Backend:** Python 3, FastAPI, Uvicorn, Pydantic.
* **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3 Custom Properties.
* **Librerías:** GSAP (animación de títulos), Chart.js (gráficas interactivas), FontAwesome 6 (iconografía).
* **Persistencia:** Base de datos basada en archivos planos JSON con integridad transaccional.
