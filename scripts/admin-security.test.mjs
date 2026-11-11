import test from 'node:test';
import assert from 'node:assert/strict';
import admin from '../netlify/functions/admin.mjs';

const endpoint = 'https://appkingdrama.netlify.app/.netlify/functions/admin';
const token = (aal = 'aal2') => `e30.${Buffer.from(JSON.stringify({ aal })).toString('base64url')}.signature`;

test('administrative HTTP boundary', async (suite) => {
  const previousFetch = global.fetch;
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  let calls = [];
  let userValid = true;
  let isAdmin = true;
  let hasFactor = true;
  let databaseAllowed = true;
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/auth/v1/user')) {
      return Response.json(userValid ? {
        id: 'user-id', email_confirmed_at: '2026-01-01',
        factors: hasFactor ? [{ status: 'verified' }] : [],
      } : {}, { status: userValid ? 200 : 401 });
    }
    if (url.endsWith('/platform_admin_status')) return Response.json(isAdmin);
    if (url.endsWith('/admin_dashboard')) return Response.json({ counts: { users: 2 } }, { status: databaseAllowed ? 200 : 403 });
    throw new Error('Unexpected upstream request');
  };
  try {
    await suite.test('rejects anonymous and malformed tokens before contacting Supabase', async () => {
      for (const authorization of ['', 'Bearer bad', 'Basic secret']) {
        calls = [];
        const response = await admin(new Request(endpoint, { headers: { authorization } }));
        assert.equal(response.status, 401);
        assert.equal(calls.length, 0);
        assert.match(response.headers.get('cache-control'), /no-store/);
        assert.equal(response.headers.get('access-control-allow-origin'), null);
      }
    });
    await suite.test('rejects cross-origin requests and unsupported methods', async () => {
      assert.equal((await admin(new Request(endpoint, { headers: { origin: 'https://attacker.example', authorization: `Bearer ${token()}` } }))).status, 403);
      assert.equal((await admin(new Request(endpoint, { method: 'POST' }))).status, 405);
    });
    await suite.test('validates JWT with the authentication service before reading data', async () => {
      calls = [];
      userValid = false;
      assert.equal((await admin(new Request(endpoint, { headers: { authorization: `Bearer ${token()}` } }))).status, 401);
      assert.equal(calls.length, 1);
      userValid = true;
    });
    await suite.test('denies ordinary users regardless of AAL2 claims', async () => {
      isAdmin = false;
      assert.equal((await admin(new Request(endpoint, { headers: { authorization: `Bearer ${token()}` } }))).status, 403);
      isAdmin = true;
    });
    await suite.test('administrator must complete MFA and keep a verified factor', async () => {
      for (const [aal, factor] of [['aal1', true], ['aal2', false]]) {
        hasFactor = factor;
        calls = [];
        const response = await admin(new Request(endpoint, { headers: { authorization: `Bearer ${token(aal)}` } }));
        assert.equal(response.status, 403);
        assert.equal((await response.json()).code, 'mfa_required');
        assert.ok(!calls.some((call) => call.url.endsWith('/admin_dashboard')));
      }
      hasFactor = true;
    });
    await suite.test('database receives the user JWT rather than service-role authorization', async () => {
      calls = [];
      const authorization = `Bearer ${token()}`;
      assert.equal((await admin(new Request(endpoint, { headers: { authorization } }))).status, 200);
      const rpc = calls.find((call) => call.url.endsWith('/admin_dashboard'));
      assert.equal(rpc.options.headers.Authorization, authorization);
      assert.equal(JSON.parse(rpc.options.body).p_page, 0);
    });
    await suite.test('honors database denials and validates filters', async () => {
      databaseAllowed = false;
      assert.equal((await admin(new Request(endpoint, { headers: { authorization: `Bearer ${token()}` } }))).status, 403);
      databaseAllowed = true;
      assert.equal((await admin(new Request(endpoint + '?page=-1', { headers: { authorization: `Bearer ${token()}` } }))).status, 400);
    });
    await suite.test('upstream failure returns a generic error without credentials', async () => {
      global.fetch = async () => { throw new Error('test-key'); };
      const response = await admin(new Request(endpoint, { headers: { authorization: `Bearer ${token()}` } }));
      assert.equal(response.status, 503);
      assert.ok(!(await response.text()).includes('test-key'));
    });
  } finally {
    global.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  }
});
