(() => {
  const S = window.PMstate;
  const tabs = () => document.querySelectorAll('.pm-tab');
  const pages = () => document.querySelectorAll('.pm-page');

  window.PMtab = (id, quiet) => {
    let found = false;
    for (const p of pages()) { const on = p.id === id; p.hidden = !on; found = found || on; }
    if (!found) return;
    for (const t of tabs()) t.setAttribute('aria-selected', String(t.dataset.tab === id));
    S.tab = id;
    if (!quiet) dash.setLink(id);
  };
  for (const t of tabs()) t.addEventListener('click', () => window.PMtab(t.dataset.tab));
  const named = location.hash.slice(1);
  if (named) window.PMtab(named, true);

  // Ordenación de tablas
  const sorters = {cong: ['sortCong', 'tb-cong'], of: ['sortOf', 'tb-of'], can: ['sortCan', 'tb-can']};
  for (const table of document.querySelectorAll('.pm-table[data-tbl]')) {
    const [stKey, draw] = sorters[table.dataset.tbl];
    const paint = () => {
      for (const th of table.querySelectorAll('th[data-field]')) th.setAttribute('aria-sort', th.dataset.field === S[stKey].key ? (S[stKey].dir === 'asc' ? 'ascending' : 'descending') : 'none');
    };
    paint();
    for (const th of table.querySelectorAll('th[data-field]')) {
      const b = th.querySelector('button');
      if (!b) continue;
      b.addEventListener('click', () => {
        const key = th.dataset.field, cur = S[stKey];
        S[stKey] = {key, num: th.classList.contains('num'), dir: cur.key === key && cur.dir === 'desc' ? 'asc' : cur.key === key ? 'desc' : th.classList.contains('num') ? 'desc' : 'asc'};
        paint();
        dash.draw(draw);
      });
    }
  }

  // Búsquedas
  const searches = {cong: ['qCong', ['tb-cong']], of: ['qOf', ['tb-of', 'cuenta-of']], can: ['qCan', ['tb-can']]};
  for (const inp of document.querySelectorAll('.pm-input[data-q]')) {
    const [k, draws] = searches[inp.dataset.q];
    inp.addEventListener('input', () => { S[k] = inp.value.trim(); draws.forEach((d) => dash.draw(d)); });
  }

  // Clic en una fila de congresos: filtra la tabla de artículos
  for (const tb of document.querySelectorAll('[data-draw="tb-cong"]')) {
    tb.addEventListener('click', (ev) => {
      const tr = ev.target.closest('tr[data-key]');
      if (tr) { dash.setParams({congreso: tr.dataset.key}); window.PMtab('articulos'); }
    });
  }
  for (const chip of document.querySelectorAll('[data-draw="chip-cong"]')) chip.addEventListener('click', () => dash.setParams({congreso: null}));

  // Estado del emparejamiento
  const estados = document.querySelectorAll('.pm-estado');
  for (const sel of estados) sel.addEventListener('change', () => dash.setParams({estado: sel.value}));

  // Número de autores (réplica de la figura 7) y umbral
  for (const sel of document.querySelectorAll('.pm-naut')) sel.addEventListener('change', () => { S.nAut = sel.value; dash.draw('ch-fig7'); });
  for (const rg of document.querySelectorAll('.pm-umbral')) rg.addEventListener('input', () => { S.umbral = Number(rg.value) / 100; dash.draw('umbral-label'); dash.draw('ch-umbral'); });

  for (const b of document.querySelectorAll('.pm-reset')) b.addEventListener('click', () => {
    dash.resetParams();
    S.qOf = '';
    for (const inp of document.querySelectorAll('.pm-input[data-q="of"]')) inp.value = '';
    dash.draw('tb-of'); dash.draw('cuenta-of');
  });

  dash.onData(() => {
    const p = dash.params();
    for (const sel of estados) sel.value = p.estado || 'emparejadas';
  });
})();
