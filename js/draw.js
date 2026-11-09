(() => {
  const P = window.PM, S = window.PMstate;
  const fmts = {int: P.int, pct: P.pct, dias: (v) => P.int(Math.round(v)) + ' días'};

  // Cifras en texto
  for (const name of ['kpi', 'desf']) {
    const src = name === 'kpi' ? 'kpis' : 'desfase_resumen';
    dash.draw(name, (el) => {
      const r = P.rows(src);
      if (!r || !r[0]) return P.empty(el, src, true);
      const v = r[0][el.dataset.field];
      el.textContent = v == null ? '—' : (fmts[el.dataset.fmt] || P.int)(v);
    });
  }

  dash.draw('sw', (el) => { el.style.background = el.dataset.muted ? P.cssVar(el, '--cds-chart-muted') : P.color(+el.dataset.i || 0); });

  dash.draw('ch-anio', (el) => {
    const r = P.rows('por_anio');
    if (!r) return P.empty(el, 'por_anio');
    P.vbars(el, {data: r, x: 'anio', series: [{key: 'ofertas', name: 'Ofertas recogidas', color: P.color(0)}, {key: 'articulos', name: 'Artículos identificados', color: P.color(1)}]});
  });

  const goCongreso = (doi) => { dash.setParams({congreso: doi}); window.PMtab && window.PMtab('articulos'); };

  dash.draw('ch-top', (el) => {
    const r = P.rows('congresos');
    if (!r) return P.empty(el, 'congresos');
    const top = r.slice().sort((a, b) => b.identificados - a.identificados).slice(0, 15);
    P.hbars(el, {data: top, label: 'congreso',
      series: [{key: 'identificados', name: 'Identificados', color: P.color(0)}, {key: 'retractados', name: 'Retractados', color: P.cssVar(el, '--cds-chart-status-critical')}],
      tipExtra: (d) => [[null, '% de las actas', d.pct_identificados == null ? 's/d' : String(d.pct_identificados).replace('.', ',') + '\u202f%'], [null, 'País', d.pais || 's/d']],
      onClick: (d) => goCongreso(d.congreso_doi)});
  });

  dash.draw('ch-mes', (el) => {
    const r = P.rows('ofertas_mes');
    if (!r) return P.empty(el, 'ofertas_mes');
    const mf = (m) => { const [y, mm] = m.split('-'); return ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][+mm - 1] + ' ' + y.slice(2); };
    P.vbars(el, {data: r, x: 'mes', stacked: true, xfmt: mf,
      series: [{key: 'emparejadas', name: 'Con artículo identificado', color: P.color(0)}, {key: 'sin_emparejar', name: 'Sin identificar', color: P.cssVar(el, '--cds-chart-muted')}]});
  });

  dash.draw('ch-plazas', (el) => {
    const r = P.rows('plazas');
    if (!r) return P.empty(el, 'plazas');
    P.hbars(el, {data: r, label: 'plazas', series: [{key: 'ofertas', name: 'Ofertas', color: P.color(0)}]});
  });

  dash.draw('ch-desfase', (el) => {
    const r = P.rows('desfase');
    if (!r) return P.empty(el, 'desfase');
    P.vbars(el, {data: r, x: 'desde', xfmt: (d) => String(d), tipTitle: (d) => `De ${d} a ${d + 29} días`, series: [{key: 'ofertas', name: 'Ofertas', color: P.color(0)}]});
  });

  dash.draw('ch-patro', (el) => {
    const r = P.rows('patrocinadores');
    if (!r) return P.empty(el, 'patrocinadores');
    P.hbars(el, {data: r, label: 'patrocinador', series: [{key: 'identificados', name: 'Artículos identificados', color: P.color(0)}],
      tipExtra: (d) => [[null, 'Congresos', P.int(d.congresos)]]});
  });

  // Dispersión: % seis autores en las actas frente a % identificados
  dash.draw('ch-disp', (el) => {
    const r = P.rows('congresos');
    if (!r) return P.empty(el, 'congresos');
    el.classList.remove('dash-skeleton');
    el.replaceChildren();
    const pts = r.filter((d) => d.pct_seis_autores != null && d.pct_identificados != null);
    const W = Math.max(280, el.clientWidth), H = 300;
    const svg = d3.select(el).append('svg').attr('class', 'pm-svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`);
    const y = d3.scaleLinear([0, d3.max(pts, (d) => d.pct_identificados) || 1], [H - 34, 10]).nice();
    const yt = y.ticks(5);
    const ml = P.measure(svg, yt.map((v) => v + ' %')) + 10;
    const x = d3.scaleLinear([0, 100], [ml, W - 10]);
    const rr = d3.scaleSqrt([0, d3.max(pts, (d) => d.identificados) || 1], [2, 14]);
    svg.append('g').selectAll('line').data(yt).join('line').attr('class', 'pm-gridline').attr('x1', ml).attr('x2', W - 10).attr('y1', y).attr('y2', y);
    svg.append('g').selectAll('text').data(yt).join('text').attr('class', 'pm-tick').attr('x', ml - 6).attr('y', y).attr('dy', '0.32em').attr('text-anchor', 'end').text((v) => v + ' %');
    svg.append('g').selectAll('text').data(x.ticks(5)).join('text').attr('class', 'pm-tick').attr('x', x).attr('y', H - 18).attr('text-anchor', 'middle').text((v) => v + ' %');
    svg.append('line').attr('class', 'pm-axis').attr('x1', ml).attr('x2', W - 10).attr('y1', y(0)).attr('y2', y(0));
    svg.append('text').attr('class', 'pm-tick').attr('x', W - 10).attr('y', H - 2).attr('text-anchor', 'end').text('Artículos con seis autores en las actas →');
    const tip = P.tooltip(el);
    svg.append('g').selectAll('circle').data(pts.sort((a, b) => b.identificados - a.identificados)).join('circle')
      .attr('cx', (d) => x(d.pct_seis_autores)).attr('cy', (d) => y(d.pct_identificados)).attr('r', (d) => rr(d.identificados))
      .attr('fill', P.color(0)).attr('fill-opacity', 0.35).attr('stroke', P.color(0)).style('cursor', 'pointer')
      .on('pointermove', (ev, d) => tip.show(ev, d.congreso, [[null, 'Identificados', P.int(d.identificados)], [null, 'Total en actas', P.int(d.total_articulos)], [null, '% identificados', String(d.pct_identificados).replace('.', ',') + '\u202f%'], [null, '% seis autores', String(d.pct_seis_autores).replace('.', ',') + '\u202f%']]))
      .on('pointerleave', () => tip.hide())
      .on('click', (ev, d) => goCongreso(d.congreso_doi));
  });

  // Tabla de congresos
  dash.draw('tb-cong', (tb) => {
    const r = P.rows('congresos');
    if (!r) { tb.replaceChildren(); return; }
    const q = S.qCong.toLowerCase();
    let rows = q ? r.filter((d) => [d.congreso, d.titulo_congreso, d.pais, d.ciudad, d.patrocinadores_ieee].join(' ').toLowerCase().includes(q)) : r;
    rows = P.sortRows(rows, S.sortCong.key, S.sortCong.dir, S.sortCong.num);
    const p1 = (v) => String(v).replace('.', ',') + '\u202f%';
    P.table(tb, {rows, key: 'congreso_doi', clickable: true, cols: [
      {key: 'congreso'}, {key: 'anio', cls: 'opt'}, {key: 'identificados', num: true, fmt: P.int}, {key: 'retractados', num: true, fmt: P.int},
      {key: 'total_articulos', num: true, fmt: P.int, cls: 'opt'}, {key: 'pct_identificados', num: true, fmt: p1}, {key: 'pct_seis_autores', num: true, fmt: p1, cls: 'opt'},
      {key: 'pais', cls: 'opt'}, {key: 'patrocinador_principal', cls: 'opt'}, {key: 'dias_aceptacion', num: true, fmt: P.int, cls: 'opt'}]});
  });

  // Tabla de ofertas
  const filtrarOfertas = (r) => {
    const p = dash.params(), est = p.estado || 'emparejadas', q = S.qOf.toLowerCase();
    return r.filter((d) => (est === 'todas' || (est === 'emparejadas' ? d.estado !== 'sin emparejar' : d.estado === est))
      && (!p.congreso || d.congreso_doi === p.congreso)
      && (!q || [d.titulo_oferta, d.titulo_publicado, d.doi, d.congreso].join(' ').toLowerCase().includes(q)));
  };
  dash.draw('tb-of', (tb) => {
    const r = P.rows('ofertas');
    if (!r) { tb.replaceChildren(); return; }
    const rows = P.sortRows(filtrarOfertas(r), S.sortOf.key, S.sortOf.dir, S.sortOf.num);
    P.table(tb, {rows, key: 'n', cols: [
      {key: 'n', num: true}, {key: 'fecha_oferta', cls: 'opt'}, {key: 'titulo_oferta'}, {key: 'titulo_publicado', cls: 'opt'},
      {key: 'congreso'}, {key: 'doi', link: (d) => (d.doi ? 'https://doi.org/' + d.doi : d.url_sin_doi || null), cls: 'opt'},
      {key: 'sbert', num: true, fmt: (v) => P.dec(v), cls: 'opt'}, {key: 'estado'}]});
  });
  dash.draw('cuenta-of', (el) => {
    const r = P.rows('ofertas');
    if (!r) return P.empty(el, 'ofertas', true);
    el.textContent = `${P.int(filtrarOfertas(r).length)} de ${P.int(r.length)} ofertas`;
  });
  dash.draw('chip-cong', (el) => {
    const c = dash.params().congreso, r = P.rows('congresos');
    el.classList.toggle('is-off', !c);
    const hit = c && r ? r.find((d) => d.congreso_doi === c) : null;
    el.textContent = c ? `Congreso: ${hit ? hit.congreso : c}  ×` : '';
  });

  // Coautoría
  dash.draw('ch-aut', (el) => {
    const r = P.rows('dist_autores');
    if (!r) return P.empty(el, 'dist_autores');
    P.vbars(el, {data: r, x: 'autores', yfmt: P.pct0, tipTitle: (a) => `${a} autor${a === '1' ? '' : 'es'}`,
      series: [{key: 'pct_identificados', name: 'Artículos identificados', color: P.color(0), fmt: P.pct}, {key: 'pct_ieee', name: 'Todos los congresos IEEE', color: P.cssVar(el, '--cds-chart-muted'), fmt: P.pct}],
      tipExtra: (d) => [[null, 'n identificados', P.int(d.identificados)], [null, 'n IEEE', P.int(d.ieee)]]});
  });

  dash.draw('ch-fig7', (el) => {
    const r = P.rows('ieee');
    if (!r) return P.empty(el, 'ieee');
    el.classList.remove('dash-skeleton');
    el.replaceChildren();
    const k = S.nAut, W = Math.max(280, el.clientWidth), H = 340;
    const pts = r.map((d) => ({d, t: new Date(d.fecha_inicio), v: (Number(d[k]) || 0) / d.total, hit: d.identificados > 0}));
    const svg = d3.select(el).append('svg').attr('class', 'pm-svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).style('position', 'absolute').style('inset', '0').style('pointer-events', 'none');
    const y = d3.scaleLinear([0, d3.max(pts, (p) => p.v) || 1], [H - 26, 10]).nice();
    const yt = y.ticks(5);
    const ml = P.measure(svg, yt.map(P.pct0)) + 10;
    const x = d3.scaleUtc([new Date('2010-01-01'), new Date('2026-01-01')], [ml, W - 10]);
    svg.append('g').selectAll('line').data(yt).join('line').attr('class', 'pm-gridline').attr('x1', ml).attr('x2', W - 10).attr('y1', y).attr('y2', y);
    svg.append('g').selectAll('text').data(yt).join('text').attr('class', 'pm-tick').attr('x', ml - 6).attr('y', y).attr('dy', '0.32em').attr('text-anchor', 'end').text(P.pct0);
    const xt = x.ticks(W < 500 ? 4 : 8);
    svg.append('g').selectAll('text').data(xt).join('text').attr('class', 'pm-tick').attr('x', x).attr('y', H - 8).attr('text-anchor', 'middle').text(d3.utcFormat('%Y'));
    const dpr = window.devicePixelRatio || 1;
    const cv = document.createElement('canvas');
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = '100%'; cv.style.aspectRatio = `${W} / ${H}`; cv.style.display = 'block';
    el.prepend(cv);
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    const muted = P.cssVar(el, '--cds-chart-muted'), acc = P.color(0);
    for (const p of pts) p.px = x(p.t), p.py = y(p.v);
    ctx.globalAlpha = 0.45; ctx.fillStyle = muted;
    for (const p of pts) if (!p.hit) { ctx.beginPath(); ctx.arc(p.px, p.py, 1.6, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 0.9; ctx.fillStyle = acc;
    for (const p of pts) if (p.hit) { ctx.beginPath(); ctx.arc(p.px, p.py, 2.8, 0, 7); ctx.fill(); }
    const qt = d3.quadtree(pts, (p) => p.px, (p) => p.py);
    const tip = P.tooltip(el);
    cv.addEventListener('pointermove', (ev) => {
      const b = cv.getBoundingClientRect(), sx = W / b.width;
      const p = qt.find((ev.clientX - b.left) * sx, (ev.clientY - b.top) * sx, 12);
      if (!p) return tip.hide();
      tip.show(ev, `${p.d.congreso} · ${p.d.fecha_inicio}`, [[null, 'Artículos', P.int(p.d.total)], [null, `Con ${k === 'a11mas' ? '11+' : k.slice(1)} autores`, P.pct(p.v)], [null, 'Identificados', P.int(p.d.identificados)]]);
    });
    cv.addEventListener('pointerleave', () => tip.hide());
  });

  dash.draw('umbral-label', (el) => { el.textContent = P.pct0(S.umbral); });

  dash.draw('ch-umbral', (el) => {
    const r = P.rows('ieee');
    if (!r) return P.empty(el, 'ieee');
    const by = d3.rollups(r, (v) => ({n: v.length, sobre: v.filter((d) => d.a6 / d.total > S.umbral).length}), (d) => String(d.anio))
      .map(([anio, o]) => ({anio, congresos: o.n, sobre: o.sobre, pct: o.sobre / o.n})).sort((a, b) => a.anio.localeCompare(b.anio));
    P.vbars(el, {data: by, x: 'anio', yfmt: P.pct0, series: [{key: 'pct', name: 'Congresos sobre el umbral', color: P.color(0), fmt: P.pct}],
      tipExtra: (d) => [[null, 'Congresos sobre el umbral', P.int(d.sobre)], [null, 'Congresos del año', P.int(d.congresos)]]});
  });

  // Canales
  dash.draw('ch-plat', (el) => {
    const r = P.rows('por_plataforma');
    if (!r) return P.empty(el, 'por_plataforma');
    P.hbars(el, {data: r, label: 'plataforma', series: [{key: 'canales', name: 'Canales', color: P.color(0)}], tipExtra: (d) => [[null, 'Seguidores', P.int(d.seguidores)]]});
  });
  dash.draw('tb-can', (tb) => {
    const r = P.rows('canales');
    if (!r) { tb.replaceChildren(); return; }
    const q = S.qCan.toLowerCase();
    let rows = q ? r.filter((d) => [d.nombre, d.plataforma, d.tipo, d.observaciones].join(' ').toLowerCase().includes(q)) : r;
    rows = P.sortRows(rows, S.sortCan.key, S.sortCan.dir, S.sortCan.num);
    P.table(tb, {rows, key: 'id', cols: [{key: 'id', num: true, cls: 'opt'}, {key: 'nombre'}, {key: 'plataforma'}, {key: 'tipo', cls: 'opt'}, {key: 'estado_actividad'}, {key: 'seguidores', num: true, fmt: P.int}]});
  });
})();
