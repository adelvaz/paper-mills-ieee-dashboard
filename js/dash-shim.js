// Implementación mínima, autónoma, de la API `dash` que usan los scripts del dashboard.
// Permite servir la página como sitio estático (p. ej. GitHub Pages) sin dependencias de servidor.
(() => {
  const DATASETS = {
    ofertas: 'data/ofertas_ieee.json',
    congresos: 'data/congresos_identificados.json',
    ieee: 'data/ieee_congresos_crossref.json',
    canales: 'data/canales.json',
    oa_articulos: 'data/oa_articulos.json',
    oa_autorias: 'data/oa_autorias.json',
    espana: 'data/oa_espana.json',
  };
  const DEFAULT_PARAMS = {congreso: null, estado: 'emparejadas'};

  const store = {};      // id -> {status, data}
  const calcs = {};      // id -> {inputs, fn}
  const draws = {};      // name -> fn
  const listeners = [];  // onData
  let params = {...DEFAULT_PARAMS};
  let scheduled = false;

  const colors = () => {
    const cs = getComputedStyle(document.documentElement);
    return [1, 2, 3, 4, 5, 6, 7, 8].map((i) => cs.getPropertyValue(`--pm-series-${i}`).trim());
  };

  function calcValue(id) {
    const c = calcs[id];
    const inputs = c.inputs.map((i) => data(i));
    if (inputs.some((d) => d.status === 'error')) return {status: 'error', data: []};
    if (inputs.some((d) => d.status !== 'ok')) return {status: 'loading', data: []};
    if (!c.cache) {
      try { c.cache = {status: 'ok', data: c.fn(...inputs.map((d) => d.data))}; }
      catch (e) { console.error('calc', id, e); c.cache = {status: 'error', data: []}; }
    }
    return c.cache;
  }

  function data(id) {
    if (calcs[id]) return calcValue(id);
    const s = store[id];
    if (!s) return {status: DATASETS[id] ? 'loading' : 'missing', data: []};
    return s;
  }

  const visible = (el) => !el.closest('[hidden]');

  function runDraw(name) {
    const fn = draws[name];
    if (!fn) return;
    for (const el of document.querySelectorAll(`[data-draw="${name}"]`)) {
      if (!visible(el)) continue;
      try { fn(el); } catch (e) { console.error('draw', name, e); }
    }
  }

  function redrawAll() {
    scheduled = false;
    for (const fn of listeners) { try { fn(); } catch (e) { console.error('onData', e); } }
    for (const name of Object.keys(draws)) runDraw(name);
  }
  const schedule = () => { if (!scheduled) { scheduled = true; requestAnimationFrame(redrawAll); } };

  window.dash = {
    data,
    calc(id, def) { calcs[id] = {inputs: def.inputs, fn: def.fn}; },
    loader() {},
    draw(name, fn) {
      if (fn) { draws[name] = typeof fn === 'function' ? fn : fn.update || (() => {}); schedule(); }
      else runDraw(name);
    },
    onData(fn) { listeners.push(fn); schedule(); },
    get colors() { return colors(); },
    refresh() {},
    params: () => ({...params}),
    setParams(p) { params = {...params, ...p}; schedule(); },
    resetParams() { params = {...DEFAULT_PARAMS}; schedule(); },
    setLink(id) { history.replaceState(null, '', '#' + id); },
  };

  // Carga de datos
  for (const [id, url] of Object.entries(DATASETS)) {
    fetch(url).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((rows) => { store[id] = {status: 'ok', data: rows}; schedule(); })
      .catch((e) => { console.error('dataset', id, e); store[id] = {status: 'error', data: []}; schedule(); });
  }

  // Redibujar al cambiar de pestaña o de tamaño
  document.addEventListener('DOMContentLoaded', () => {
    new MutationObserver(schedule).observe(document.body, {subtree: true, attributes: true, attributeFilter: ['hidden']});
  });
  let w = window.innerWidth;
  window.addEventListener('resize', () => { if (window.innerWidth !== w) { w = window.innerWidth; schedule(); } });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', schedule);
})();
