# Skill: Gestión de Cobros y Renovaciones

Procedimiento para registrar pagos de cuotas y adelantos en ONE+ Gym:

### 1. Invocación
* Desde el Dashboard: Clic en cualquier socio dentro de la lista de cuotas vencidas (`cobrarCuotaDesdeVencidos(socioId)`).
* Desde Inscriptos y Cuotas: Menú de tres puntitos del socio -> Opción "Cobrar / Renovar cuota" (`openCobroModal(socioId)`).

### 2. Opciones a Configurar en el Modal
* **Modalidad del Plan:**
  * Mantener plan actual (conserva precio y modalidad).
  * Cambiar de plan (permite elegir cualquiera de los 5 planes oficiales de ONE+).
* **Cantidad de meses:** 1, 2 o hasta 3 meses por adelantado.
* **Cálculo dinámico:**
  * Total a cobrar = tarifa mensual $\times$ meses elegidos.
  * Nueva fecha de vencimiento proyectada en `DD/MM/YYYY`.

### 3. Registro en Backend
* Endpoint: `POST /api/admin/socios/cobrar`
* Acciones del servidor:
  * Actualiza el plan, cuota, vencimiento y establece `estado = "Al día"`.
  * Restablece el saldo de clases semanales para el nuevo ciclo.
  * Asienta el movimiento de `Ingreso` en el historial contable de Finanzas.
  * Guarda automáticamente en `gym_data.json`.
