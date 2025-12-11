import requests
from bs4 import BeautifulSoup
import time
import re

# --------------------------------------------------
# CONFIGURACIÓN
# --------------------------------------------------
API_BASE = "http://localhost:4000/api"

EQUIPOS_CLASIFICADOS = [
    # Anfitriones
    {"name": "Canada", "code": "CAN", "confederation": "CONCACAF"},
    {"name": "Mexico", "code": "MEX", "confederation": "CONCACAF"},
    {"name": "United States", "code": "USA", "confederation": "CONCACAF"},
    
    # UEFA
    {"name": "England", "code": "ENG", "confederation": "UEFA"},
    {"name": "France", "code": "FRA", "confederation": "UEFA"},
    {"name": "Croatia", "code": "CRO", "confederation": "UEFA"},
    {"name": "Norway", "code": "NOR", "confederation": "UEFA"},
    {"name": "Portugal", "code": "POR", "confederation": "UEFA"},
    {"name": "Germany", "code": "GER", "confederation": "UEFA"},
    {"name": "Netherlands", "code": "NED", "confederation": "UEFA"},
    {"name": "Switzerland", "code": "SUI", "confederation": "UEFA"},
    {"name": "Scotland", "code": "SCO", "confederation": "UEFA"},
    {"name": "Spain", "code": "ESP", "confederation": "UEFA"},
    {"name": "Austria", "code": "AUT", "confederation": "UEFA"},
    {"name": "Belgium", "code": "BEL", "confederation": "UEFA"},
    
    # CONMEBOL
    {"name": "Argentina", "code": "ARG", "confederation": "CONMEBOL"},
    {"name": "Uruguay", "code": "URU", "confederation": "CONMEBOL"},
    {"name": "Colombia", "code": "COL", "confederation": "CONMEBOL"},
    {"name": "Brazil", "code": "BRA", "confederation": "CONMEBOL"},
    {"name": "Ecuador", "code": "ECU", "confederation": "CONMEBOL"},
    {"name": "Paraguay", "code": "PAR", "confederation": "CONMEBOL"},
    
    # AFC
    {"name": "Japan", "code": "JPN", "confederation": "AFC"},
    {"name": "Iran", "code": "IRN", "confederation": "AFC"},
    {"name": "South Korea", "code": "KOR", "confederation": "AFC"},
    {"name": "Australia", "code": "AUS", "confederation": "AFC"},
    {"name": "Qatar", "code": "QAT", "confederation": "AFC"},
    {"name": "Saudi Arabia", "code": "KSA", "confederation": "AFC"},
    {"name": "Jordan", "code": "JOR", "confederation": "AFC"},
    {"name": "Uzbekistan", "code": "UZB", "confederation": "AFC"},
    
    # CAF
    {"name": "Morocco", "code": "MAR", "confederation": "CAF"},
    {"name": "Senegal", "code": "SEN", "confederation": "CAF"},
    {"name": "Egypt", "code": "EGY", "confederation": "CAF"},
    {"name": "Algeria", "code": "ALG", "confederation": "CAF"},
    {"name": "Cameroon", "code": "CMR", "confederation": "CAF"},
    {"name": "Mali", "code": "MLI", "confederation": "CAF"},
    {"name": "Ivory Coast", "code": "CIV", "confederation": "CAF"},
    {"name": "Cape Verde", "code": "CPV", "confederation": "CAF"},
    {"name": "Nigeria", "code": "NGA", "confederation": "CAF"},
    
    # CONCACAF extra
    {"name": "Panama", "code": "PAN", "confederation": "CONCACAF"},
    {"name": "Haiti", "code": "HAI", "confederation": "CONCACAF"},
    {"name": "Curacao", "code": "CUW", "confederation": "CONCACAF"},
    
    # OFC
    {"name": "New Zealand", "code": "NZL", "confederation": "OFC"},
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
}

# Sesión Global
session = requests.Session()
session.headers.update(HEADERS)

# --------------------------------------------------
# HELPERS
# --------------------------------------------------
def construir_url_wikipedia(nombre_equipo):
    mapeo_especial = {
        "United States": "United_States_men's_national_soccer_team",
        "China": "China_national_football_team"
    }
    if nombre_equipo in mapeo_especial:
        return f"https://en.wikipedia.org/wiki/{mapeo_especial[nombre_equipo]}"
    
    nombre_url = nombre_equipo.replace(" ", "_")
    return f"https://en.wikipedia.org/wiki/{nombre_url}_national_football_team"

def normalizar_posicion(pos_texto):
    if not pos_texto: return "Unknown"
    # Limpiar números ocultos (ej: "1GK" -> "GK")
    pos_texto = re.sub(r'\d+', '', pos_texto).upper().strip()
    
    if "GK" in pos_texto: return "GK"
    elif any(x in pos_texto for x in ["DF", "CB", "LB", "RB"]): return "DF"
    elif any(x in pos_texto for x in ["MF", "CM", "CDM", "CAM"]): return "MF"
    elif any(x in pos_texto for x in ["FW", "ST", "LW", "RW"]): return "FW"
    return "Unknown"

def limpiar_texto(texto):
    if not texto: return ""
    texto = re.sub(r'\[.*?\]', '', texto) # Quitar [1]
    texto = texto.replace("(captain)", "").replace("(c)", "")
    return texto.strip()

# --------------------------------------------------
# FUNCIONES PRINCIPALES
# --------------------------------------------------
def crear_equipo_en_api(team):
    payload = {"name": team["name"], "code": team["code"], "confederation": team["confederation"]}
    try:
        resp = session.post(f"{API_BASE}/teams", json=payload, timeout=10)
        if resp.status_code in (200, 201):
            data = resp.json()
            # Soporte para devolver _id o id
            return data.get("_id") or data.get("id")
    except Exception:
        pass
    return None

def scrapear_y_guardar_jugadores(team, team_id):
    wiki_url = construir_url_wikipedia(team["name"])
    print(f"   🔍 {team['name']}: {wiki_url}")
    
    try:
        resp = session.get(wiki_url, timeout=20)
    except Exception:
        return 0

    soup = BeautifulSoup(resp.text, "html.parser")
    
    # 1. BUSCAR LA CLASE EXACTA QUE VIMOS EN TU DEBUG
    filas = soup.find_all("tr", class_="nat-fs-player")

    # Fallback si no encuentra esa clase (para equipos con tablas viejas)
    if not filas:
        sectores = ["Current_squad", "Squad", "Players"]
        for sec in sectores:
            span = soup.find("span", id=sec)
            if span:
                tabla = span.find_next("table", class_="wikitable")
                if tabla:
                    filas = tabla.find_all("tr")[1:]
                    break
    
    if not filas:
        print("   ⚠️ No se encontraron jugadores.")
        return 0

    guardados = 0
    errores = 0

    for fila in filas:
        try:
            # ---------------------------------------------------
            # AQUÍ ESTÁ LA MAGIA BASADA EN TU DEBUG
            # ---------------------------------------------------
            
            # 1. NOMBRE: Tu debug dice que es Columna 2 y es un <TH>
            celda_nombre = fila.find("th") # Buscamos el único TH de la fila
            if not celda_nombre:
                # Si no hay TH, intentamos buscar el TD con enlace (caso raro)
                celdas = fila.find_all("td")
                if len(celdas) > 2: celda_nombre = celdas[2] # Fallback índice 2
            
            if not celda_nombre: continue

            nombre = celda_nombre.get_text(strip=True)
            # Limpieza extra: a veces viene el texto "(captain)" pegado
            nombre = limpiar_texto(nombre)

            # Filtro de seguridad: Si el nombre empieza con paréntesis es una fecha, saltar
            if nombre.startswith("(") or "age" in nombre: continue
            
            # 2. RESTO DE DATOS (TDs)
            celdas_td = fila.find_all("td")
            if not celdas_td: continue

            # NUMERO (Columna 0 en tu debug)
            num = celdas_td[0].get_text(strip=True)
            
            # POSICION (Columna 1 en tu debug: "1GK")
            pos_raw = celdas_td[1].get_text(strip=True)
            pos_norm = normalizar_posicion(pos_raw) # Esto limpiará el "1"

            # CLUB (Ultima columna)
            club = celdas_td[-1].get_text(strip=True)
            club = limpiar_texto(club)

            # ---------------------------------------------------
            # GUARDAR
            # ---------------------------------------------------
            payload = {
                "name": nombre,
                "position": pos_norm,
                "club": club,
                "teamId": team_id,
                "shirtNumber": num if num.isdigit() else None,
                "photo": None
            }

            r = session.post(f"{API_BASE}/players", json=payload, timeout=5)
            
            if r.status_code in (200, 201):
                guardados += 1
                if guardados <= 3:
                    print(f"      ✓ {nombre} ({pos_norm}) - {club}")
            else:
                errores += 1

        except Exception:
            continue

    print(f"   🎉 {guardados} jugadores guardados.")
    return guardados

# --------------------------------------------------
# MAIN
# --------------------------------------------------
def main():
    print("\n🏁 INICIANDO SCRAPER MUNDIAL 2026\n")
    
    # Check conexión simple
    try:
        session.get(API_BASE.replace("/api", ""), timeout=3)
    except:
        print("❌ Error: No se detecta el backend en localhost:4000")
        return

    total = 0
    for team in EQUIPOS_CLASIFICADOS:
        print("-" * 50)
        print(f"🏴 Procesando: {team['name']}")
        
        tid = crear_equipo_en_api(team)
        if tid:
            total += scrapear_y_guardar_jugadores(team, tid)
        
        time.sleep(1) # Pausa ética

    print("\n" + "="*50)
    print(f"✅ FINALIZADO. Total jugadores: {total}")

if __name__ == "__main__":
    main()