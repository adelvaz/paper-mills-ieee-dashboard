#!/usr/bin/env python3
"""
Paso 3. Convierte autorias_openalex.csv (paso 2) en los ficheros del dashboard:
data/oa_autorias.json, data/oa_articulos.json y data/oa_espana.json.

Los nombres de los autores no se publican. Las afiliaciones españolas se
revisaron a mano frente a la afiliación literal; los falsos positivos
detectados se declaran en FALSOS_POSITIVOS.
"""
from pathlib import Path

import pandas as pd

BASE = Path(__file__).resolve().parent
OUT = BASE.parent / "data"

# (DOI, institución asignada por OpenAlex) que la revisión manual descarta
FALSOS_POSITIVOS = {
    ("10.1109/ic3i56241.2022.10073261", "Spanish Ovarian Cancer Research Group"),  # afiliación literal: «GEICO, USA»
}

d = pd.read_csv(BASE / "autorias_openalex.csv", dtype=str)
d["pais"] = d.pais_institucion.fillna(d.paises_autor.str.split(";").str[0])
d["retractado"] = d.retractado_openalex == "True"
x = d.doi.str.extract(r"^(10\.1109/([a-z0-9-]+?)\d{5}\.(\d{4}))\.\d+$")
d["congreso_doi"] = x[0]
d["congreso"] = (x[1].str.upper() + " " + x[2]).where(x[0].notna())
es_falso = pd.Series([(a, b) in FALSOS_POSITIVOS for a, b in zip(d.doi, d.institucion)], index=d.index)
d["es_valido"] = (d.pais == "ES") & ~es_falso
d["autor_key"] = d.autor_openalex.fillna(pd.Series("sinid_" + d.index.astype(str), index=d.index))
d["autor_n"] = d.groupby("doi").autor_key.transform(lambda s: pd.factorize(s)[0] + 1)

aut = d[["conjunto", "doi", "congreso", "anio", "retractado", "autor_n", "posicion", "institucion", "ror", "pais"]].copy()
aut.insert(0, "id", range(1, len(aut) + 1))
aut.to_json(OUT / "oa_autorias.json", orient="records", force_ascii=False)

g = d.groupby("doi")
art = pd.DataFrame({
    "conjunto": g.conjunto.first(), "titulo": g.titulo.first(), "anio": g.anio.first(), "congreso": g.congreso.first(),
    "congreso_doi": g.congreso_doi.first(), "retractado": g.retractado.first(), "n_autores": g.autor_n.max(),
    "n_instituciones": g.institucion.nunique(), "n_paises": g.pais.nunique(),
    "paises": g.pais.apply(lambda s: ";".join(sorted(s.dropna().unique()))), "espana": g.es_valido.any(),
}).reset_index()
art.to_json(OUT / "oa_articulos.json", orient="records", force_ascii=False)

es = d[d.pais == "ES"].copy()
es["revision"] = ["Falso positivo: la afiliación literal es «GEICO, USA», no el grupo español" if f
                  else "Afiliación española declarada en el artículo" for f in es_falso[es.index]]
es = es[["doi", "titulo", "congreso", "anio", "retractado", "posicion", "institucion", "ror", "afiliacion_literal", "revision"]].drop_duplicates()
es.insert(0, "id", range(1, len(es) + 1))
es.to_json(OUT / "oa_espana.json", orient="records", force_ascii=False)
print(f"{len(art)} artículos, {len(aut)} autorías, {len(es)} autorías españolas")
