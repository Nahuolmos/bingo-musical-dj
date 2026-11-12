#!/usr/bin/env python3
"""
Descarga carátulas de las 40 canciones del Bingo Musical usando Apple iTunes Search API.

Ubicación esperada:
    /assets/covers/descargar_caratulas.py

Uso desde la raíz del proyecto:
    python assets/covers/descargar_caratulas.py

Las imágenes y el CSV se guardan directamente en la misma carpeta del script
(es decir, assets/covers/), sin crear una subcarpeta adicional.

Requisitos:
    py -m pip install requests

Genera:
    portadas_bingo/01 - Nathy Peluso - Vivir así es morir de amor.jpg
    ...
    portadas_bingo/resultados.csv

Las coincidencias se evalúan por artista y título. Si la coincidencia es dudosa,
se registra en el CSV como "REVISAR" para que no pase inadvertida.
"""

from pathlib import Path
import csv
import re
import time
import unicodedata

import requests

CANCIONES = [
    ("Nathy Peluso", "Vivir así es morir de amor"),
    ("Cacho Castaña", "Ha vuelto el matador"),
    ("Chaqueño Palavecino", "La Ley y la trampa"),
    ("Soda Stereo", "Cuando pase el temblor"),
    ("Luis Miguel", "La Chica del bikini azul"),
    ("Miley Cyrus", "Flowers"),
    ("Ricky Martin", "La Mordidita"),
    ("Celia Cruz", "Rie y Llora"),
    ("Thalia", "Arrasando"),
    ("Jimena Barón", "La Cobra"),
    ("Los Rodríguez", "Salud, Dinero y amor"),
    ("Valeria Lynch", "Que ganas de no verte nunca más"),
    ("Gilda", "No Es Mi Despedida"),
    ("Los Auténticos Decadentes", "Corazón"),
    ("Bandana", "Como puede ser"),
    ("Fey", "Azúcar amargo"),
    ("Los Huayra", "La noche sin ti"),
    ("Los Náufragos", "De boliche en boliche"),
    ("Pimpinela", "Olvídame y pega la vuelta"),
    ("Shakira", "Si te vas"),
    ("Bad Bunny", "El Baile inolvidable"),
    ("La Oreja de Van Gogh", "Rosas"),
    ("Ricky Martin", "Vuelve"),
    ("Yatra y Mau Ricky", "Ya no tiene novio"),
    ("Latin Mafia", "Te estoy correteando"),
    ("Nek", "Laura no está"),
    ("Miranda!", "Perfecta"),
    ("Charly García", "Demoliendo Hoteles"),
    ("Los Huayra", "Eterno amor"),
    ("Los Fabulosos Cadillacs", "Carnaval toda la vida"),
    ("Cristian Castro", "No podrás"),
    ("Britney Spears", "Oops! I Did It Again"),
    ("Christina Aguilera", "Genio atrapado"),
    ("Cruzando el Charco", "Por qué"),
    ("Karol G", "Bby Wow"),
    ("Tan Biónica", "La Melodía de Dios"),
    ("Lali", "Mejor que vos"),
    ("Raffaella Carrà", "Fiesta"),
    ("Reik, Ozuna y Wisin", "Me niego"),
    ("Ricardo Montaner", "Cachita"),
]

API = "https://itunes.apple.com/search"
# Guarda las carátulas junto a este archivo: /assets/covers/
CARPETA = Path(__file__).resolve().parent
PAIS = "AR"
TAMANO = "600"  # Apple suele ofrecer carátulas cuadradas; se solicita una versión grande.
UMBRAL_REVISION = 0.58
UMBRAL_ACEPTAR = 0.76


def normalizar(texto):
    texto = unicodedata.normalize("NFKD", texto or "")
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    texto = texto.lower()
    texto = re.sub(r"[^a-z0-9]+", " ", texto)
    return " ".join(texto.split())


def similitud(a, b):
    """Similitud simple por coincidencia de palabras, robusta ante acentos."""
    aa, bb = normalizar(a), normalizar(b)
    if not aa or not bb:
        return 0.0
    from difflib import SequenceMatcher
    secuencia = SequenceMatcher(None, aa, bb).ratio()
    ta, tb = set(aa.split()), set(bb.split())
    jaccard = len(ta & tb) / len(ta | tb) if ta | tb else 0.0
    return 0.65 * secuencia + 0.35 * jaccard


def puntuar(cancion, resultado):
    artista, titulo = cancion
    titulo_api = resultado.get("trackName", "")
    artista_api = resultado.get("artistName", "")
    album_api = resultado.get("collectionName", "")

    score_titulo = similitud(titulo, titulo_api)
    # En colaboraciones, iTunes puede listar solo al artista principal.
    artistas = [x.strip() for x in re.split(r",| y | & | feat\.? | ft\.? ", artista, flags=re.I)]
    score_artista = max([similitud(x, artista_api) for x in artistas] or [0.0])
    if score_artista < 0.35:
        score_artista = max(score_artista, similitud(artista, album_api) * 0.65)
    return 0.68 * score_titulo + 0.32 * score_artista


def url_grande(url):
    # La API devuelve normalmente artworkUrl100; Apple permite pedir tamaños mayores
    # reemplazando el segmento de tamaño de la URL.
    return re.sub(r"/\d+x\d+bb\.", f"/{TAMANO}x{TAMANO}bb.", url)


def buscar(artista, titulo, session):
    terminos = [
        f"{artista} {titulo}",
        titulo,
    ]
    resultados_unicos = {}
    for termino in terminos:
        params = {
            "term": termino,
            "country": PAIS,
            "media": "music",
            "entity": "song",
            "limit": 30,
        }
        response = session.get(API, params=params, timeout=25)
        response.raise_for_status()
        for item in response.json().get("results", []):
            if item.get("artworkUrl100") and item.get("trackName"):
                key = (item.get("trackId"), item.get("collectionId"))
                resultados_unicos[key] = item
        time.sleep(0.25)

    candidatos = list(resultados_unicos.values())
    if not candidatos:
        return None, 0.0

    candidatos.sort(key=lambda r: puntuar((artista, titulo), r), reverse=True)
    mejor = candidatos[0]
    return mejor, puntuar((artista, titulo), mejor)


def nombre_archivo(numero, artista, titulo):
    base = f"{numero:02d} - {artista} - {titulo}"
    base = re.sub(r'[<>:"/\\\\|?*]', "-", base)
    return base[:180] + ".jpg"


def main():
    CARPETA.mkdir(exist_ok=True)
    session = requests.Session()
    session.headers.update({"User-Agent": "BingoMusicalArtworkDownloader/1.0"})
    filas = []

    for numero, (artista, titulo) in enumerate(CANCIONES, start=1):
        print(f"[{numero:02d}/40] Buscando: {artista} - {titulo}")
        try:
            resultado, score = buscar(artista, titulo, session)
            if not resultado:
                print("    No se encontró una portada.")
                filas.append([numero, artista, titulo, "", "", "", "NO ENCONTRADA", ""])
                continue

            imagen_url = url_grande(resultado["artworkUrl100"])
            nombre = nombre_archivo(numero, artista, titulo)
            destino = CARPETA / nombre

            descarga = session.get(imagen_url, timeout=30)
            descarga.raise_for_status()
            content_type = descarga.headers.get("Content-Type", "")
            if not content_type.startswith("image/"):
                raise ValueError(f"El servidor no devolvió una imagen ({content_type}).")
            destino.write_bytes(descarga.content)

            estado = "OK" if score >= UMBRAL_ACEPTAR else (
                "REVISAR" if score >= UMBRAL_REVISION else "POSIBLE ERROR"
            )
            print(f"    {estado} | {resultado.get('artistName')} - "
                  f"{resultado.get('trackName')} | puntaje {score:.2f}")
            print(f"    {imagen_url}")

            filas.append([
                numero, artista, titulo,
                resultado.get("artistName", ""),
                resultado.get("trackName", ""),
                resultado.get("collectionName", ""),
                estado, imagen_url
            ])
        except Exception as exc:
            print(f"    ERROR: {exc}")
            filas.append([numero, artista, titulo, "", "", "", "ERROR", str(exc)])

    csv_path = CARPETA / "resultados.csv"
    with csv_path.open("w", newline="", encoding="utf-8-sig") as archivo:
        writer = csv.writer(archivo)
        writer.writerow([
            "N°", "Artista solicitado", "Canción solicitada",
            "Artista encontrado", "Canción encontrada", "Álbum",
            "Estado", "URL directa de carátula"
        ])
        writer.writerows(filas)

    ok = sum(1 for fila in filas if fila[6] == "OK")
    revisar = sum(1 for fila in filas if fila[6] in ("REVISAR", "POSIBLE ERROR"))
    print("\nProceso terminado.")
    print(f"Portadas descargadas: {sum(1 for f in filas if f[7].startswith('http'))}/40")
    print(f"Coincidencias sólidas: {ok} | Para revisar: {revisar}")
    print(f"Carpeta: {CARPETA.resolve()}")
    print(f"Informe: {csv_path.resolve()}")


if __name__ == "__main__":
    main()
