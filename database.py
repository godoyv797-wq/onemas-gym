"""
Módulo de Acceso a Datos de ONE+ Gym.
Soporta conexión dual:
1. Supabase (PostgreSQL en la nube vía API REST PostgREST) cuando SUPABASE_URL y SUPABASE_KEY están configurados.
2. Archivos locales JSON (gym_data.json y mensajes.json) como respaldo local o cuando Supabase no está configurado.
"""

import os
import json
import copy
import urllib.request
import urllib.error
from pathlib import Path
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

DATA_FILE = BASE_DIR / "mensajes.json"
GYM_DATA_FILE = BASE_DIR / "gym_data.json"


def is_supabase_enabled() -> bool:
    """Verifica si las credenciales de Supabase están configuradas en el entorno."""
    return bool(SUPABASE_URL and SUPABASE_KEY and "tu-proyecto" not in SUPABASE_URL)


def _supabase_request(endpoint: str, method: str = "GET", data: Optional[Any] = None, headers_extra: Optional[dict] = None) -> Any:
    """Realiza una petición HTTP autenticada a la API REST de Supabase (PostgREST)."""
    if not is_supabase_enabled():
        return None

    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    if headers_extra:
        headers.update(headers_extra)

    payload = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=payload, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            content = resp.read().decode("utf-8")
            if content:
                return json.loads(content)
            return None
    except Exception as e:
        print(f"[Supabase Warning] Error en {method} {endpoint}: {e}")
        return None


# ==========================================
# GESTIÓN DE DATOS DEL GIMNASIO (gym_data)
# ==========================================

def cargar_gym_data_local(default_data: dict, default_flujo: dict) -> dict:
    """Carga los datos desde el archivo plano local gym_data.json."""
    if not GYM_DATA_FILE.exists():
        with open(GYM_DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(default_data, f, indent=2, ensure_ascii=False)
        return copy.deepcopy(default_data)
    try:
        with open(GYM_DATA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            if "flujo_asistencia" not in data:
                data["flujo_asistencia"] = copy.deepcopy(default_flujo)
            if "checkins_log" not in data:
                data["checkins_log"] = []
            return data
    except Exception:
        return copy.deepcopy(default_data)


def guardar_gym_data_local(data: dict) -> None:
    """Persiste los datos en el archivo plano local gym_data.json."""
    try:
        with open(GYM_DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"[Local Storage Error] No se pudo guardar gym_data.json: {e}")


def cargar_gym_data_supabase(default_flujo: dict) -> Optional[dict]:
    """Descarga el conjunto completo de datos desde Supabase."""
    if not is_supabase_enabled():
        return None

    try:
        socios = _supabase_request("socios?order=id.asc")
        if socios is None:
            return None  # Falló la conexión o la tabla no existe

        stock = _supabase_request("stock?order=id.asc") or []
        maquinas = _supabase_request("maquinas?order=id.asc") or []
        movimientos = _supabase_request("finanzas_movimientos?order=id.asc") or []
        checkins = _supabase_request("checkins_log?order=id.desc&limit=500") or []
        flujo_rows = _supabase_request("flujo_asistencia") or []

        # Reconstruir flujo de asistencia
        flujo = copy.deepcopy(default_flujo)
        for row in flujo_rows:
            dia = row.get("dia")
            datos = row.get("datos")
            if dia and datos:
                flujo[dia] = datos

        # Calcular totales de finanzas
        ingresos_mes = sum(float(m.get("monto", 0)) for m in movimientos if m.get("tipo") == "Ingreso")
        egresos_mes = sum(float(m.get("monto", 0)) for m in movimientos if m.get("tipo") == "Egreso")

        return {
            "socios": socios,
            "stock": stock,
            "maquinas": maquinas,
            "finanzas": {
                "ingresos_mes": ingresos_mes,
                "egresos_mes": egresos_mes,
                "movimientos": movimientos
            },
            "flujo_asistencia": flujo,
            "checkins_log": checkins
        }
    except Exception as e:
        print(f"[Supabase Sync Error] Error al sincronizar con Supabase: {e}")
        return None


def sincronizar_entidad_supabase(tabla: str, registros: list) -> bool:
    """Inserta o actualiza un lote de registros en Supabase."""
    if not is_supabase_enabled():
        return False
    res = _supabase_request(tabla, method="POST", data=registros, headers_extra={"Prefer": "resolution=merge-duplicates"})
    return res is not None


# ==========================================
# GESTIÓN DEL LIBRO DE VISITAS (mensajes)
# ==========================================

def cargar_mensajes_local() -> List[dict]:
    """Carga los mensajes desde mensajes.json."""
    if not DATA_FILE.exists():
        DATA_FILE.write_text("[]", encoding="utf-8")
        return []
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def guardar_mensajes_local(mensajes: List[dict]) -> None:
    """Guarda los mensajes en mensajes.json."""
    try:
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(mensajes, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"[Local Storage Error] No se pudo guardar mensajes.json: {e}")


def cargar_mensajes_supabase() -> Optional[List[dict]]:
    """Carga los mensajes desde la tabla 'mensajes' de Supabase."""
    if not is_supabase_enabled():
        return None
    return _supabase_request("mensajes?order=created_at.desc")


def guardar_mensaje_supabase(mensaje: dict) -> bool:
    """Inserta un nuevo mensaje en Supabase."""
    if not is_supabase_enabled():
        return False
    res = _supabase_request("mensajes", method="POST", data=[mensaje], headers_extra={"Prefer": "resolution=merge-duplicates"})
    return res is not None


def eliminar_mensaje_supabase(msg_id: str) -> bool:
    """Elimina un mensaje de Supabase por su id."""
    if not is_supabase_enabled():
        return False
    res = _supabase_request(f"mensajes?id=eq.{msg_id}", method="DELETE")
    return True
