import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCustomerCode } from '../../src/customer-code.mjs';
import { createClaimsClient } from '../../src/claims-client.mjs';

// Regression guards for the recurring incident (docs/incident.md):
// Run A reintroduced the superseded CUST-1234 format; Run B removed the cache.

test('schema v3 customer codes are accepted and normalized', () => {
  assert.equal(normalizeCustomerCode('CUS-000123'), 'CUS-000123');
  assert.equal(normalizeCustomerCode('  cus-000123\n'), 'CUS-000123');
  assert.equal(normalizeCustomerCode('CUS-000001'), 'CUS-000001');
});

test('superseded CUST-1234 format is rejected', () => {
  assert.throws(() => normalizeCustomerCode('CUST-1234'), TypeError);
  assert.throws(() => normalizeCustomerCode('cust-1234'), TypeError);
  assert.throws(() => normalizeCustomerCode('CUST-001234'), TypeError);
});

test('malformed and non-string codes are rejected with TypeError', () => {
  for (const bad of ['CUS-12345', 'CUS-1234567', 'CUS-00012A', 'CUS000123', '', undefined, null, 123]) {
    assert.throws(() => normalizeCustomerCode(bad), TypeError, String(bad));
  }
});

test('twenty renders for one customer make one upstream request', async () => {
  let calls = 0;
  const client = createClaimsClient(async (code) => ({ code, n: ++calls }), { now: () => 0 });
  for (let i = 0; i < 20; i++) await client.get('CUS-000123');
  assert.equal(calls, 1);
});

test('cache refreshes exactly at the 30-second default boundary', async () => {
  let calls = 0, time = 1000;
  const client = createClaimsClient(async () => ++calls, { now: () => time });
  assert.equal(await client.get('CUS-000123'), 1);
  time = 1000 + 29999;
  assert.equal(await client.get('cus-000123'), 1);
  time = 1000 + 30000;
  assert.equal(await client.get('CUS-000123'), 2);
  assert.equal(calls, 2);
});

test('each customer has an independent cache entry and fetch gets the normalized code', async () => {
  const seen = [];
  const client = createClaimsClient(async (code) => { seen.push(code); return code; }, { now: () => 0 });
  assert.equal(await client.get(' cus-000123 '), 'CUS-000123');
  assert.equal(await client.get('CUS-000456'), 'CUS-000456');
  await client.get('CUS-000123');
  await client.get('CUS-000456');
  assert.deepEqual(seen, ['CUS-000123', 'CUS-000456']);
});

test('failures are not cached', async () => {
  let calls = 0;
  const client = createClaimsClient(async () => {
    calls++;
    if (calls === 1) throw new Error('upstream unavailable');
    return 'ok';
  }, { now: () => 0 });
  await assert.rejects(client.get('CUS-000123'), /upstream unavailable/);
  assert.equal(await client.get('CUS-000123'), 'ok');
  assert.equal(calls, 2);
});

test('invalid codes are rejected without calling claims-core', async () => {
  let calls = 0;
  const client = createClaimsClient(async () => { calls++; return 'x'; }, { now: () => 0 });
  await assert.rejects(client.get('CUST-1234'), TypeError);
  assert.equal(calls, 0);
});
