# Paper mills en congresos IEEE · Dashboard interactivo

Dashboard web para explorar la venta de autorías en congresos publicados por IEEE y los artículos
identificados a partir de esas ofertas. Reutiliza los datos abiertos del estudio de Abalkina,
Kunešová, Ozturk y Pirelli (2026) y los amplía con afiliaciones y estados de retracción de OpenAlex.

**Ver el dashboard:** https://adelvaz.github.io/paper-mills-ieee-dashboard/

**Autor del dashboard:** Ángel M. Delgado-Vázquez
([ORCID 0000-0003-2461-8553](https://orcid.org/0000-0003-2461-8553)), Biblioteca/CRAI,
Universidad Pablo de Olavide (Sevilla).

## Reconocimiento

Este dashboard no habría sido posible sin el trabajo y la apertura de datos de
**Anna Abalkina, Marie Kunešová, Yagmur Ozturk y Solal Pirelli**, autores del estudio:

> Abalkina, A., Kunešová, M., Ozturk, Y. y Pirelli, S. (2026). Opening Pandora’s box: Paper mills
> in conference proceedings. *Accountability in Research*, 33(8), 2733727.
> https://doi.org/10.1080/08989621.2026.2733727

Las ofertas, los canales, los congresos y las estadísticas de Crossref proceden de su material
suplementario. Este trabajo es independiente y no está avalado por ellos. Las afiliaciones y el
estado de retracción proceden de [OpenAlex](https://openalex.org) (CC0).

En octubre de 2026, IEEE retractó en un solo día al menos 1.417 de los artículos identificados en
ese estudio ([Naddaf, *Nature*, 30/10/2026](https://www.nature.com/articles/d41586-026-03455-8)).

## Qué muestra

| Pestaña | Contenido |
|---|---|
| Resumen | Cifras principales, ofertas y artículos por año, retracciones según OpenAlex, congresos con más artículos identificados |
| Ofertas | Evolución mensual, plazas de autor anunciadas, días entre la oferta y el congreso |
| Congresos | Tabla de los 366 congresos, patrocinadores IEEE, relación con la proporción de artículos de seis autores |
| Artículos | Ofertas y artículos emparejados, con búsqueda, filtros y enlace al DOI |
| Coautoría | Número de coautores frente al conjunto de IEEE; réplica interactiva de la figura 7 del estudio |
| Canales | Canales de venta por plataforma |
| Países y España | Países e instituciones de afiliación (OpenAlex) y revisión manual de las afiliaciones españolas |

## Estructura

```
index.html            Página del dashboard
css/                  Estilos (tema claro y oscuro)
js/dash-shim.js       Carga de datos, cálculos y redibujado
js/*.js               Cálculos, gráficos (D3) e interacción
data/                 Datos derivados (CC BY-NC-SA 4.0)
scripts/              Preparación de los datos (Python)
```

No necesita servidor: basta con servir la carpeta como sitio estático, por ejemplo con
`python3 -m http.server` en la raíz del repositorio, o con GitHub Pages.

## Reproducir los datos

1. Descarga el material suplementario del estudio (carpeta `pandora`).
2. `python3 scripts/1_preparar_datos_estudio.py RUTA/A/pandora`
3. Edita el correo en `scripts/2_descargar_afiliaciones_openalex.py` y ejecútalo
   (genera `scripts/autorias_openalex.csv`, que no se publica porque contiene nombres de autores).
4. `python3 scripts/3_preparar_datos_openalex.py`

## Notas metodológicas

- Las ofertas se cuentan sin las filas marcadas como duplicadas por los autores (4.541 filas,
  frente a las 4.407 que cita el artículo tras una deduplicación más amplia).
- Las retracciones «del estudio» son las de `Conferences.csv` (actualizadas a 29/06/2026). Las de
  OpenAlex corresponden a la consulta de noviembre de 2026. *Nature* contabiliza 1.622 artículos
  retractados de los 2.062 identificados.
- El país de cada autoría es el de la institución en OpenAlex o, si falta, el del autor. Un
  artículo cuenta para todos sus países.
- Aparecer en un artículo identificado no prueba por sí solo que un autor comprara la autoría.
  Por eso el dashboard no publica nombres de autores.

## Licencias

- **Código:** MIT, © 2026 Ángel M. Delgado-Vázquez ([LICENSE](LICENSE)). Incluye D3 (licencia ISC).
- **Datos** (`data/`): CC BY-NC-SA 4.0, como obra derivada de los datos del estudio
  ([data/LICENSE.md](data/LICENSE.md)).

## Cómo citar

Delgado-Vázquez, Á. M. (2026). *Paper mills en congresos IEEE: dashboard interactivo* (versión 1.0.0)
[Software]. https://github.com/adelvaz/paper-mills-ieee-dashboard

Cita también el estudio original del que proceden los datos (ver arriba). GitHub ofrece ambas
referencias desde el botón «Cite this repository» ([CITATION.cff](CITATION.cff)).
