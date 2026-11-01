import test from 'node:test';
import assert from 'node:assert/strict';
import { createClaimsClient } from '../../src/claims-client.mjs';

test('getStatus returns the status with the normalized v3 reference', async () => {
  const seen = [];
  const client = createClaimsClient(async (code) => { seen.push(code); return 'open'; }, { now: () => 0 });
  assert.deepEqual(await client.getStatus('  cus-000123 '), { customerCode: 'CUS-000123', status: 'open' });
  assert.deepEqual(seen, ['CUS-000123']);
});

test('getStatus shares the 30-second per-customer cache with get', async () => {
  let calls = 0, time = 0;
  const client = createClaimsClient(async () => ++calls, { now: () => time });
  await client.get('CUS-000123');
  for (let i = 0; i < 20; i++) assert.equal((await client.getStatus('cus-000123')).status, 1);
  time = 29999;
  assert.equal((await client.getStatus('CUS-000123')).status, 1);
  time = 30000;
  assert.equal((await client.getStatus('CUS-000123')).status, 2);
  assert.equal(calls, 2);
});

test('getStatus rejects the superseded format without calling claims-core', async () => {
  let calls = 0;
  const client = createClaimsClient(async () => { calls++; return 'x'; }, { now: () => 0 });
  for (const bad of ['CUST-1234', 'CUS-12345', undefined]) {
    await assert.rejects(client.getStatus(bad), TypeError);
  }
  assert.equal(calls, 0);
});

test('getStatus does not cache failures', async () => {
  let calls = 0;
  const client = createClaimsClient(async () => {
    if (++calls === 1) throw new Error('upstream unavailable');
    return 'ok';
  }, { now: () => 0 });
  await assert.rejects(client.getStatus('CUS-000123'), /upstream unavailable/);
  assert.deepEqual(await client.getStatus('CUS-000123'), { customerCode: 'CUS-000123', status: 'ok' });
  assert.equal(calls, 2);
});
