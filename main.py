import os
import json
import uuid
import copy
import re
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Header, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from dotenv import load_dotenv

import database

# Base directory
BASE_DIR = Path(__file__).resolve().parent

# Load environment variables
load_dotenv(BASE_DIR / ".env")
ADMIN_KEY = os.getenv("ADMIN_KEY", "onemasadmin")
DATA_FILE = BASE_DIR / "mensajes.json"
GYM_DATA_FILE = BASE_DIR / "gym_data.json"

app = FastAPI(
    title="GYMM Gimnasio API & Web",
    description="Backend oficial de ONE+ Gym (Salta, Argentina) con API REST para Libro de Visitas y Gestión de Gimnasio",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Enable CORS for development flexibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic Models for Guestbook
class MensajeInput(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=100, description="Nombre del visitante o alumno")
    texto: str = Field(..., min_length=3, max_length=1000, description="Comentario o reseña")


class Mensaje(BaseModel):
    id: str
    nombre: str
    texto: str
    fecha: str


# Helper functions for Guestbook persistence
def leer_mensajes() -> List[dict]:
    if database.is_supabase_enabled():
        supa_msgs = database.cargar_mensajes_supabase()
        if supa_msgs is not None:
            return supa_msgs
    return database.cargar_mensajes_local()


def guardar_mensajes(mensajes: List[dict]) -> None:
    database.guardar_mensajes_local(mensajes)
    if database.is_supabase_enabled() and mensajes:
        database.sincronizar_entidad_supabase("mensajes", mensajes)


# Estructura base para el Flujo de Asistencia por horas y días
DEFAULT_FLUJO = {
    "promedio": {
        "08:00": 22, "09:00": 42, "10:00": 38, "11:00": 25, "12:00": 14,
        "15:00": 20, "16:00": 34, "17:00": 52, "18:00": 74, "19:00": 82,
        "20:00": 78, "21:00": 60, "22:00": 32, "23:00": 10
    },
    "lunes": {
        "08:00": 26, "09:00": 48, "10:00": 45, "11:00": 30, "12:00": 16,
        "15:00": 24, "16:00": 40, "17:00": 58, "18:00": 85, "19:00": 92,
        "20:00": 86, "21:00": 68, "22:00": 36, "23:00": 12
    },
    "martes": {
        "08:00": 20, "09:00": 38, "10:00": 36, "11:00": 24, "12:00": 12,
        "15:00": 18, "16:00": 32, "17:00": 50, "18:00": 72, "19:00": 80,
        "20:00": 75, "21:00": 58, "22:00": 30, "23:00": 9
    },
    "miercoles": {
        "08:00": 24, "09:00": 44, "10:00": 40, "11:00": 26, "12:00": 15,
        "15:00": 22, "16:00": 36, "17:00": 54, "18:00": 76, "19:00": 84,
        "20:00": 80, "21:00": 62, "22:00": 34, "23:00": 11
    },
    "jueves": {
        "08:00": 19, "09:00": 36, "10:00": 34, "11:00": 22, "12:00": 11,
        "15:00": 17, "16:00": 30, "17:00": 48, "18:00": 70, "19:00": 78,
        "20:00": 72, "21:00": 55, "22:00": 28, "23:00": 8
    },
    "viernes": {
        "08:00": 25, "09:00": 45, "10:00": 42, "11:00": 28, "12:00": 14,
        "15:00": 22, "16:00": 38, "17:00": 55, "18:00": 78, "19:00": 86,
        "20:00": 74, "21:00": 48, "22:00": 22, "23:00": 6
    },
    "sabado": {
        "09:00": 35, "10:00": 58, "11:00": 64, "12:00": 40
    }
}

# Default gym data structure for the Admin Dashboard (Fechas en formato DD/MM/YYYY)
DEFAULT_GYM_DATA = {
    "socios": [
        {
            "id": 1,
            "nombre": "Esteban Palacios",
            "dni": "39.421.802",
            "telefono": "+54 387 512-3489",
            "plan": "Pase Libre (Todos los días)",
            "cuota": 28000,
            "estado": "Al día",
            "vencimiento": "15/11/2026",
            "clases_semanales": "Ilimitadas",
            "clases_restantes": "Ilimitadas",
            "asistencias_totales": 24,
            "asistencias_semana": 3,
            "ultima_asistencia": "03/11/2026 19:30"
        },
        {
            "id": 2,
            "nombre": "Carolina Méndez",
            "dni": "41.092.311",
            "telefono": "+54 387 498-2134",
            "plan": "Promo Amigos",
            "cuota": 23000,
            "estado": "Al día",
            "vencimiento": "10/11/2026",
            "clases_semanales": "Ilimitadas",
            "clases_restantes": "Ilimitadas",
            "asistencias_totales": 18,
            "asistencias_semana": 2,
            "ultima_asistencia": "02/11/2026 18:15"
        },
        {
            "id": 3,
            "nombre": "Federico Benítez",
            "dni": "38.541.908",
            "telefono": "+54 387 433-8812",
            "plan": "Promo Amigos",
            "cuota": 23000,
            "estado": "Al día",
            "vencimiento": "10/11/2026",
            "clases_semanales": "Ilimitadas",
            "clases_restantes": "Ilimitadas",
            "asistencias_totales": 19,
            "asistencias_semana": 2,
            "ultima_asistencia": "02/11/2026 18:15"
        },
        {
            "id": 4,
            "nombre": "Lucía Villalba",
            "dni": "36.877.201",
            "telefono": "+54 387 601-4475",
            "plan": "Personalizados",
            "cuota": 43000,
            "estado": "Vencido",
            "vencimiento": "18/10/2026",
            "clases_semanales": 12,
            "clases_restantes": 0,
            "asistencias_totales": 14,
            "asistencias_semana": 0,
            "ultima_asistencia": "17/10/2026 10:00"
        },
        {
            "id": 5,
            "nombre": "Matías Carrizo",
            "dni": "42.115.689",
            "telefono": "+54 387 477-9921",
            "plan": "3 veces a la semana",
            "cuota": 22000,
            "estado": "Al día",
            "vencimiento": "24/11/2026",
            "clases_semanales": 3,
            "clases_restantes": 2,
            "asistencias_totales": 11,
            "asistencias_semana": 1,
            "ultima_asistencia": "03/11/2026 20:00"
        },
    ],
    "stock": [
        {
            "id": 1,
            "producto": "Proteína Whey (1kg Vainilla/Choc)",
            "categoria": "Proteínas",
            "stock": 18,
            "precio": 38000,
            "minimo": 5,
        },
        {
            "id": 2,
            "producto": "Yogur Griego Natural Artesanal (500g)",
            "categoria": "Refrigerados",
            "stock": 24,
            "precio": 4500,
            "minimo": 8,
        },
        {
            "id": 3,
            "producto": "Colágeno Hidrolizado Puro (300g)",
            "categoria": "Salud Articular",
            "stock": 12,
            "precio": 29000,
            "minimo": 4,
        },
        {
            "id": 4,
            "producto": "Pre-entreno Explosive Energy (300g)",
            "categoria": "Pre-entrenos",
            "stock": 10,
            "precio": 34000,
            "minimo": 3,
        },
        {
            "id": 5,
            "producto": "Creatina Creapure 300g",
            "categoria": "Rendimiento",
            "stock": 15,
            "precio": 32000,
            "minimo": 5,
        },
    ],
    "maquinas": [
        {
            "id": 1,
            "nombre": "Cinta de Correr Profesional 01",
            "zona": "Cardio",
            "estado": "Operativa",
            "revision": "15/10/2026",
        },
        {
            "id": 2,
            "nombre": "Cinta de Correr Profesional 02",
            "zona": "Cardio",
            "estado": "Operativa",
            "revision": "15/10/2026",
        },
        {
            "id": 3,
            "nombre": "Prensa de Piernas 45°",
            "zona": "Piernas",
            "estado": "Operativa",
            "revision": "10/10/2026",
        },
        {
            "id": 4,
            "nombre": "Doble Polea Regulable (Crossover)",
            "zona": "Musculación",
            "estado": "En mantenimiento",
            "revision": "21/10/2026",
        },
        {
            "id": 5,
            "nombre": "Banco Plano Olímpico + Barra",
            "zona": "Pecho",
            "estado": "Operativa",
            "revision": "01/10/2026",
        },
        {
            "id": 6,
            "nombre": "Bicicleta Estática Spinning 01",
            "zona": "Cardio",
            "estado": "Operativa",
            "revision": "12/10/2026",
        },
    ],
    "finanzas": {
        "ingresos_mes": 1845000,
        "egresos_mes": 690000,
        "movimientos": [
            {
                "id": 1,
                "tipo": "Ingreso",
                "concepto": "Cobro cuotas (12 socios)",
                "monto": 310000,
                "fecha": "21/10/2026",
            },
            {
                "id": 2,
                "tipo": "Ingreso",
                "concepto": "Venta tienda: 3 Proteínas + 4 Yogur",
                "monto": 132000,
                "fecha": "22/10/2026",
            },
            {
                "id": 3,
                "tipo": "Egreso",
                "concepto": "Mantenimiento cable polea doble",
                "monto": 45000,
                "fecha": "21/10/2026",
            },
            {
                "id": 4,
                "tipo": "Egreso",
                "concepto": "Reposición stock suplementos y bebidas",
                "monto": 220000,
                "fecha": "19/10/2026",
            },
        ],
    },
    "flujo_asistencia": copy.deepcopy(DEFAULT_FLUJO),
    "checkins_log": []
}


def parse_socio_vencimiento(venc_str: str) -> Optional[datetime]:
    if not venc_str:
        return None
    venc_str = str(venc_str).strip()
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})", venc_str)
    if m:
        return datetime(int(m.group(3)), int(m.group(2)), int(m.group(1)))
    m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})", venc_str)
    if m:
        return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    return None


def calcular_estado_socio(venc_str: str, now: Optional[datetime] = None) -> str:
    """
    Calcula el estado de cuota según la regla estricta:
    'Cada vez que el dia de vencimiento pase tiene que establecerlo como cuota vencida
     al instante que sean las 12 del dia siguiente al que vence.'
    
    Si el vencimiento es el día D:
    El socio puede entrenar normalmente durante todo el día D.
    Al llegar las 12:00 del día siguiente (D + 1 a las 12:00 hs),
    la cuota pasa automáticamente a 'Vencido'.
    """
    v_date = parse_socio_vencimiento(venc_str)
    if not v_date:
        return "Al día"

    if now is None:
        now = datetime.now()

    # Límite: las 12:00 hs del día siguiente al que vence
    limite_vencimiento = datetime(v_date.year, v_date.month, v_date.day, 12, 0, 0) + timedelta(days=1)

    if now >= limite_vencimiento:
        return "Vencido"
    elif now.date() >= v_date.date():
        # Es el día del vencimiento o la mañana siguiente antes de las 12hs
        return "Por vencer"
    elif (v_date.date() - now.date()).days <= 3:
        # Faltan 3 días o menos para el vencimiento
        return "Por vencer"
    else:
        return "Al día"


def actualizar_estados_socios(data: dict) -> bool:
    """
    Recalcula y actualiza automáticamente los estados de todos los socios según la fecha y hora actual.
    Retorna True si hubo modificaciones.
    """
    modificado = False
    now = datetime.now()
    for s in data.get("socios", []):
        venc = s.get("vencimiento", "")
        if venc:
            nuevo_estado = calcular_estado_socio(venc, now)
            if s.get("estado") != nuevo_estado:
                s["estado"] = nuevo_estado
                modificado = True
    return modificado


def leer_gym_data() -> dict:
    data = None
    if database.is_supabase_enabled():
        data = database.cargar_gym_data_supabase(DEFAULT_FLUJO)
    if not data:
        data = database.cargar_gym_data_local(DEFAULT_GYM_DATA, DEFAULT_FLUJO)

    # Auto-actualizar estado de vencimiento de las cuotas al instante que corresponda
    if actualizar_estados_socios(data):
        guardar_gym_data(data)

    return data


def guardar_gym_data(data: dict) -> None:
    database.guardar_gym_data_local(data)
    if database.is_supabase_enabled():
        if "socios" in data:
            database.sincronizar_entidad_supabase("socios", data["socios"])
        if "stock" in data:
            database.sincronizar_entidad_supabase("stock", data["stock"])
        if "maquinas" in data:
            database.sincronizar_entidad_supabase("maquinas", data["maquinas"])
        if "finanzas" in data and "movimientos" in data["finanzas"]:
            database.sincronizar_entidad_supabase("finanzas_movimientos", data["finanzas"]["movimientos"])
        if "flujo_asistencia" in data:
            flujo_rows = [{"dia": dia, "datos": datos} for dia, datos in data["flujo_asistencia"].items()]
            database.sincronizar_entidad_supabase("flujo_asistencia", flujo_rows)
        if "checkins_log" in data and data["checkins_log"]:
            database.sincronizar_entidad_supabase("checkins_log", data["checkins_log"])


# ==========================================
# ENDPOINTS LIBRO DE VISITAS
# ==========================================


@app.get(
    "/api/mensajes",
    summary="Listar mensajes del libro de visitas",
    tags=["Libro de Visitas"],
    response_model=List[Mensaje],
)
def get_mensajes():
    """
    Retorna la lista completa de mensajes guardados en mensajes.json en orden cronológico inverso.
    """
    mensajes = leer_mensajes()
    return list(reversed(mensajes))


@app.post(
    "/api/mensajes",
    summary="Publicar nuevo mensaje en el libro de visitas",
    tags=["Libro de Visitas"],
    response_model=Mensaje,
    status_code=status.HTTP_201_CREATED,
)
def post_mensaje(data: MensajeInput):
    """
    Crea un nuevo mensaje en el libro de visitas recibiendo 'nombre' y 'texto'.
    Se genera un ID único y la fecha actual antes de persistirlo en mensajes.json.
    """
    nombre_limpio = data.nombre.strip()
    texto_limpio = data.texto.strip()

    if not nombre_limpio or not texto_limpio:
        raise HTTPException(status_code=400, detail="El nombre y el mensaje no pueden estar vacíos.")

    nuevo_mensaje = {
        "id": f"msg-{uuid.uuid4().hex[:8]}",
        "nombre": nombre_limpio,
        "texto": texto_limpio,
        "fecha": datetime.now().strftime("%d/%m/%Y %H:%M"),
    }

    mensajes = leer_mensajes()
    mensajes.append(nuevo_mensaje)
    guardar_mensajes(mensajes)

    return nuevo_mensaje


@app.delete(
    "/api/mensajes/{id}",
    summary="Eliminar un mensaje del libro de visitas",
    tags=["Libro de Visitas"],
)
def delete_mensaje(
    id: str,
    x_admin_key: Optional[str] = Header(None, alias="x-admin-key", description="Clave de administrador provista en el header"),
    key: Optional[str] = Query(None, description="Clave de administrador opcional por query param"),
):
    """
    Elimina un mensaje por su ID.
    Requiere que la clave de administrador provista (en x-admin-key o por query ?key=...)
    coincida con ADMIN_KEY configurada en .env.
    """
    provista = x_admin_key or key

    if not provista or provista != ADMIN_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado: Clave de administrador incorrecta o ausente.",
        )

    mensajes = leer_mensajes()
    original_len = len(mensajes)
    mensajes = [m for m in mensajes if str(m.get("id")) != id]

    if len(mensajes) == original_len:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Mensaje con id '{id}' no encontrado.")

    guardar_mensajes(mensajes)
    return {"message": "Mensaje eliminado correctamente", "id": id}


# ==========================================
# ENDPOINTS PANEL ADMINISTRADOR (ONE+)
# ==========================================


class LoginRequest(BaseModel):
    usuario: str
    password: str


@app.post("/api/admin/login", summary="Validar credenciales de administrador", tags=["Admin ONE+"])
def admin_login(creds: LoginRequest):
    """
    Valida las credenciales de administración:
    usuario: administrador
    contraseña: onemasadmin
    """
    if creds.usuario == "administrador" and creds.password == ADMIN_KEY:
        return {"status": "ok", "token": ADMIN_KEY, "usuario": "administrador"}
    raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")


@app.get("/api/admin/data", summary="Obtener todos los datos del panel", tags=["Admin ONE+"])
def get_admin_data(
    x_admin_key: Optional[str] = Header(None, alias="x-admin-key"),
    key: Optional[str] = Query(None),
):
    provista = x_admin_key or key
    if provista != ADMIN_KEY:
        raise HTTPException(status_code=403, detail="No autorizado")
    return leer_gym_data()


@app.post("/api/admin/socios", summary="Agregar o actualizar socio", tags=["Admin ONE+"])
def save_socio(
    socio: dict,
    x_admin_key: Optional[str] = Header(None, alias="x-admin-key"),
    key: Optional[str] = Query(None),
):
    provista = x_admin_key or key
    if provista != ADMIN_KEY:
        raise HTTPException(status_code=403, detail="No autorizado")

    gym = leer_gym_data()
    socios = gym.setdefault("socios", [])

    # Calcular estado automáticamente según fecha de vencimiento
    if "vencimiento" in socio and socio["vencimiento"]:
        socio["estado"] = calcular_estado_socio(socio["vencimiento"])

    if "id" in socio and socio["id"]:
        # Update existing
        for idx, s in enumerate(socios):
            if str(s.get("id")) == str(socio["id"]):
                socios[idx] = socio
                break
        else:
            socios.append(socio)
    else:
        # Create new
        nuevo_id = max([s.get("id", 0) for s in socios], default=0) + 1
        socio["id"] = nuevo_id
        socios.append(socio)

    guardar_gym_data(gym)
    return {"status": "ok", "socio": socio}


@app.delete("/api/admin/socios/{id}", summary="Eliminar socio", tags=["Admin ONE+"])
def delete_socio(
    id: int,
    x_admin_key: Optional[str] = Header(None, alias="x-admin-key"),
    key: Optional[str] = Query(None),
):
    provista = x_admin_key or key
    if provista != ADMIN_KEY:
        raise HTTPException(status_code=403, detail="No autorizado")

    gym = leer_gym_data()
    socios = gym.setdefault("socios", [])
    original_len = len(socios)
    gym["socios"] = [s for s in socios if str(s.get("id")) != str(id)]

    if len(gym["socios"]) == original_len:
        raise HTTPException(status_code=404, detail="Socio no encontrado")

    guardar_gym_data(gym)
    return {"status": "ok", "message": f"Socio con ID {id} eliminado exitosamente", "id": id}


@app.post("/api/admin/socios/cobrar", summary="Registrar cobro de cuota, cambio de plan y meses adelantados", tags=["Admin ONE+"])
def cobrar_cuota_socio(
    payload: dict,
    x_admin_key: Optional[str] = Header(None, alias="x-admin-key"),
    key: Optional[str] = Query(None),
):
    """
    Registra el pago de cuota para un socio con soporte para:
    1. Mantener plan actual o cambiar de plan.
    2. Cobrar 1, 2 o hasta 3 meses por adelantado.
    3. Actualizar vencimiento y estado a 'Al día'.
    4. Registrar movimiento en finanzas como Ingreso.
    """
    provista = x_admin_key or key
    if provista != ADMIN_KEY:
        raise HTTPException(status_code=403, detail="No autorizado")

    socio_id = payload.get("socio_id")
    nuevo_plan = payload.get("plan")
    cuota_mensual = payload.get("cuota")
    meses = int(payload.get("meses", 1))
    monto_total = float(payload.get("monto_total", 0))
    nuevo_vencimiento = payload.get("nuevo_vencimiento")

    if meses < 1 or meses > 3:
        raise HTTPException(status_code=400, detail="Solo se permite pagar hasta 3 meses por adelantado.")

    gym = leer_gym_data()
    socios = gym.setdefault("socios", [])

    socio = None
    for s in socios:
        if str(s.get("id")) == str(socio_id):
            socio = s
            break

    if not socio:
        raise HTTPException(status_code=404, detail="Socio no encontrado")

    # Actualizar datos del socio
    if nuevo_plan:
        socio["plan"] = nuevo_plan
    if cuota_mensual is not None:
        socio["cuota"] = int(cuota_mensual)
    if nuevo_vencimiento:
        socio["vencimiento"] = nuevo_vencimiento
    
    socio["estado"] = "Al día"

    # Ajuste de clases según modalidad del plan
    plan_lower = str(socio.get("plan", "")).lower()
    if "3 veces" in plan_lower:
        socio["clases_semanales"] = 3
        socio["clases_restantes"] = 3
        socio["asistencias_semana"] = 0
    elif "personalizad" in plan_lower:
        socio["clases_semanales"] = 12
        socio["clases_restantes"] = 12
        socio["asistencias_semana"] = 0
    elif "individual" in plan_lower:
        socio["clases_semanales"] = 1
        socio["clases_restantes"] = 1
        socio["asistencias_semana"] = 0
    else:
        socio["clases_semanales"] = "Ilimitadas"
        socio["clases_restantes"] = "Ilimitadas"
        socio["asistencias_semana"] = 0

    # Registrar ingreso en Finanzas
    fin = gym.setdefault("finanzas", {"ingresos_mes": 0, "egresos_mes": 0, "movimientos": []})
    movs = fin.setdefault("movimientos", [])
    
    meses_txt = f"{meses} mes" if meses == 1 else f"{meses} meses (adelantado)"
    concepto = f"Cobro cuota ({meses_txt}): {socio['nombre']} - {socio['plan']}"
    monto_final = monto_total if monto_total > 0 else (socio.get("cuota", 0) * meses)
    
    nuevo_mov = {
        "id": len(movs) + 1,
        "tipo": "Ingreso",
        "concepto": concepto,
        "monto": monto_final,
        "fecha": datetime.now().strftime("%d/%m/%Y"),
    }
    movs.insert(0, nuevo_mov)
    fin["ingresos_mes"] = fin.get("ingresos_mes", 0) + monto_final

    guardar_gym_data(gym)
    return {
        "status": "ok",
        "socio": socio,
        "finanzas": fin,
        "movimiento": nuevo_mov,
        "mensaje": f"Cuota registrada por {meses} mes(es) hasta el {socio['vencimiento']}"
    }


@app.post("/api/admin/socios/checkin", summary="Registrar check-in de socio", tags=["Admin ONE+"])
def checkin_socio(
    payload: dict,
    x_admin_key: Optional[str] = Header(None, alias="x-admin-key"),
    key: Optional[str] = Query(None),
):
    provista = x_admin_key or key
    if provista != ADMIN_KEY:
        raise HTTPException(status_code=403, detail="No autorizado")

    socio_id = payload.get("id")
    dni = str(payload.get("dni", "")).strip()

    gym = leer_gym_data()
    socios = gym.setdefault("socios", [])

    socio = None
    for s in socios:
        if socio_id and str(s.get("id")) == str(socio_id):
            socio = s
            break
        elif dni:
            s_dni_clean = "".join(filter(str.isdigit, str(s.get("dni", ""))))
            dni_clean = "".join(filter(str.isdigit, dni))
            if s_dni_clean and s_dni_clean == dni_clean:
                socio = s
                break

    if not socio:
        raise HTTPException(status_code=404, detail="Socio no encontrado")

    # Contadores
    asistencias_totales = int(socio.get("asistencias_totales", 0)) + 1
    asistencias_semana = int(socio.get("asistencias_semana", 0)) + 1
    socio["asistencias_totales"] = asistencias_totales
    socio["asistencias_semana"] = asistencias_semana
    now = datetime.now()
    socio["ultima_asistencia"] = now.strftime("%d/%m/%Y %H:%M")

    # Descuento de clases si tiene clases limitadas
    plan_name = str(socio.get("plan", "")).lower()
    clases_restantes = socio.get("clases_restantes")

    if clases_restantes is not None and isinstance(clases_restantes, (int, float)):
        if clases_restantes > 0:
            socio["clases_restantes"] = int(clases_restantes) - 1
    elif "3 veces" in plan_name:
        socio["clases_semanales"] = 3
        socio["clases_restantes"] = 2
    elif "personalizad" in plan_name:
        socio["clases_semanales"] = 12
        socio["clases_restantes"] = 11

    # Registrar en flujo_asistencia dinámico
    flujo = gym.setdefault("flujo_asistencia", copy.deepcopy(DEFAULT_FLUJO))
    dias_map = {0: "lunes", 1: "martes", 2: "miercoles", 3: "jueves", 4: "viernes", 5: "sabado", 6: "lunes"}
    dia_clave = dias_map.get(now.weekday(), "lunes")

    # Determinar bucket horario de ONE+ Gym
    if dia_clave == "sabado":
        sab_buckets = ["09:00", "10:00", "11:00", "12:00"]
        h_str = f"{now.hour:02d}:00"
        if h_str in sab_buckets:
            bucket = h_str
        elif now.hour < 9:
            bucket = "09:00"
        else:
            bucket = "12:00"
    else:
        sem_buckets = ["08:00", "09:00", "10:00", "11:00", "12:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00"]
        h_str = f"{now.hour:02d}:00"
        if h_str in sem_buckets:
            bucket = h_str
        elif now.hour < 8:
            bucket = "08:00"
        elif now.hour in (13, 14):
            bucket = "12:00" if now.hour == 13 else "15:00"
        else:
            bucket = "23:00"

    # Incrementar flujo del día
    if dia_clave in flujo and bucket in flujo[dia_clave]:
        flujo[dia_clave][bucket] += 1
    elif dia_clave in flujo:
        flujo[dia_clave][bucket] = 1

    # Recalcular promedio para ese bucket
    dias_activos = [d for d in ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"] if bucket in flujo.get(d, {})]
    if dias_activos:
        flujo["promedio"][bucket] = round(sum(flujo[d][bucket] for d in dias_activos) / len(dias_activos))

    # Registrar en historial persistente de checkins
    checkins_log = gym.setdefault("checkins_log", [])
    checkin_record = {
        "socio_id": socio.get("id"),
        "nombre": socio.get("nombre"),
        "dni": socio.get("dni"),
        "dia": dia_clave,
        "hora_bucket": bucket,
        "hora_exacta": now.strftime("%H:%M:%S"),
        "fecha": now.strftime("%d/%m/%Y"),
        "fecha_completa": now.strftime("%d/%m/%Y %H:%M")
    }
    checkins_log.insert(0, checkin_record)

    guardar_gym_data(gym)
    return {
        "status": "ok",
        "socio": socio,
        "flujo_asistencia": flujo,
        "checkin": checkin_record
    }


@app.post("/api/admin/stock", summary="Agregar o actualizar producto en stock", tags=["Admin ONE+"])
def save_stock_item(
    item: dict,
    x_admin_key: Optional[str] = Header(None, alias="x-admin-key"),
    key: Optional[str] = Query(None),
):
    provista = x_admin_key or key
    if provista != ADMIN_KEY:
        raise HTTPException(status_code=403, detail="No autorizado")

    gym = leer_gym_data()
    stock_list = gym.setdefault("stock", [])

    if "id" in item and item["id"]:
        for idx, p in enumerate(stock_list):
            if str(p.get("id")) == str(item["id"]):
                stock_list[idx] = item
                break
        else:
            stock_list.append(item)
    else:
        nuevo_id = max([p.get("id", 0) for p in stock_list], default=0) + 1
        item["id"] = nuevo_id
        stock_list.append(item)

    guardar_gym_data(gym)
    return {"status": "ok", "item": item}


@app.delete("/api/admin/stock/{id}", summary="Eliminar producto de stock", tags=["Admin ONE+"])
def delete_stock_item(
    id: int,
    x_admin_key: Optional[str] = Header(None, alias="x-admin-key"),
    key: Optional[str] = Query(None),
):
    provista = x_admin_key or key
    if provista != ADMIN_KEY:
        raise HTTPException(status_code=403, detail="No autorizado")

    gym = leer_gym_data()
    stock_list = gym.setdefault("stock", [])
    original_len = len(stock_list)
    gym["stock"] = [p for p in stock_list if str(p.get("id")) != str(id)]

    if len(gym["stock"]) == original_len:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    guardar_gym_data(gym)
    return {"status": "ok", "message": f"Producto con ID {id} eliminado correctamente", "id": id}


@app.post("/api/admin/stock/adjust", summary="Ajustar stock de un producto", tags=["Admin ONE+"])
def adjust_stock(
    payload: dict,
    x_admin_key: Optional[str] = Header(None, alias="x-admin-key"),
    key: Optional[str] = Query(None),
):
    provista = x_admin_key or key
    if provista != ADMIN_KEY:
        raise HTTPException(status_code=403, detail="No autorizado")

    prod_id = payload.get("id")
    delta = payload.get("delta", 0)

    gym = leer_gym_data()
    for item in gym.setdefault("stock", []):
        if str(item.get("id")) == str(prod_id):
            item["stock"] = max(0, item.get("stock", 0) + delta)
            guardar_gym_data(gym)
            return {"status": "ok", "item": item}

    raise HTTPException(status_code=404, detail="Producto no encontrado")


@app.post("/api/admin/maquinas", summary="Agregar o actualizar máquina", tags=["Admin ONE+"])
def save_maquina(
    maquina: dict,
    x_admin_key: Optional[str] = Header(None, alias="x-admin-key"),
    key: Optional[str] = Query(None),
):
    provista = x_admin_key or key
    if provista != ADMIN_KEY:
        raise HTTPException(status_code=403, detail="No autorizado")

    gym = leer_gym_data()
    maquinas = gym.setdefault("maquinas", [])

    if "id" in maquina and maquina["id"]:
        for idx, m in enumerate(maquinas):
            if str(m.get("id")) == str(maquina["id"]):
                maquinas[idx] = maquina
                break
        else:
            maquinas.append(maquina)
    else:
        nuevo_id = max([m.get("id", 0) for m in maquinas], default=0) + 1
        maquina["id"] = nuevo_id
        if "revision" not in maquina or not maquina["revision"]:
            maquina["revision"] = datetime.now().strftime("%d/%m/%Y")
        maquinas.append(maquina)

    guardar_gym_data(gym)
    return {"status": "ok", "maquina": maquina}


@app.delete("/api/admin/maquinas/{id}", summary="Eliminar máquina", tags=["Admin ONE+"])
def delete_maquina(
    id: int,
    x_admin_key: Optional[str] = Header(None, alias="x-admin-key"),
    key: Optional[str] = Query(None),
):
    provista = x_admin_key or key
    if provista != ADMIN_KEY:
        raise HTTPException(status_code=403, detail="No autorizado")

    gym = leer_gym_data()
    maquinas = gym.setdefault("maquinas", [])
    original_len = len(maquinas)
    gym["maquinas"] = [m for m in maquinas if str(m.get("id")) != str(id)]

    if len(gym["maquinas"]) == original_len:
        raise HTTPException(status_code=404, detail="Máquina no encontrada")

    guardar_gym_data(gym)
    return {"status": "ok", "message": f"Máquina con ID {id} eliminada correctamente", "id": id}


@app.post("/api/admin/maquinas/status", summary="Cambiar estado de máquina", tags=["Admin ONE+"])
def update_machine_status(
    payload: dict,
    x_admin_key: Optional[str] = Header(None, alias="x-admin-key"),
    key: Optional[str] = Query(None),
):
    provista = x_admin_key or key
    if provista != ADMIN_KEY:
        raise HTTPException(status_code=403, detail="No autorizado")

    m_id = payload.get("id")
    nuevo_estado = payload.get("estado")

    gym = leer_gym_data()
    for item in gym.setdefault("maquinas", []):
        if str(item.get("id")) == str(m_id):
            item["estado"] = nuevo_estado
            item["revision"] = datetime.now().strftime("%d/%m/%Y")
            guardar_gym_data(gym)
            return {"status": "ok", "item": item}

    raise HTTPException(status_code=404, detail="Máquina no encontrada")


@app.post("/api/admin/finanzas/movimiento", summary="Registrar ingreso o egreso", tags=["Admin ONE+"])
def add_movimiento(
    payload: dict,
    x_admin_key: Optional[str] = Header(None, alias="x-admin-key"),
    key: Optional[str] = Query(None),
):
    provista = x_admin_key or key
    if provista != ADMIN_KEY:
        raise HTTPException(status_code=403, detail="No autorizado")

    gym = leer_gym_data()
    fin = gym.setdefault("finanzas", {"ingresos_mes": 0, "egresos_mes": 0, "movimientos": []})
    movs = fin.setdefault("movimientos", [])

    monto = float(payload.get("monto", 0))
    tipo = payload.get("tipo", "Ingreso")
    nuevo_mov = {
        "id": len(movs) + 1,
        "tipo": tipo,
        "concepto": payload.get("concepto", "Movimiento general"),
        "monto": monto,
        "fecha": datetime.now().strftime("%d/%m/%Y"),
    }
    movs.insert(0, nuevo_mov)

    if tipo.lower() == "ingreso":
        fin["ingresos_mes"] = fin.get("ingresos_mes", 0) + monto
    else:
        fin["egresos_mes"] = fin.get("egresos_mes", 0) + monto

    guardar_gym_data(gym)
    return {"status": "ok", "movimiento": nuevo_mov, "finanzas": fin}


# ==========================================
# SERVING STATIC FRONTEND (Página Web)
# ==========================================


@app.get("/", summary="Página Principal", include_in_schema=False)
def serve_index():
    index_file = BASE_DIR / "index.html"
    if not index_file.exists():
        raise HTTPException(status_code=404, detail="index.html no encontrado.")
    return FileResponse(index_file)


@app.get("/styles.css", summary="Estilos CSS", include_in_schema=False)
def serve_css():
    css_file = BASE_DIR / "styles.css"
    if not css_file.exists():
        raise HTTPException(status_code=404, detail="styles.css no encontrado.")
    return FileResponse(css_file, media_type="text/css")


@app.get("/script.js", summary="Script JavaScript", include_in_schema=False)
def serve_js():
    js_file = BASE_DIR / "script.js"
    if not js_file.exists():
        raise HTTPException(status_code=404, detail="script.js no encontrado.")
    return FileResponse(js_file, media_type="application/javascript")


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    print(f"🚀 Iniciando servidor ONE+ Gym en http://localhost:{port}")
    print(f"📖 Documentación interactiva de la API: http://localhost:{port}/docs")
    uvicorn.run("main:app", host=host, port=port, reload=True)
