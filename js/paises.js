dash.calc('oa_kpis', {
  inputs: ['oa_articulos', 'oa_autorias'],
  title: 'Cifras de OpenAlex',
  description: 'Artículos IEEE identificados encontrados en OpenAlex: retractados, países, instituciones y presencia española.',
  fn: (oa_articulos, oa_autorias) => {
    const a = oa_articulos.filter((r) => r.conjunto === 'IEEE');
    const conPais = a.filter((r) => r.n_paises > 0);
    const au = oa_autorias.filter((r) => r.conjunto === 'IEEE');
    const ret = a.filter((r) => r.retractado === true).length;
    return [{
      articulos: a.length,
      retractados: ret,
      pct_retractados: ret / a.length,
      paises: new Set(au.map((r) => r.pais).filter(Boolean)).size,
      instituciones: new Set(au.map((r) => r.ror || r.institucion).filter(Boolean)).size,
      pct_varios_paises: conPais.filter((r) => r.n_paises >= 2).length / conPais.length,
      articulos_espana: a.filter((r) => r.espana === true).length,
    }];
  },
});

dash.calc('oa_retiradas_anio', {
  inputs: ['oa_articulos'],
  title: 'Retractados por año',
  description: 'Artículos IEEE identificados por año de publicación, retractados o no según OpenAlex.',
  fn: (oa_articulos) => {
    const by = {};
    for (const r of oa_articulos) {
      if (r.conjunto !== 'IEEE' || !r.anio) continue;
      const o = (by[r.anio] ??= {anio: String(r.anio), retractados: 0, vigentes: 0});
      if (r.retractado === true) o.retractados++; else o.vigentes++;
    }
    return Object.values(by).sort((x, y) => x.anio.localeCompare(y.anio));
  },
});

dash.calc('oa_paises', {
  inputs: ['oa_articulos', 'oa_autorias'],
  title: 'Artículos por país',
  description: 'Artículos IEEE identificados con al menos una afiliación de cada país (país de la institución, o del autor si falta), autorías y retractados.',
  fn: (oa_articulos, oa_autorias) => {
    const total = oa_articulos.filter((r) => r.conjunto === 'IEEE').length;
    const ret = new Set(oa_articulos.filter((r) => r.conjunto === 'IEEE' && r.retractado === true).map((r) => r.doi));
    const by = {};
    for (const r of oa_autorias) {
      if (r.conjunto !== 'IEEE' || !r.pais) continue;
      const o = (by[r.pais] ??= {pais: r.pais, dois: new Set(), autorias: new Set()});
      o.dois.add(r.doi);
      o.autorias.add(r.doi + '|' + r.autor_n);
    }
    return Object.values(by).map((o) => ({
      pais: o.pais, articulos: o.dois.size, pct_articulos: o.dois.size / total, autorias: o.autorias.size,
      retractados: [...o.dois].filter((d) => ret.has(d)).length,
    })).sort((x, y) => y.articulos - x.articulos);
  },
});

dash.calc('oa_europa', {
  inputs: ['oa_paises'],
  title: 'Países europeos',
  description: 'Los países europeos de la tabla de artículos por país.',
  fn: (oa_paises) => {
    const europa = ['AL', 'AD', 'AT', 'BY', 'BE', 'BA', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IS', 'IE', 'IT', 'XK', 'LV', 'LI', 'LT', 'LU', 'MT', 'MD', 'MC', 'ME', 'NL', 'MK', 'NO', 'PL', 'PT', 'RO', 'RU', 'SM', 'RS', 'SK', 'SI', 'ES', 'SE', 'CH', 'UA', 'GB'];
    return oa_paises.filter((r) => europa.includes(r.pais));
  },
});

dash.calc('oa_instituciones', {
  inputs: ['oa_autorias'],
  title: 'Instituciones más frecuentes',
  description: 'Las 30 instituciones con más artículos IEEE identificados (agrupadas por ROR o, si falta, por nombre).',
  fn: (oa_autorias) => {
    const by = {};
    for (const r of oa_autorias) {
      if (r.conjunto !== 'IEEE' || !r.institucion) continue;
      const k = r.ror || r.institucion;
      const o = (by[k] ??= {institucion: r.institucion, pais: r.pais, dois: new Set(), autorias: new Set()});
      o.dois.add(r.doi);
      o.autorias.add(r.doi + '|' + r.autor_n);
    }
    return Object.values(by).map((o) => ({institucion: o.institucion, pais: o.pais, articulos: o.dois.size, autorias: o.autorias.size}))
      .sort((x, y) => y.articulos - x.articulos).slice(0, 30);
  },
});

(() => {
  const P = window.PM;
  let names = null;
  try { names = new Intl.DisplayNames(['es'], {type: 'region'}); } catch (e) { names = null; }
  const pn = (c) => { try { return (names && c && names.of(c)) || c || ''; } catch (e) { return c || ''; } };
  window.PMpais = pn;

  for (const name of ['oak']) {
    dash.draw(name, (el) => {
      const r = P.rows('oa_kpis');
      if (!r || !r[0]) return P.empty(el, 'oa_kpis', true);
      const v = r[0][el.dataset.field];
      el.textContent = v == null ? '—' : (el.dataset.fmt === 'pct' ? P.pct : P.int)(v);
    });
  }

  dash.draw('ch-retiradas', (el) => {
    const r = P.rows('oa_retiradas_anio');
    if (!r) return P.empty(el, 'oa_retiradas_anio');
    P.vbars(el, {data: r, x: 'anio', stacked: true,
      series: [{key: 'retractados', name: 'Retractados', color: P.cssVar(el, '--cds-chart-status-critical')}, {key: 'vigentes', name: 'Sin retractar', color: P.cssVar(el, '--cds-chart-muted')}]});
  });

  dash.draw('ch-paises', (el) => {
    const r = P.rows('oa_paises');
    if (!r) return P.empty(el, 'oa_paises');
    const top = r.slice(0, 20).map((d) => ({...d, nombre: pn(d.pais)}));
    P.hbars(el, {data: top, label: 'nombre', fmt: P.pct, series: [{key: 'pct_articulos', name: '% de los artículos', color: P.color(0), fmt: P.pct}],
      tipExtra: (d) => [[null, 'Artículos', P.int(d.articulos)], [null, 'Autorías', P.int(d.autorias)], [null, 'Retractados', P.int(d.retractados)]]});
  });

  dash.draw('ch-europa', (el) => {
    const r = P.rows('oa_europa');
    if (!r) return P.empty(el, 'oa_europa');
    const data = r.map((d) => ({...d, nombre: pn(d.pais)}));
    const es = P.color(1), base = P.color(0);
    P.hbars(el, {data, label: 'nombre', series: [{key: 'articulos', name: 'Artículos', color: base}],
      tipExtra: (d) => [[null, 'Autorías', P.int(d.autorias)], [null, 'Retractados', P.int(d.retractados)]]});
    d3.select(el).selectAll('g.r').each(function (d) { if (d.pais === 'ES') d3.select(this).select('rect').attr('fill', es); });
  });

  dash.draw('tb-paises', (tb) => {
    const r = P.rows('oa_paises');
    if (!r) { tb.replaceChildren(); return; }
    P.table(tb, {rows: r, key: 'pais', cols: [{key: 'pais', fmt: (v) => pn(v)}, {key: 'articulos', num: true, fmt: P.int}, {key: 'pct_articulos', num: true, fmt: P.pct}, {key: 'autorias', num: true, fmt: P.int, cls: 'opt'}, {key: 'retractados', num: true, fmt: P.int}]});
  });

  dash.draw('tb-inst', (tb) => {
    const r = P.rows('oa_instituciones');
    if (!r) { tb.replaceChildren(); return; }
    P.table(tb, {rows: r, key: 'institucion', cols: [{key: 'institucion'}, {key: 'pais', fmt: (v) => pn(v), cls: 'opt'}, {key: 'articulos', num: true, fmt: P.int}, {key: 'autorias', num: true, fmt: P.int, cls: 'opt'}]});
  });

  dash.draw('tb-es', (tb) => {
    const r = P.rows('espana');
    if (!r) { tb.replaceChildren(); return; }
    const pos = {first: 'Primera', middle: 'Intermedia', last: 'Última'};
    P.table(tb, {rows: r, key: 'id', cols: [
      {key: 'congreso'}, {key: 'titulo', link: (d) => 'https://doi.org/' + d.doi}, {key: 'institucion'}, {key: 'posicion', fmt: (v) => pos[v] || v, cls: 'opt'},
      {key: 'retractado', fmt: (v) => (v ? 'Sí' : 'No')}, {key: 'afiliacion_literal', cls: 'opt'}, {key: 'revision'}]});
  });
})();
