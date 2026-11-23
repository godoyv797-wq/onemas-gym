# Skill: Gestión y Alta de Socios

Procedimiento para registrar o modificar alumnos en ONE+ Gym:

### 1. Validaciones Requeridas en el Formulario
* **Nombre y Apellido:** Mínimo 3 caracteres, sin espacios en blanco vacíos.
* **DNI:** Solo números, entre 6 y 10 dígitos (sin puntos en el input; se formatean automáticamente con puntos al guardar).
* **Teléfono:** Mínimo 7 dígitos numéricos, compatible con enlaces directos de WhatsApp (`wa.me/...`).
* **Importe de cuota:** Solo números mayores a \$1.000.
* **Fecha de vencimiento:** Obligatoria en formato `DD/MM/YYYY`.

### 2. Flujo de Datos
1. El usuario completa el modal `#socio-modal` y hace submit.
2. `handleSaveSocio(event)` valida los datos y convierte la fecha a `DD/MM/YYYY`.
3. Se envía `POST /api/admin/socios` con el payload JSON.
4. El backend asigna un ID secuencial si es nuevo socio, calcula el estado según fecha y guarda en `gym_data.json`.
5. Se muestra notificación `Toast.success(...)` y se llama a `adminRefreshAll()`.
