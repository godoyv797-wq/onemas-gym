"""
Script de migración de datos locales (gym_data.json y mensajes.json) a Supabase.
Puede ejecutarse mediante:
    python migrate_to_supabase.py

Requiere que en el archivo .env o en variables de entorno estén definidas:
    SUPABASE_URL=https://tu-proyecto.supabase.co
    SUPABASE_KEY=tu-clave-anon-o-service-role
"""

import os
import json
import urllib.request
import urllib.error
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

def post_supabase(table: str, data: list):
    """Inserta registros en una tabla de Supabase usando la API REST PostgREST."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("SUPABASE_URL y SUPABASE_KEY deben estar definidos en el archivo .env")

    url = f"{SUPABASE_URL}/rest/v1/{table}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }

    payload = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers=headers, method="POST")

    try:
        with urllib.request.urlopen(req) as resp:
            status = resp.getcode()
            print(f" [OK] Migrados {len(data)} registros a tabla '{table}' (HTTP {status})")
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        print(f" [ERROR] Error migrando tabla '{table}': {e.code} - {error_body}")
        raise

def migrar():
    print("==================================================")
    print(" INICIANDO MIGRACIÓN DE ONE+ GYM A SUPABASE")
    print("==================================================")

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("\n [!] ERROR: No se encontraron SUPABASE_URL y SUPABASE_KEY en .env")
        print("    Por favor agrega tus credenciales de Supabase en el archivo .env:")
        print("    SUPABASE_URL=https://xxxx.supabase.co")
        print("    SUPABASE_KEY=eyJhbGciOi...\n")
        return

    # 1. Cargar gym_data.json
    try:
        with open("gym_data.json", "r", encoding="utf-8") as f:
            gym_data = json.load(f)
    except Exception as e:
        print(f" [!] Error al leer gym_data.json: {e}")
        return

    # 2. Migrar Socios
    socios = gym_data.get("socios", [])
    if socios:
        print(f"-> Migrando {len(socios)} socios...")
        # Normalizar tipos para PostgreSQL
        for s in socios:
            s["clases_semanales"] = str(s.get("clases_semanales", "Ilimitadas"))
            s["clases_restantes"] = str(s.get("clases_restantes", "Ilimitadas"))
        post_supabase("socios", socios)

    # 3. Migrar Stock
    stock = gym_data.get("stock", [])
    if stock:
        print(f"-> Migrando {len(stock)} items de stock...")
        post_supabase("stock", stock)

    # 4. Migrar Maquinas
    maquinas = gym_data.get("maquinas", [])
    if maquinas:
        print(f"-> Migrando {len(maquinas)} máquinas...")
        post_supabase("maquinas", maquinas)

    # 5. Migrar Finanzas Movimientos
    finanzas = gym_data.get("finanzas", {})
    movimientos = finanzas.get("movimientos", [])
    if movimientos:
        print(f"-> Migrando {len(movimientos)} movimientos financieros...")
        post_supabase("finanzas_movimientos", movimientos)

    # 6. Migrar Flujo de Asistencia
    flujo = gym_data.get("flujo_asistencia", {})
    if flujo:
        print("-> Migrando flujo de asistencia horario...")
        flujo_rows = [{"dia": dia, "datos": datos} for dia, datos in flujo.items()]
        post_supabase("flujo_asistencia", flujo_rows)

    # 7. Migrar Checkins Log
    checkins = gym_data.get("checkins_log", [])
    if checkins:
        print(f"-> Migrando {len(checkins)} registros de check-in...")
        post_supabase("checkins_log", checkins)

    # 8. Migrar Mensajes
    try:
        with open("mensajes.json", "r", encoding="utf-8") as f:
            mensajes = json.load(f)
        if mensajes:
            print(f"-> Migrando {len(mensajes)} mensajes del muro...")
            post_supabase("mensajes", mensajes)
    except Exception as e:
        print(f" [!] No se pudo migrar mensajes.json: {e}")

    print("==================================================")
    print(" ¡MIGRACIÓN COMPLETADA CON ÉXITO EN SUPABASE!")
    print("==================================================")

if __name__ == "__main__":
    migrar()
