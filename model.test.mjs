import test from 'node:test';
import assert from 'node:assert/strict';
import { runSimulation } from './model.js';

test('nested least-squares fits never increase training RMSE', () => {
  for (const options of [{n:20,noise:14,seed:130},{n:40,noise:7,seed:130},{n:160,noise:1,seed:221}]) {
    const {results} = runSimulation(options);
    for (let i=1;i<results.length;i++) {
      assert.ok(results[i].trainRmse <= results[i-1].trainRmse + 1e-8);
      assert.ok(Number.isFinite(results[i].testRmse));
    }
  }
});

test('default run is reproducible and clearly demonstrates overfitting', () => {
  const a=runSimulation();
  const b=runSimulation();
  assert.equal(a.results[3].testRmse,b.results[3].testRmse);
  assert.ok(a.results[14].trainRmse < a.results[3].trainRmse);
  assert.ok(a.results[14].testRmse > 1.25*a.results[3].testRmse);
});
