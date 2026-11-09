#!/usr/bin/env python3
"""
Descarga de OpenAlex las autorías y afiliaciones de los artículos identificados
en Abalkina et al. (2026). Solo usa la biblioteca estándar de Python.

Uso (en Terminal, dentro de la carpeta analisis_espana):
    python3 descargar_afiliaciones_openalex.py

Genera:
    autorias_openalex.csv   -> una fila por autor x institución
    no_encontrados.txt      -> DOI que OpenAlex no devuelve
"""
import csv, json, subprocess, time, urllib.parse, urllib.request
from pathlib import Path

MAILTO = "tu-correo@ejemplo.org"   # pon aquí tu correo (pool "polite" de OpenAlex)
LOTE = 50
BASE = Path(__file__).parent

def leer(f):
    p = BASE / f
    return [l.strip() for l in p.read_text().splitlines() if l.strip()] if p.exists() else []

conjuntos = {"IEEE": leer("dois_ieee.txt"), "Otros": leer("dois_otros_editores.txt")}

def pedir(dois):
    filtro = "doi:" + "|".join(dois)
    q = urllib.parse.urlencode({"filter": filtro, "per_page": 100, "mailto": MAILTO,
          "select": "doi,title,publication_year,authorships,primary_location,is_retracted"})
    url = "https://api.openalex.org/works?" + q
    for intento in range(5):
        try:
            # curl usa los certificados del sistema (evita el error SSL del Python de python.org)
            out = subprocess.run(["curl", "-sS", "--fail", "-m", "60", url], capture_output=True, text=True, check=True).stdout
            return json.loads(out)["results"]
        except Exception as e:
            msg = getattr(e, "stderr", "") or e
            print("  reintento", intento + 1, msg); time.sleep(3 * (intento + 1))
    print("  LOTE FALLIDO tras 5 intentos")
    return []

filas, encontrados, todos = [], set(), set()
for origen, dois in conjuntos.items():
    todos |= set(dois)
    for i in range(0, len(dois), LOTE):
        lote = dois[i:i + LOTE]
        print(f"{origen}: {i + len(lote)}/{len(dois)}")
        for w in pedir(lote):
            doi = (w.get("doi") or "").replace("https://doi.org/", "").lower()
            encontrados.add(doi)
            fuente = ((w.get("primary_location") or {}).get("source") or {}).get("display_name")
            for a in w.get("authorships", []):
                au = a.get("author") or {}
                insts = a.get("institutions") or [{}]
                for ins in insts:
                    filas.append({
                        "conjunto": origen, "doi": doi, "titulo": w.get("title"),
                        "anio": w.get("publication_year"), "fuente": fuente,
                        "retractado_openalex": w.get("is_retracted"),
                        "posicion": a.get("author_position"),
                        "autor": au.get("display_name"), "autor_openalex": au.get("id"),
                        "orcid": au.get("orcid"),
                        "institucion": ins.get("display_name"), "ror": ins.get("ror"),
                        "pais_institucion": ins.get("country_code"),
                        "paises_autor": ";".join(a.get("countries") or []),
                        "afiliacion_literal": " | ".join(a.get("raw_affiliation_strings") or []),
                    })
        time.sleep(0.2)

with open(BASE / "autorias_openalex.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(filas[0].keys())); w.writeheader(); w.writerows(filas)
(BASE / "no_encontrados.txt").write_text("\n".join(sorted(todos - encontrados)))
print(f"\nListo: {len(encontrados)} artículos, {len(filas)} filas. No encontrados: {len(todos - encontrados)}")
