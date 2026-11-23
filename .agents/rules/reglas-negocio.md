# Reglas de Negocio — ONE+ Gym

### 1. Horarios de Atención Oficiales
* **Lunes a Viernes:** 08:00 a 12:00 y 15:00 a 23:00.
* **Sábados:** 09:00 a 12:00.
* **Domingos:** Cerrado.

### 2. Catálogo Oficial de Tarifas y Modalidades
* **Pase Libre (Todos los días):** \$28.000 / mes (Lunes a viernes 8-12 y 15-23, sábados 9-12). Clases ilimitadas.
* **3 veces a la semana:** \$22.000 / mes. 3 clases semanales en cualquier franja horaria.
* **Promo Amigos:** \$23.000 / mes cada uno (si pagan juntos). Clases ilimitadas.
* **Personalizados:** \$43.000 / mes. 12 clases mensuales con seguimiento de instructor dedicado.
* **Clase individual:** \$8.000 por clase.

### 3. Vencimiento de Cuotas a las 12 hs del Día Siguiente
* Si la fecha de vencimiento es $D$, el alumno puede ingresar y entrenar durante todo el día $D$.
* Al llegar las **12:00 hs del día siguiente ($D+1$)**, el estado pasa de forma automática a **`Vencido`**.
* Al estar vencido, se resalta en rojo en las tablas y se incluye en la lista de recordatorios por WhatsApp.

### 4. Pagos y Cobro por Adelantado
* Máximo permitido: **3 meses por adelantado**.
* Opciones disponibles en el modal de cobro: 1 mes, 2 meses o 3 meses.
* Todo cobro debe asentar un movimiento de tipo `Ingreso` en el módulo de Finanzas con la fecha en formato `DD/MM/YYYY`.

### 5. Check-in de Socios
* El socio ingresa su DNI numérico.
* Si el socio tiene cuota al día y clases disponibles, el check-in se aprueba y se descuenta 1 clase (si su plan es limitado).
* Con cada confirmación de asistencia, se actualiza el día y la hora en la gráfica de flujo horario del Dashboard.
