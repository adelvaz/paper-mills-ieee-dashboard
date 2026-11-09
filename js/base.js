window.PM = (() => {
  const loc = d3.formatLocale({decimal: ',', thousands: ' ', grouping: [3], currency: ['', ''], percent: ' %'});
  const int = loc.format(',d');
  const pct = loc.format('.1%');
  const pct0 = loc.format('.0%');
  const dec = loc.format('.3f');
  const st = (id) => dash.data(id).status;
  const rows = (id) => { const d = dash.data(id); return d.status === 'ok' ? d.data : null; };
  const color = (i) => dash.colors[i % dash.colors.length];
  const cssVar = (el, name) => getComputedStyle(el).getPropertyValue(name).trim();

  function empty(el, ids, isText) {
    const list = [].concat(ids);
    const failed = list.some((id) => ['error', 'connect', 'declined', 'missing'].includes(st(id)));
    if (isText) { el.textContent = '—'; return; }
    el.replaceChildren();
    if (failed) {
      el.classList.remove('dash-skeleton');
      const f = document.createElement('div');
      f.className = 'pm-fail';
      f.textContent = 'No se pudo cargar';
      el.append(f);
    } else el.classList.add('dash-skeleton');
  }

  function measure(svg, texts) {
    const g = svg.append('g').attr('class', 'pm-tick').style('visibility', 'hidden');
    let w = 0;
    for (const t of texts) w = Math.max(w, g.append('text').attr('class', 'pm-tick').text(t).node().getComputedTextLength());
    g.remove();
    return w;
  }

  function fit(svg, text, max) {
    if (measure(svg, [text]) <= max) return text;
    let s = text;
    while (s.length > 3 && measure(svg, [s + '…']) > max) s = s.slice(0, -1);
    return s + '…';
  }

  function tooltip(box) {
    const t = document.createElement('div');
    t.className = 'pm-tip';
    t.hidden = true;
    box.append(t);
    return {
      show(ev, title, lines) {
        t.replaceChildren();
        const h = document.createElement('div');
        h.className = 'pm-tip-h';
        h.textContent = title;
        t.append(h);
        for (const [c, name, val] of lines) {
          const r = document.createElement('div');
          r.className = 'pm-tip-r';
          if (c) { const s = document.createElement('span'); s.className = 'pm-sw'; s.style.background = c; r.append(s); }
          const n = document.createElement('span'); n.textContent = name;
          const v = document.createElement('b'); v.textContent = val;
          r.append(n, v);
          t.append(r);
        }
        t.hidden = false;
        const bb = box.getBoundingClientRect();
        const tw = t.offsetWidth, th = t.offsetHeight;
        let x = ev.clientX - bb.left + 12, y = ev.clientY - bb.top + 12;
        if (x + tw > bb.width) x = ev.clientX - bb.left - tw - 12;
        if (y + th > bb.height) y = ev.clientY - bb.top - th - 12;
        t.style.left = Math.max(0, x) + 'px';
        t.style.top = Math.max(0, y) + 'px';
      },
      hide() { t.hidden = true; },
    };
  }

  // Barras verticales (agrupadas o apiladas)
  function vbars(el, o) {
    el.classList.remove('dash-skeleton');
    el.replaceChildren();
    const W = Math.max(280, el.clientWidth), H = o.height || 260;
    const svg = d3.select(el).append('svg').attr('class', 'pm-svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`);
    const keys = o.series.map((s) => s.key);
    const yfmt = o.yfmt || int, xfmt = o.xfmt || String;
    const maxY = o.stacked ? d3.max(o.data, (d) => d3.sum(keys, (k) => +d[k] || 0)) : d3.max(o.data, (d) => d3.max(keys, (k) => +d[k] || 0));
    const y = d3.scaleLinear([0, maxY || 1], [H - 26, 10]).nice();
    const ticks = y.ticks(5);
    const ml = measure(svg, ticks.map(yfmt)) + 10;
    const x = d3.scaleBand(o.data.map((d) => d[o.x]), [ml, W - 6]).padding(0.2);
    svg.append('g').selectAll('line').data(ticks).join('line').attr('class', 'pm-gridline').attr('x1', ml).attr('x2', W - 6).attr('y1', y).attr('y2', y);
    svg.append('g').selectAll('text').data(ticks).join('text').attr('class', 'pm-tick').attr('x', ml - 6).attr('y', y).attr('dy', '0.32em').attr('text-anchor', 'end').text(yfmt);
    const labels = o.data.map((d) => d[o.x]);
    const lw = measure(svg, labels.map(xfmt)) + 10;
    const step = Math.max(1, Math.ceil(lw / x.step()));
    svg.append('g').selectAll('text').data(labels.filter((_, i) => i % step === 0)).join('text').attr('class', 'pm-tick')
      .attr('x', (d) => x(d) + x.bandwidth() / 2).attr('y', H - 8).attr('text-anchor', 'middle').text(xfmt);
    const g = svg.append('g');
    if (o.stacked) {
      const w = Math.min(x.bandwidth(), 32), off = (x.bandwidth() - w) / 2;
      const stack = d3.stack().keys(keys).value((d, k) => +d[k] || 0)(o.data);
      g.selectAll('g').data(stack).join('g').attr('fill', (s, i) => o.series[i].color)
        .selectAll('rect').data((s) => s).join('rect')
        .attr('x', (p) => x(p.data[o.x]) + off).attr('width', w)
        .attr('y', (p) => y(p[1])).attr('height', (p) => Math.max(0, y(p[0]) - y(p[1]))).attr('rx', Math.min(2, w / 2));
    } else {
      const x1 = d3.scaleBand(keys, [0, x.bandwidth()]).padding(0.08);
      const w = Math.min(x1.bandwidth(), 32), off = (x1.bandwidth() - w) / 2;
      g.selectAll('g').data(o.data).join('g').attr('transform', (d) => `translate(${x(d[o.x])},0)`)
        .selectAll('rect').data((d) => o.series.map((s) => ({s, v: +d[s.key] || 0}))).join('rect')
        .attr('x', (q) => x1(q.s.key) + off).attr('width', w).attr('fill', (q) => q.s.color)
        .attr('y', (q) => y(q.v)).attr('height', (q) => Math.max(0, y(0) - y(q.v))).attr('rx', Math.min(2, w / 2));
    }
    svg.append('line').attr('class', 'pm-axis').attr('x1', ml).attr('x2', W - 6).attr('y1', y(0)).attr('y2', y(0));
    const tip = tooltip(el);
    svg.append('g').selectAll('rect').data(o.data).join('rect')
      .attr('x', (d) => x(d[o.x]) - (x.step() - x.bandwidth()) / 2).attr('width', x.step()).attr('y', 0).attr('height', H - 20)
      .attr('fill', 'transparent')
      .on('pointermove', (ev, d) => tip.show(ev, (o.tipTitle || xfmt)(d[o.x]), o.series.map((s) => [o.series.length > 1 ? s.color : null, s.name, (s.fmt || yfmt)(+d[s.key] || 0)]).concat(o.tipExtra ? o.tipExtra(d) : [])))
      .on('pointerleave', () => tip.hide());
  }

  // Barras horizontales; las series se superponen desde cero (p. ej. identificados y retractados)
  function hbars(el, o) {
    el.classList.remove('dash-skeleton');
    el.replaceChildren();
    const W = Math.max(280, el.clientWidth), rowH = o.rowH || 24, H = o.data.length * rowH + 8;
    const svg = d3.select(el).append('svg').attr('class', 'pm-svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`);
    const fmt = o.fmt || int;
    const maxLab = W * 0.42;
    const labs = o.data.map((d) => fit(svg, String(d[o.label]), maxLab));
    const ml = Math.min(maxLab, measure(svg, labs)) + 10;
    const vw = measure(svg, o.data.map((d) => fmt(+d[o.series[0].key] || 0))) + 8;
    const max = d3.max(o.data, (d) => d3.max(o.series, (s) => +d[s.key] || 0)) || 1;
    const x = d3.scaleLinear([0, max], [ml, W - vw]);
    const y = d3.scaleBand(o.data.map((_, i) => i), [4, H - 4]).padding(0.25);
    const bh = Math.min(y.bandwidth(), 20);
    const row = svg.selectAll('g.r').data(o.data).join('g').attr('class', 'r').attr('transform', (_, i) => `translate(0,${y(i) + (y.bandwidth() - bh) / 2})`);
    row.append('text').attr('class', 'pm-tick').attr('x', ml - 8).attr('y', bh / 2).attr('dy', '0.32em').attr('text-anchor', 'end').text((_, i) => labs[i]);
    o.series.forEach((s, j) => {
      row.append('rect').attr('x', ml).attr('y', j ? bh * 0.2 : 0).attr('height', j ? bh * 0.6 : bh)
        .attr('width', (d) => Math.max(0, x(+d[s.key] || 0) - ml)).attr('fill', s.color).attr('rx', 2);
    });
    row.append('text').attr('class', 'pm-tick').attr('x', (d) => x(+d[o.series[0].key] || 0) + 4).attr('y', bh / 2).attr('dy', '0.32em').text((d) => fmt(+d[o.series[0].key] || 0));
    const tip = tooltip(el);
    row.append('rect').attr('x', 0).attr('width', W).attr('y', -(rowH - bh) / 2).attr('height', rowH).attr('fill', 'transparent')
      .style('cursor', o.onClick ? 'pointer' : null)
      .on('pointermove', (ev, d) => tip.show(ev, String(d[o.label]), o.series.map((s) => [o.series.length > 1 ? s.color : null, s.name, (s.fmt || fmt)(+d[s.key] || 0)]).concat(o.tipExtra ? o.tipExtra(d) : [])))
      .on('pointerleave', () => tip.hide())
      .on('click', (ev, d) => o.onClick && o.onClick(d));
  }

  // Tabla ordenable y filtrable; columnas: [{key, fmt?, num?, link?, cls?}]
  function table(tbody, o) {
    const frag = document.createDocumentFragment();
    for (const r of o.rows) {
      const tr = document.createElement('tr');
      tr.dataset.key = String(r[o.key]);
      if (o.clickable) tr.className = 'click';
      for (const c of o.cols) {
        const td = document.createElement('td');
        if (c.num) td.classList.add('num');
        if (c.cls) td.classList.add(c.cls);
        const v = r[c.key];
        const text = v == null || v === '' ? '' : (c.fmt ? c.fmt(v, r) : String(v));
        const href = c.link ? c.link(r) : null;
        if (href) { const a = document.createElement('a'); a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = text; td.append(a); } else td.textContent = text;
        tr.append(td);
      }
      frag.append(tr);
    }
    tbody.replaceChildren(frag);
  }

  function sortRows(rows, key, dir, num) {
    const f = num ? (r) => (r[key] == null || r[key] === '' ? -Infinity : +r[key]) : (r) => String(r[key] ?? '').toLowerCase();
    return rows.slice().sort((a, b) => (f(a) < f(b) ? -1 : f(a) > f(b) ? 1 : 0) * (dir === 'asc' ? 1 : -1));
  }

  return {int, pct, pct0, dec, st, rows, color, cssVar, empty, measure, fit, tooltip, vbars, hbars, table, sortRows};
})();

window.PMstate = {
  tab: 'resumen',
  qCong: '', sortCong: {key: 'identificados', dir: 'desc', num: true},
  qOf: '', sortOf: {key: 'n', dir: 'asc', num: true},
  qCan: '', sortCan: {key: 'seguidores', dir: 'desc', num: true},
  nAut: 'a6', umbral: 0.3,
};
