import requests
from bs4 import BeautifulSoup
import time

# --------------------------------------------------
# CONFIGURACIÓN
# --------------------------------------------------
API_BASE = "http://localhost:4000/api"

# Equipos clasificados manualmente (basados en información actualizada)
EQUIPOS_CLASIFICADOS = [
    # Anfitriones (automáticos)
    {"name": "Canada", "code": "CAN", "confederation": "CONCACAF"},
    {"name": "Mexico", "code": "MEX", "confederation": "CONCACAF"},
    {"name": "United States", "code": "USA", "confederation": "CONCACAF"},
    
    # UEFA (Europa) - 12 clasificados
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
    
    # CONMEBOL (Sudamérica) - 6 clasificados
    {"name": "Argentina", "code": "ARG", "confederation": "CONMEBOL"},
    {"name": "Uruguay", "code": "URU", "confederation": "CONMEBOL"},
    {"name": "Colombia", "code": "COL", "confederation": "CONMEBOL"},
    {"name": "Brazil", "code": "BRA", "confederation": "CONMEBOL"},
    {"name": "Ecuador", "code": "ECU", "confederation": "CONMEBOL"},
    {"name": "Paraguay", "code": "PAR", "confederation": "CONMEBOL"},
    
    # AFC (Asia) - 8 clasificados
    {"name": "Japan", "code": "JPN", "confederation": "AFC"},
    {"name": "Iran", "code": "IRN", "confederation": "AFC"},
    {"name": "South Korea", "code": "KOR", "confederation": "AFC"},
    {"name": "Australia", "code": "AUS", "confederation": "AFC"},
    {"name": "Qatar", "code": "QAT", "confederation": "AFC"},
    {"name": "Saudi Arabia", "code": "KSA", "confederation": "AFC"},
    {"name": "Jordan", "code": "JOR", "confederation": "AFC"},
    {"name": "Uzbekistan", "code": "UZB", "confederation": "AFC"},
    
    # CAF (África) - 9 clasificados
    {"name": "Morocco", "code": "MAR", "confederation": "CAF"},
    {"name": "Senegal", "code": "SEN", "confederation": "CAF"},
    {"name": "Egypt", "code": "EGY", "confederation": "CAF"},
    {"name": "Algeria", "code": "ALG", "confederation": "CAF"},
    {"name": "Cameroon", "code": "CMR", "confederation": "CAF"},
    {"name": "Mali", "code": "MLI", "confederation": "CAF"},
    {"name": "Ivory Coast", "code": "CIV", "confederation": "CAF"},
    {"name": "Cape Verde", "code": "CPV", "confederation": "CAF"},
    {"name": "Nigeria", "code": "NGA", "confederation": "CAF"},
    
    # CONCACAF - 3 clasificados adicionales (anfitriones aparte)
    {"name": "Panama", "code": "PAN", "confederation": "CONCACAF"},
    {"name": "Haiti", "code": "HAI", "confederation": "CONCACAF"},
    {"name": "Curacao", "code": "CUW", "confederation": "CONCACAF"},
    
    # OFC (Oceanía) - 1 clasificado
    {"name": "New Zealand", "code": "NZL", "confederation": "OFC"},
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/123.0.0.0 Safari/537.36"
}


# --------------------------------------------------
# HELPERS DE WIKIPEDIA
# --------------------------------------------------
def construir_url_wikipedia(nombre_equipo):
    """
    Construye la URL de Wikipedia para el equipo nacional.
    Maneja algunos casos especiales como Estados Unidos, NZ, etc.
    """
    mapeo_especial = {
        "United States": "United_States_men's_national_soccer_team",
        "England": "England_national_football_team",
        "Scotland": "Scotland_national_football_team",
        "Northern Ireland": "Northern_Ireland_national_football_team",
        "Wales": "Wales_national_football_team",
        "South Korea": "South_Korea_national_football_team",
        "Ivory Coast": "Ivory_Coast_national_football_team",
        "Cape Verde": "Cape_Verde_national_football_team",
        "Saudi Arabia": "Saudi_Arabia_national_football_team",
        "New Zealand": "New_Zealand_men's_national_football_team",
    }
    
    if nombre_equipo in mapeo_especial:
        return f"https://en.wikipedia.org/wiki/{mapeo_especial[nombre_equipo]}"
    
    nombre_url = nombre_equipo.replace(" ", "_")
    return f"https://en.wikipedia.org/wiki/{nombre_url}_national_football_team"


# --------------------------------------------------
# API: CREAR EQUIPO
# --------------------------------------------------
def crear_equipo_en_api(team):
    """
    Envía el equipo a tu API /api/teams y devuelve el _id del equipo.
    """
    payload = {
        "name": team["name"],
        "code": team["code"],
        "confederation": team.get("confederation")
    }

    try:
        resp = requests.post(f"{API_BASE}/teams", json=payload, timeout=10)
    except Exception as e:
        print(f"❌ Error conectando a la API para {team['name']}:", e)
        return None

    if resp.status_code not in (200, 201):
        print(f"❌ Error creando equipo {team['name']}: {resp.status_code}")
        try:
            print(f"   Respuesta: {resp.json()}")
        except Exception:
            print(f"   Respuesta: {resp.text[:200]}")
        return None

    try:
        data = resp.json()
    except Exception:
        print(f"❌ No se pudo parsear JSON para {team['name']}")
        return None

    team_id = data.get("_id") or data.get("id")
    if not team_id:
        print(f"❌ La respuesta no trae _id para {team['name']}")
        return None

    print(f"✅ Equipo {team['name']} creado. ID: {team_id}")
    return team_id


# --------------------------------------------------
# NORMALIZAR POSICIONES
# --------------------------------------------------
def normalizar_posicion(pos_texto):
    """
    Normaliza las posiciones a los valores permitidos: GK, DF, MF, FW, Unknown
    """
    pos_texto = pos_texto.upper().strip()
    
    if pos_texto in ["GK", "GOALKEEPER"]:
        return "GK"
    elif pos_texto in ["DF", "DEF", "DEFENDER", "CB", "LB", "RB", "LWB", "RWB"]:
        return "DF"
    elif pos_texto in ["MF", "MID", "MIDFIELDER", "CM", "DM", "AM", "CDM", "CAM"]:
        return "MF"
    elif pos_texto in ["FW", "FOR", "FORWARD", "ST", "CF", "LW", "RW", "ATT", "STRIKER"]:
        return "FW"
    else:
        return "Unknown"


# --------------------------------------------------
# OBTENER FOTO DEL JUGADOR (OPCIONAL)
# --------------------------------------------------
def obtener_foto_jugador(nombre_jugador):
    """
    Busca la foto del jugador en su página de Wikipedia.
    Retorna la URL de la imagen o None si no se encuentra.
    """
    try:
        nombre_url = nombre_jugador.replace(" ", "_")
        url = f"https://en.wikipedia.org/wiki/{nombre_url}"
        
        resp = requests.get(url, headers=HEADERS, timeout=10)
        time.sleep(0.5)  # Pausa breve para no abusar
        
        if resp.status_code != 200:
            return None
        
        soup = BeautifulSoup(resp.text, "html.parser")
        
        # Buscar la imagen en el infobox (caja lateral)
        infobox = soup.find("table", class_="infobox")
        if infobox:
            img = infobox.find("img")
            if img and img.get("src"):
                img_url = img.get("src")
                if img_url.startswith("//"):
                    img_url = "https:" + img_url
                return img_url
        
        # Fallback: primera imagen "decente"
        images = soup.find_all("img")
        for img in images:
            src = img.get("src", "")
            if "upload.wikimedia.org" in src and not any(
                x in src for x in ["icon", "logo", "flag", "20px", "15px"]
            ):
                if src.startswith("//"):
                    src = "https:" + src
                return src
        
        return None
    except Exception:
        return None


# --------------------------------------------------
# SCRAPING DE JUGADORES (CON CURRENT SQUAD)
# --------------------------------------------------
def scrapear_y_guardar_jugadores(team, team_id):
    """
    Entra a la página de la selección en Wikipedia y, si existe,
    usa la sección 'Current squad' para sacar la plantilla actual.
    Si no encuentra esa sección, cae a una tabla genérica de jugadores.
    """
    wiki_url = construir_url_wikipedia(team["name"])
    print(f"   🔍 Scrapeando plantilla de {team['name']} en: {wiki_url}")
    
    try:
        resp = requests.get(wiki_url, headers=HEADERS, timeout=20)
        resp.raise_for_status()
    except Exception as e:
        print(f"   ❌ Error en request a Wikipedia: {e}")
        return 0

    soup = BeautifulSoup(resp.text, "html.parser")

    # 1) Intentar sección "Current squad"
    tabla = None
    span_current = soup.find("span", id="Current_squad")
    if span_current:
        h3_current = span_current.parent  # normalmente <h3>
        tabla = h3_current.find_next("table", class_="wikitable")

    # 2) Fallback genérico si no encontramos "Current squad"
    if tabla is None:
        for t in soup.find_all("table", class_="wikitable"):
            headers = [th.get_text(strip=True).lower() for th in t.find_all("th")]
            header_line = " ".join(headers)
            if ("player" in header_line or "name" in header_line) and "club" in header_line:
                tabla = t
                print("   ℹ️ Usando tabla genérica de jugadores (sin Current squad).")
                break

    if tabla is None:
        print("   ⚠️ No se encontró tabla de jugadores (Current squad ni genérica).")
        return 0

    guardados = 0
    errores = 0
    filas = tabla.find_all("tr")[1:]  # saltar encabezado

    for fila in filas:
        cols = fila.find_all("td")
        if len(cols) < 2:
            continue

        try:
            # Typical current squad table:
            # No. | Pos. | Player | Date of birth | Caps | Goals | Club
            num_raw = cols[0].get_text(strip=True)

            # Posición en la segunda columna (a veces vacío)
            pos_raw = cols[1].get_text(strip=True) if len(cols) > 1 else ""

            # Jugador en la tercera columna
            player_cell = cols[2] if len(cols) > 2 else cols[1]
            link_jugador = player_cell.find("a")
            nombre = (
                link_jugador.get_text(strip=True)
                if link_jugador
                else player_cell.get_text(strip=True)
            )
            nombre = nombre.split("[")[0].strip()

            if not nombre:
                continue

            # Club: normalmente última columna
            club_cell = cols[-1]
            link_club = club_cell.find("a")
            club = (
                link_club.get_text(strip=True)
                if link_club
                else club_cell.get_text(strip=True)
            )
            club = club.split("[")[0].strip()

            pos_norm = normalizar_posicion(pos_raw) if pos_raw else "Unknown"
            foto_url = obtener_foto_jugador(nombre)

            payload_jugador = {
                "name": nombre,
                "position": pos_norm,
                "club": club or "Unknown",
                "teamId": team_id,
                "shirtNumber": num_raw if num_raw else None,
                "photo": foto_url,
            }

            r = requests.post(f"{API_BASE}/players", json=payload_jugador, timeout=10)
            time.sleep(0.2)

            if r.status_code not in (200, 201):
                errores += 1
                if errores <= 3:
                    print(
                        f"      ⚠️ Error guardando {nombre}: "
                        f"{r.status_code} {r.text[:120]}"
                    )
                continue

            guardados += 1
            icon = "📷" if foto_url else "👤"
            if guardados <= 10 or guardados % 5 == 0:
                print(f"      ✓ {icon} {nombre} ({pos_norm}, {club})")

        except Exception as e:
            errores += 1
            if errores <= 3:
                print(f"      ⚠️ Error procesando fila: {e}")
            continue

    print(f"   🎉 {guardados} jugadores guardados para {team['name']}")
    if errores > 3:
        print(f"      ({errores} filas con error)")
    return guardados


# --------------------------------------------------
# MAIN
# --------------------------------------------------
def main():
    print("\n" + "=" * 60)
    print("⚽ MUNDIAL 2026 - SCRAPER DE SELECCIONES Y JUGADORES")
    print("=" * 60 + "\n")
    
    # Verificar conexión con la API (raíz del servidor)
    try:
        base_sin_api = API_BASE.replace("/api", "")
        resp = requests.get(f"{base_sin_api}/", timeout=5)
        if resp.status_code == 200:
            print("✅ Conexión con API establecida\n")
        else:
            print("⚠️ API respondió con código:", resp.status_code, "\n")
    except Exception as e:
        print(f"❌ No se pudo conectar con la API: {e}")
        print("   Asegúrate de que el servidor esté corriendo en puerto 4000\n")
        return
    
    print(f"📋 Total de equipos: {len(EQUIPOS_CLASIFICADOS)}\n")
    
    total_jugadores = 0
    equipos_exitosos = 0
    equipos_con_jugadores = 0

    for i, team in enumerate(EQUIPOS_CLASIFICADOS, 1):
        print("=" * 60)
        print(f"[{i}/{len(EQUIPOS_CLASIFICADOS)}] 🏴 {team['name']} ({team['code']})")
        print("=" * 60)

        team_id = crear_equipo_en_api(team)
        if not team_id:
            print("   ⏭ Saltando jugadores\n")
            continue

        equipos_exitosos += 1
        jugadores_guardados = scrapear_y_guardar_jugadores(team, team_id)
        
        if jugadores_guardados > 0:
            equipos_con_jugadores += 1
            total_jugadores += jugadores_guardados
        
        print()  # Línea en blanco
        if i < len(EQUIPOS_CLASIFICADOS):
            time.sleep(2)

    print("=" * 60)
    print("✅ PROCESO FINALIZADO")
    print("=" * 60)
    print(f"🏆 Equipos creados: {equipos_exitosos}/{len(EQUIPOS_CLASIFICADOS)}")
    print(f"👥 Equipos con jugadores: {equipos_con_jugadores}")
    print(f"⚽ Total de jugadores: {total_jugadores}")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
