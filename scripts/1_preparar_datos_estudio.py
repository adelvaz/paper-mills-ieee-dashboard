#!/usr/bin/env python3
"""
Paso 1. Prepara los ficheros del dashboard a partir de los datos publicados por
Abalkina, Kunešová, Ozturk y Pirelli (2026) como material suplementario de
https://doi.org/10.1080/08989621.2026.2733727 (licencia CC BY-NC-SA 4.0).

Uso:
    python3 scripts/1_preparar_datos_estudio.py RUTA/A/pandora

Genera en data/: ofertas_ieee.json, congresos_identificados.json,
ieee_congresos_crossref.json, canales.json, y en scripts/: dois_ieee.txt y
dois_otros_editores.txt (entrada del paso 2).
"""
import re
import sys
from pathlib import Path

import pandas as pd

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else "pandora")
OUT = Path(__file__).resolve().parent.parent / "data"
SCRIPTS = Path(__file__).resolve().parent
OUT.mkdir(exist_ok=True)


def leer(nombre):
    return pd.read_csv(SRC / nombre, encoding="utf-8-sig")


def acronimo(prefijo):
    m = re.match(r"10\.\d+/(.+?)(\d{5})\.(\d{4})$", str(prefijo), re.I)
    return f"{m.group(1).upper()} {m.group(3)}" if m else str(prefijo)


I, C, Ch = leer("IEEE.csv"), leer("Conferences.csv"), leer("Channels.csv")
S = leer("Scripts/crossref_number_of_authors/IEEE_conference_stats_2010-2026_downloaded2026-02-28_with-identified-and-tortured-papers.csv")

# --- Ofertas únicas (sin las filas marcadas como duplicadas) ---
o = I[I["Dupe of N"].isna()].copy()
o["fecha_oferta"] = pd.to_datetime(o["Offer date"], errors="coerce").dt.strftime("%Y-%m-%d")
o["estado"] = o["Match status"].fillna("sin emparejar")
o["doi"] = o["Matched DOI"].str.strip().str.lower()
o["congreso_doi"] = o["doi"].str.extract(r"^(10\.\d+/[^.]+\.\d{4})")[0]
o["congreso"] = o["congreso_doi"].map(lambda x: acronimo(x) if isinstance(x, str) else None)
o["fecha_congreso"] = pd.to_datetime(o["Crossref: Matched conference date"], errors="coerce").dt.strftime("%Y-%m-%d")
o["plazas_oferta"] = o["Offer coauthor count (if known)"].astype("string")
o["coautores_publicado"] = pd.to_numeric(o["Crossref: Matched coauthor count"], errors="coerce").astype("Int64")
o["levenshtein"] = pd.to_numeric(o["Computed: Levenshtein distance between offered and matched title"], errors="coerce")
o["sbert"] = pd.to_numeric(o["Computed: Sentence-BERT cosine similarity between offered and matched title"], errors="coerce").round(3)
o["otro_editor_original"] = o["Offer not originally IEEE?"].notna()
o = o.rename(columns={"N": "n", "Offer title": "titulo_oferta", "Crossref: Matched title": "titulo_publicado", "Matched URL if no DOI": "url_sin_doi"})
cols = ["n", "fecha_oferta", "titulo_oferta", "plazas_oferta", "estado", "doi", "url_sin_doi", "congreso", "congreso_doi",
        "fecha_congreso", "titulo_publicado", "coautores_publicado", "levenshtein", "sbert", "otro_editor_original"]
o[cols].to_json(OUT / "ofertas_ieee.json", orient="records", force_ascii=False)

# --- Congresos con artículos identificados ---
c = C.copy()
c["congreso_doi"] = c["Conference"].str.strip().str.lower()
c["congreso"] = c["Conference"].map(acronimo)
c["identificados"] = pd.to_numeric(c["# identified"], errors="coerce").fillna(0).astype(int)
c["retractados"] = pd.to_numeric(c["# identified & retracted"], errors="coerce").astype("Int64")
c["dias_aceptacion"] = pd.to_numeric(c["Submission to acceptance time (days)"], errors="coerce")
c["patrocinador_principal"] = c["IEEE sponsor(s)"].map(lambda s: re.split(r"[;\n]", s)[0].strip() if isinstance(s, str) else None)
c = c.rename(columns={"IEEE sponsor(s)": "patrocinadores_ieee", "City/state": "ciudad", "Country": "pais",
                      "In PPS?": "pps", "Representative thread on PubPeer": "pubpeer"})
s = S.copy()
s["congreso_doi"] = s["conference's DOI prefix"].str.lower()
s = s.drop_duplicates("congreso_doi")
s["total_articulos"] = pd.to_numeric(s["total papers with authors (not counting retr. notices and EoCs)"], errors="coerce")
s["pct_seis_autores"] = pd.to_numeric(s["6 authors [%]"].astype(str).str.rstrip("%"), errors="coerce")
s["titulo_congreso"] = s["conference title"]
s["fecha_inicio"] = pd.to_datetime(s["conference start date"], errors="coerce").dt.strftime("%Y-%m-%d")
c = c.merge(s[["congreso_doi", "total_articulos", "pct_seis_autores", "titulo_congreso", "fecha_inicio"]], on="congreso_doi", how="left")
c["pct_identificados"] = (c.identificados / c.total_articulos * 100).round(1)
c["anio"] = c["congreso"].str[-4:]
cc = ["congreso", "congreso_doi", "titulo_congreso", "anio", "fecha_inicio", "identificados", "retractados", "total_articulos",
      "pct_identificados", "pct_seis_autores", "pais", "ciudad", "patrocinador_principal", "patrocinadores_ieee", "dias_aceptacion", "pps", "pubpeer"]
c[c.identificados > 0][cc].to_json(OUT / "congresos_identificados.json", orient="records", force_ascii=False)

# --- Todos los congresos IEEE (Crossref) de 50 o más artículos, 2010-2025 ---
a = S.copy()
a["total"] = pd.to_numeric(a["total papers with authors (not counting retr. notices and EoCs)"], errors="coerce")
a["fecha"] = pd.to_datetime(a["conference start date"], errors="coerce")
dup = "duplicate DOI? (most of them are due to 2 pre-2020 conferences having the same acronym)"
a = a[(a.total >= 50) & (a.fecha.dt.year.between(2010, 2025)) & (a[dup] != True)]
res = pd.DataFrame({"congreso": a["conference's DOI prefix"].map(acronimo), "fecha_inicio": a.fecha.dt.strftime("%Y-%m-%d"),
                    "anio": a.fecha.dt.year, "total": a.total.astype(int)})
for k, col in [("a1", "1 author"), ("a2", "2 authors"), ("a3", "3 authors"), ("a4", "4 authors"), ("a5", "5 authors"),
               ("a6", "6 authors"), ("a7", "7 authors"), ("a8", "8 authors"), ("a9", "9 authors"), ("a10", "10 authors"),
               ("a11mas", "more than 10 authors")]:
    res[k] = pd.to_numeric(a[col], errors="coerce").fillna(0).astype(int)
res["identificados"] = pd.to_numeric(a["identified offers"], errors="coerce").fillna(0).astype(int)
res["tortured"] = pd.to_numeric(a["papers with tortured phrases"], errors="coerce").fillna(0).astype(int)
res.to_json(OUT / "ieee_congresos_crossref.json", orient="records", force_ascii=False)

# --- Canales ---
h = Ch.copy()
h.columns = ["nombre", "plataforma", "tipo", "activo", "seguidores", "observaciones"]


def plataforma(p):
    p = str(p).lower()
    for clave, nombre in [("telegram", "Telegram"), ("telemetrio", "Telegram"), ("whatsapp", "WhatsApp"), ("facebook", "Facebook"),
                          ("linkedin", "LinkedIn"), ("instagram", "Instagram"), ("twitter", "X / Twitter"), ("youtube", "YouTube"), ("website", "Web")]:
        if clave in p:
            return nombre
    return "Otras"


def actividad(a):
    a = str(a).lower()
    if a == "nan":
        return "sin dato"
    if a.startswith("active") or a.startswith("semi"):
        return "activo"
    if "dead" in a or "empty" in a:
        return "enlace roto"
    return "inactivo"


h["plataforma_grupo"] = h.plataforma.map(plataforma)
h["estado_actividad"] = h.activo.map(actividad)
h["seguidores"] = pd.to_numeric(h.seguidores.astype(str).str.replace(r"[^\d.]", "", regex=True), errors="coerce")
h.insert(0, "id", range(1, len(h) + 1))
h.to_json(OUT / "canales.json", orient="records", force_ascii=False)

# --- Listas de DOI para el paso 2 ---
M = leer("IEEE-MatchesOnly.csv")
M["Matched DOI"].dropna().str.strip().str.lower().drop_duplicates().to_csv(SCRIPTS / "dois_ieee.txt", index=False, header=False)
OM = leer("OtherPublishers-MatchesOnly.csv")
OM["Matched DOI"].dropna().str.strip().str.lower().drop_duplicates().to_csv(SCRIPTS / "dois_otros_editores.txt", index=False, header=False)
print("Datos del estudio preparados en", OUT)
