'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { exige } = require('./env');

const PROJECT = 'yvwdhuphzyjfhfsqdeho';
const apply = process.argv.includes('--apply');
const securityCheck = process.argv.includes('--security-check');
const migration = path.join(__dirname, '..', 'supabase', '04-admin.sql');
const query = securityCheck ? fs.readFileSync(path.join(__dirname, 'admin-security.sql'), 'utf8') : apply ? fs.readFileSync(migration, 'utf8') : `
  select
    (select count(*) from auth.users where lower(email) = 'kivoratv@gmail.com'
      and email_confirmed_at is not null) as admin_accounts,
    (select count(*) from public.profiles) as profiles,
    (select count(*) from public.subscriptions) as subscriptions;
`;

(async () => {
  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${exige('SUPABASE_ACCESS_TOKEN', 'administrar o banco')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, read_only: !apply && !securityCheck }),
    signal: AbortSignal.timeout(60000),
    redirect: 'error',
  });
  if (!response.ok) {
    console.error(`Supabase Management API: HTTP ${response.status}`);
    const failure = await response.json().catch(() => ({}));
    console.error(String(failure.message || failure.error || '').slice(0,400));
    process.exitCode = 1;
    return;
  }
  console.log(apply ? 'Migração administrativa aplicada.' : JSON.stringify(await response.json()));
})().catch((error) => {
  console.error(error.cause?.code || error.name);
  process.exitCode = 1;
});
