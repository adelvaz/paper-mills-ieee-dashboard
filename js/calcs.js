dash.calc('kpis', {
  inputs: ['ofertas', 'congresos', 'canales'],
  title: 'Cifras principales',
  description: 'Recuentos de ofertas, artículos únicos (DOI o URL), congresos, retractados y audiencia de los canales.',
  fn: (ofertas, congresos, canales) => {
    const m = ofertas.filter((o) => o.estado !== 'sin emparejar');
    const key = (o) => o.doi || o.url_sin_doi;
    const arts = new Set(m.map(key));
    return [{
      ofertas_unicas: ofertas.length,
      ofertas_emparejadas: m.length,
      pct_ofertas_emparejadas: m.length / ofertas.length,
      articulos: arts.size,
      articulos_definitely: new Set(m.filter((o) => o.estado === 'definitely').map(key)).size,
      articulos_probably: new Set(m.filter((o) => o.estado === 'probably').map(key)).size,
      pct_titulo_identico: m.filter((o) => Number(o.levenshtein) === 0).length / m.length,
      congresos: congresos.length,
      retractados: congresos.reduce((s, c) => s + (Number(c.retractados) || 0), 0),
      canales: canales.length,
      audiencia: canales.reduce((s, c) => s + (Number(c.seguidores) || 0), 0),
    }];
  },
});

dash.calc('por_anio', {
  inputs: ['ofertas'],
  title: 'Ofertas y artículos por año',
  description: 'Ofertas por año de publicación de la oferta y artículos únicos por año del congreso.',
  fn: (ofertas) => {
    const by = {};
    const get = (y) => (by[y] ??= {anio: y, ofertas: 0, arts: new Set()});
    for (const o of ofertas) if (o.fecha_oferta) get(o.fecha_oferta.slice(0, 4)).ofertas++;
    for (const o of ofertas) if (o.estado !== 'sin emparejar' && o.fecha_congreso) get(o.fecha_congreso.slice(0, 4)).arts.add(o.doi || o.url_sin_doi);
    return Object.values(by).sort((a, b) => a.anio.localeCompare(b.anio)).map((r) => ({anio: r.anio, ofertas: r.ofertas, articulos: r.arts.size}));
  },
});

dash.calc('ofertas_mes', {
  inputs: ['ofertas'],
  title: 'Ofertas por mes',
  description: 'Ofertas únicas por mes de publicación, separadas según tengan o no artículo identificado.',
  fn: (ofertas) => {
    const by = {};
    for (const o of ofertas) {
      if (!o.fecha_oferta) continue;
      const k = o.fecha_oferta.slice(0, 7);
      const r = (by[k] ??= {mes: k, emparejadas: 0, sin_emparejar: 0});
      if (o.estado === 'sin emparejar') r.sin_emparejar++; else r.emparejadas++;
    }
    return Object.values(by).sort((a, b) => a.mes.localeCompare(b.mes));
  },
});

dash.calc('plazas', {
  inputs: ['ofertas'],
  title: 'Plazas de autor ofrecidas',
  description: 'Número de plazas de coautoría anunciadas en cada oferta (las 10 categorías más frecuentes).',
  fn: (ofertas) => {
    const by = {};
    for (const o of ofertas) { const k = o.plazas_oferta || 'sin dato'; by[k] = (by[k] || 0) + 1; }
    return Object.entries(by).map(([plazas, n]) => ({plazas, ofertas: n})).sort((a, b) => b.ofertas - a.ofertas).slice(0, 10);
  },
});

dash.calc('desfase', {
  inputs: ['ofertas'],
  title: 'Días entre oferta y congreso',
  description: 'Ofertas emparejadas por tramos de 30 días entre la fecha de la oferta y la del congreso.',
  fn: (ofertas) => {
    const by = {};
    for (const o of ofertas) {
      if (o.estado === 'sin emparejar' || !o.fecha_oferta || !o.fecha_congreso) continue;
      const d = (new Date(o.fecha_congreso) - new Date(o.fecha_oferta)) / 864e5;
      const b = Math.floor(d / 30) * 30;
      by[b] = (by[b] || 0) + 1;
    }
    return Object.entries(by).map(([b, n]) => ({desde: Number(b), tramo: `${b} a ${Number(b) + 29}`, ofertas: n})).sort((a, b) => a.desde - b.desde);
  },
});

dash.calc('desfase_resumen', {
  inputs: ['ofertas'],
  title: 'Desfase oferta-congreso',
  description: 'Mediana y cuartiles de días entre la oferta y el congreso, y ofertas publicadas después del congreso.',
  fn: (ofertas) => {
    const d = ofertas.filter((o) => o.estado !== 'sin emparejar' && o.fecha_oferta && o.fecha_congreso)
      .map((o) => (new Date(o.fecha_congreso) - new Date(o.fecha_oferta)) / 864e5).sort((a, b) => a - b);
    const q = (p) => { const i = (d.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return d[lo] + (d[hi] - d[lo]) * (i - lo); };
    return [{mediana: q(0.5), p25: q(0.25), p75: q(0.75), posteriores: d.filter((x) => x < 0).length}];
  },
});

dash.calc('patrocinadores', {
  inputs: ['congresos'],
  title: 'Patrocinadores IEEE',
  description: 'Congresos y artículos identificados por cada patrocinador IEEE listado (un congreso cuenta para todos sus patrocinadores).',
  fn: (congresos) => {
    const by = {};
    for (const c of congresos) {
      const list = String(c.patrocinadores_ieee || '').split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
      for (const p of new Set(list)) {
        const r = (by[p] ??= {patrocinador: p, congresos: 0, identificados: 0});
        r.congresos++;
        r.identificados += Number(c.identificados) || 0;
      }
    }
    return Object.values(by).sort((a, b) => b.identificados - a.identificados).slice(0, 15);
  },
});

dash.calc('dist_autores', {
  inputs: ['ofertas', 'ieee'],
  title: 'Número de coautores',
  description: 'Distribución del número de coautores en los artículos identificados y en todos los congresos IEEE de 50 o más artículos (2010-2025).',
  fn: (ofertas, ieee) => {
    const keys = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10', 'a11mas'];
    const labels = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11+'];
    const seen = new Map();
    for (const o of ofertas) if (o.estado !== 'sin emparejar' && Number(o.coautores_publicado) > 0) seen.set(o.doi || o.url_sin_doi, Number(o.coautores_publicado));
    const ci = keys.map(() => 0);
    for (const n of seen.values()) ci[Math.min(n, 11) - 1]++;
    const ce = keys.map((k) => ieee.reduce((s, r) => s + (Number(r[k]) || 0), 0));
    const ti = ci.reduce((a, b) => a + b, 0), te = ce.reduce((a, b) => a + b, 0);
    return labels.map((l, i) => ({autores: l, identificados: ci[i], pct_identificados: ci[i] / ti, ieee: ce[i], pct_ieee: ce[i] / te}));
  },
});

dash.calc('por_plataforma', {
  inputs: ['canales'],
  title: 'Canales por plataforma',
  description: 'Número de canales y suma de seguidores por plataforma agrupada.',
  fn: (canales) => {
    const by = {};
    for (const c of canales) {
      const r = (by[c.plataforma_grupo] ??= {plataforma: c.plataforma_grupo, canales: 0, seguidores: 0});
      r.canales++;
      r.seguidores += Number(c.seguidores) || 0;
    }
    return Object.values(by).sort((a, b) => b.canales - a.canales);
  },
});
