// A deterministic simulation. All values are simulated cinnamon rolls per hour.
export function trueDemand(x) {
  const morning = 19 * Math.exp(-(((x + 0.36) / 0.31) ** 2));
  const lunch = 29 * Math.exp(-(((x - 0.15) / 0.39) ** 2));
  return 20 + morning + lunch + 3 * (1 - x);
}

function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function normal(rng) {
  const u = Math.max(rng(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

export function makeData(n, noise, seed) {
  const rng = random(seed);
  const training = [];
  for (let i = 0; i < n; i++) {
    // Stratification avoids an accidental empty part of the day.
    const x = -1 + 2 * (i + 0.15 + 0.7 * rng()) / n;
    training.push({ x, y: trueDemand(x) + noise * normal(rng) });
  }
  const test = [];
  for (let i = 0; i < 1000; i++) {
    const x = -1 + 2 * (i + 0.5) / 1000;
    test.push({ x, y: trueDemand(x) + noise * normal(rng) });
  }
  return { training, test };
}

function basis(x, degree) {
  const t = new Float64Array(degree + 1);
  t[0] = 1;
  if (degree > 0) t[1] = x;
  for (let j = 2; j <= degree; j++) t[j] = 2 * x * t[j - 1] - t[j - 2];
  return t;
}

// Least squares in a Chebyshev basis, solved with twice-reorthogonalized QR.
// The basis improves numerical behavior at higher degrees.
export function fitPolynomial(training, degree) {
  const n = training.length;
  if (degree >= n) throw new Error("Degree must be smaller than sample size.");
  const p = degree + 1;
  const rows = training.map(({ x }) => basis(x, degree));
  const q = [];
  const r = Array.from({ length: p }, () => new Float64Array(p));
  for (let j = 0; j < p; j++) {
    const v = Float64Array.from(rows, row => row[j]);
    for (let pass = 0; pass < 2; pass++) {
      for (let k = 0; k < j; k++) {
        let dot = 0;
        for (let i = 0; i < n; i++) dot += q[k][i] * v[i];
        r[k][j] += dot;
        for (let i = 0; i < n; i++) v[i] -= dot * q[k][i];
      }
    }
    let norm = 0;
    for (let i = 0; i < n; i++) norm += v[i] * v[i];
    norm = Math.sqrt(norm);
    if (norm < 1e-10) throw new Error("This sample cannot support that degree.");
    r[j][j] = norm;
    q.push(Float64Array.from(v, value => value / norm));
  }
  const rhs = q.map(column => {
    let dot = 0;
    for (let i = 0; i < n; i++) dot += column[i] * training[i].y;
    return dot;
  });
  const coefficients = new Float64Array(p);
  for (let j = p - 1; j >= 0; j--) {
    let value = rhs[j];
    for (let k = j + 1; k < p; k++) value -= r[j][k] * coefficients[k];
    coefficients[j] = value / r[j][j];
  }
  return coefficients;
}

export function predict(coefficients, x) {
  const t = basis(x, coefficients.length - 1);
  let prediction = 0;
  for (let i = 0; i < coefficients.length; i++) prediction += coefficients[i] * t[i];
  return prediction;
}

function rmse(model, data) {
  let squaredError = 0;
  for (const point of data) squaredError += (predict(model, point.x) - point.y) ** 2;
  return Math.sqrt(squaredError / data.length);
}

export function runSimulation({ n = 30, noise = 9, seed = 123 } = {}) {
  const { training, test } = makeData(n, noise, seed);
  const results = [];
  for (let degree = 1; degree <= 15; degree++) {
    const model = fitPolynomial(training, degree);
    results.push({ degree, model, trainRmse: rmse(model, training), testRmse: rmse(model, test) });
  }
  return { training, test, results, n, noise, seed };
}
