import { runSimulation, trueDemand, predict } from './model.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
let state = {
  n: clamp(Number(params.get('n')) || 40, 20, 160),
  noise: clamp(Number(params.get('noise')) || 7, 1, 14),
  degree: clamp(Number(params.get('degree')) || 5, 1, 15),
  seed: clamp(Number(params.get('seed')) || 130, 1, 999999)
};
let simulation;

function clamp(value, lo, hi) { return Math.min(hi, Math.max(lo, Math.round(value))); }
function esc(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fmt(value) { return value.toFixed(1); }
function hour(x) { return 8 + (x + 1) * 5.5; }
function coords(x, y, bounds) {
  const px = bounds.l + (x - bounds.x0) / (bounds.x1 - bounds.x0) * bounds.w;
  const py = bounds.t + bounds.h - (y - bounds.y0) / (bounds.y1 - bounds.y0) * bounds.h;
  return [px, py];
}
function path(points, bounds) {
  return points.map((p, i) => {
    const [x, y] = coords(p.x, p.y, bounds);
    return `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
}
function grid(bounds, yTicks, xTicks, xLabel) {
  const yLines = yTicks.map(y => {
    const [, py] = coords(bounds.x0, y, bounds);
    return `<line class="grid" x1="${bounds.l}" x2="${bounds.l + bounds.w}" y1="${py}" y2="${py}"/><text class="tick" x="${bounds.l - 10}" y="${py + 4}" text-anchor="end">${esc(y)}</text>`;
  }).join('');
  const xLabels = xTicks.map(([x, label]) => {
    const [px] = coords(x, bounds.y0, bounds);
    return `<text class="tick" x="${px}" y="${bounds.t + bounds.h + 23}" text-anchor="middle">${esc(label)}</text>`;
  }).join('');
  return `${yLines}<line class="axis" x1="${bounds.l}" x2="${bounds.l + bounds.w}" y1="${bounds.t + bounds.h}" y2="${bounds.t + bounds.h}"/>${xLabels}<text class="axis-label" x="${bounds.l + bounds.w / 2}" y="${bounds.t + bounds.h + 48}" text-anchor="middle">${xLabel}</text>`;
}

function renderDemand() {
  const selected = simulation.results[state.degree - 1];
  const curve = Array.from({length: 220}, (_, i) => {
    const x = -1 + 2 * i / 219;
    return { x, y: predict(selected.model, x) };
  });
  const truth = curve.map(p => ({ x: p.x, y: trueDemand(p.x) }));
  const allY = [...curve.map(p => p.y), ...truth.map(p => p.y), ...simulation.training.map(p => p.y)];
  const lo = Math.min(0, Math.floor(Math.min(...allY) / 10) * 10);
  const hi = Math.max(60, Math.ceil(Math.max(...allY) / 10) * 10);
  const b = { l: 58, t: 18, w: 640, h: 290, x0: -1, x1: 1, y0: lo, y1: hi };
  const step = Math.max(10, Math.ceil((hi - lo) / 50) * 10);
  const ticks = [];
  for (let y = Math.ceil(lo / step) * step; y <= hi; y += step) ticks.push(y);
  const dots = simulation.training.map(p => {
    const [x, y] = coords(p.x, p.y, b);
    return `<circle class="sample" cx="${x}" cy="${y}" r="3.3"/>`;
  }).join('');
  $('demand-chart').innerHTML = `${grid(b, ticks, [[-1,'08:00'],[-0.5,'10:45'],[0,'13:30'],[0.5,'16:15'],[1,'19:00']], 'Hour of day')}<path class="truth-line" d="${path(truth,b)}"/><path class="fit-line" d="${path(curve,b)}"/>${dots}`;
  $('demand-chart').setAttribute('aria-label', `Simulated demand by hour. Degree ${state.degree} fitted curve versus true demand and ${state.n} training observations.`);
}

function renderErrors() {
  const all = simulation.results;
  const rawMax = Math.max(...all.map(p => Math.max(p.trainRmse, p.testRmse)));
  const max = Math.max(10, Math.ceil(rawMax / 5) * 5);
  const b = { l: 58, t: 18, w: 640, h: 290, x0: 1, x1: 15, y0: 0, y1: max };
  const step = Math.max(2, Math.ceil(max / 5));
  const ticks = [];
  for (let y = 0; y <= max; y += step) ticks.push(y);
  const [markerX] = coords(state.degree, 0, b);
  const trainPath = path(all.map(p=>({x:p.degree,y:p.trainRmse})),b);
  const testPath = path(all.map(p=>({x:p.degree,y:p.testRmse})),b);
  const selected = all[state.degree - 1];
  const [tx, ty] = coords(state.degree, selected.trainRmse, b);
  const [vx, vy] = coords(state.degree, selected.testRmse, b);
  $('error-chart').innerHTML = `${grid(b,ticks,[[1,'1'],[4,'4'],[7,'7'],[10,'10'],[13,'13'],[15,'15']],'Polynomial degree')}<line class="selected-line" x1="${markerX}" x2="${markerX}" y1="${b.t}" y2="${b.t+b.h}"/><path class="train-line" d="${trainPath}"/><path class="test-line" d="${testPath}"/><circle class="train-point" cx="${tx}" cy="${ty}" r="6"/><circle class="test-point" cx="${vx}" cy="${vy}" r="6"/>`;
  $('error-chart').setAttribute('aria-label', `Training and test RMSE by polynomial degree. At degree ${state.degree}, training RMSE is ${fmt(selected.trainRmse)} and test RMSE is ${fmt(selected.testRmse)}.`);
}

function render() {
  $('sample').value = state.n;
  $('noise').value = state.noise;
  $('degree').value = state.degree;
  $('sample-value').textContent = state.n;
  $('noise-value').textContent = state.noise;
  $('degree-value').textContent = state.degree;
  $('seed-value').textContent = state.seed;
  const selected = simulation.results[state.degree - 1];
  const best = simulation.results.reduce((a,b) => b.testRmse < a.testRmse ? b : a);
  $('train-value').textContent = fmt(selected.trainRmse);
  $('test-value').textContent = fmt(selected.testRmse);
  $('best-value').textContent = `Degree ${best.degree}`;
  $('readout').textContent = `At degree ${state.degree}, training RMSE is ${fmt(selected.trainRmse)} rolls per hour, compared with ${fmt(selected.testRmse)} on independent test observations. The lowest test error in this run is at degree ${best.degree}.`;
  renderDemand(); renderErrors();
  const url = new URL(location.href);
  for (const [key,value] of Object.entries(state)) url.searchParams.set(key, value);
  history.replaceState(null,'',url);
}

function recalculate() { simulation = runSimulation(state); render(); }
for (const [id,key] of [['sample','n'],['noise','noise'],['degree','degree']]) {
  $(id).addEventListener('input', e => {
    state[key] = Number(e.target.value);
    if (key === 'degree') render(); else recalculate();
  });
}
$('resimulate').addEventListener('click', () => { state.seed += 1; recalculate(); });
$('copy-summary').addEventListener('click', async () => {
  const selected = simulation.results[state.degree - 1];
  const best = simulation.results.reduce((a,b) => b.testRmse < a.testRmse ? b : a);
  const summary = `Cinnamon-roll overfitting simulation: n=${state.n}, noise=${state.noise}, degree=${state.degree}, seed=${state.seed}. Training RMSE=${fmt(selected.trainRmse)}; independent test RMSE=${fmt(selected.testRmse)}; lowest test RMSE=${fmt(best.testRmse)} at degree ${best.degree}. ${location.href}`;
  try { await navigator.clipboard.writeText(summary); $('copy-summary').textContent = 'Copied'; }
  catch { $('copy-summary').textContent = 'Copy unavailable'; }
  setTimeout(() => $('copy-summary').textContent = 'Copy run summary', 2000);
});
recalculate();
