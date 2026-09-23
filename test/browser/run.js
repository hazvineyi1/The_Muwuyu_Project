// The browser suites, each against the server it actually needs.
//
// WHY THIS EXISTS. These suites were not failing. They were unrunnable, which
// looks exactly the same from outside and is worse, because it goes unnoticed:
// six of them sat red for want of an environment variable nobody was setting.
// Each one carries its own instructions in its header — serve `public` on a
// static port for this one, a real server with a passphrase for that one, the
// same but with MW_PUBLIC_READ=on for another — and a set of instructions that
// has to be read and followed by hand is a set of instructions that stops
// being followed. This is test/run.js for the other half of the tests.
//
//   TEST_DATABASE_URL=postgres://... APP_PASSPHRASE=whatever \
//     NODE_PATH=$(npm root -g) node test/browser/run.js [name ...]
//
// Chromium comes from MW_CHROMIUM, or the path test/browser/lib.js defaults
// to. `playwright` has to be resolvable — NODE_PATH is the usual way, since
// this project keeps its own dependency list down to two.

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const ROOT = path.join(__dirname, '..', '..');

/* WHAT EACH SUITE NEEDS, which until now lived only in its header comment.
 *
 *   api     a real server, a database of its own, and the passphrase gate —
 *           which the suites go through by filling the form in, so the gate
 *           stays honest rather than being bypassed with a forged cookie
 *   static  the page served as files and no API at all, which is how the
 *           local-only mode is exercised: /api/home answers 404 and the page
 *           keeps the tree in the browser
 *
 * `env` is added to the server's environment; `needs` names a variable the
 * suite cannot run without, so a missing one is reported as skipped rather
 * than failed. A suite that is skipped has not passed. */
const SUITES = [
  { name: 'concurrent',   kind: 'api' },
  { name: 'connection',   kind: 'api' },
  { name: 'families',     kind: 'api' },
  { name: 'halfsiblings', kind: 'api' },
  { name: 'multifamily',  kind: 'api' },
  { name: 'newcomer',     kind: 'api' },
  { name: 'persistence',  kind: 'api' },
  /* Removing somebody needs a passcode, and the server is the one that
     decides — so this suite's server is the only one given one. See
     db/passcode.js; the value is a test value and means nothing anywhere. */
  { name: 'removing',     kind: 'api',
    env: { MW_DELETE_PASSCODE: process.env.MW_DELETE_PASSCODE || 'browser-delete-code' } },
  { name: 'scale',        kind: 'api' },
  { name: 'viewer',       kind: 'api' },
  { name: 'visibility',   kind: 'api', env: { MW_PUBLIC_READ: 'on' } },
  { name: 'keeper',       kind: 'api', needs: 'MW_ADMIN_PASSPHRASE',
    env: { MW_ADMIN_PASSPHRASE: process.env.MW_ADMIN_PASSPHRASE } },
  { name: 'buds',         kind: 'static' },
  { name: 'correcting',   kind: 'static' },
  { name: 'lines',        kind: 'static' },
  { name: 'look',         kind: 'static' },
  { name: 'roots',        kind: 'static' },
  { name: 'setaside',     kind: 'static' }
];

const PORT = Number(process.env.MW_TEST_PORT || 3940);
const PASSPHRASE = process.env.APP_PASSPHRASE || 'browser-suite';

const TYPES = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',   '.json':'application/json; charset=utf-8',
  '.webp':'image/webp', '.png':'image/png', '.jpg':'image/jpeg',
  '.svg':'image/svg+xml', '.ico':'image/x-icon', '.woff2':'font/woff2'
};

/* The static case, in twenty lines rather than a dependency. It serves
   `public` and answers 404 to everything it does not hold — including
   /api/home, which is exactly the answer the page needs to decide it is on
   its own. */
function serveStatic(port) {
  const dir = path.join(ROOT, 'public');
  const server = http.createServer((req, res) => {
    const asked = decodeURIComponent((req.url || '/').split('?')[0]);
    const rel = asked === '/' ? 'index.html' : asked.replace(/^\/+/, '');
    const file = path.join(dir, rel);
    // Nothing outside `public`, however the path is spelled.
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('not here');
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(port, '127.0.0.1', () => r(server)));
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitForServer(port, { seconds = 30 } = {}) {
  const until = Date.now() + seconds * 1000;
  for (;;) {
    const up = await new Promise(r => {
      const req = http.get({ host: '127.0.0.1', port, path: '/', timeout: 1000 },
                           res => { res.resume(); r(true); });
      req.on('error', () => r(false));
      req.on('timeout', () => { req.destroy(); r(false); });
    });
    if (up) return true;
    if (Date.now() > until) return false;
    await sleep(300);
  }
}

async function freshDatabase(admin, name) {
  const url = new URL(admin);
  const root = new Client({ connectionString: new URL('/postgres', url).href });
  await root.connect();
  await root.query(`DROP DATABASE IF EXISTS ${name}`);
  await root.query(`CREATE DATABASE ${name}`);
  await root.end();
  const target = new URL(admin);
  target.pathname = '/' + name;
  return target.href;
}

/* A suite's own output is the report — it prints its oks and FAILs and a
   count. All this adds is whether the process came back happy, so the two
   cannot disagree.
 *
 * SPAWNED RATHER THAN RUN SYNCHRONOUSLY, and that is not a style choice. The
 * static server for the file-served suites lives in THIS process, so blocking
 * this event loop for the length of a suite means the server never answers a
 * single request — the page waits thirty seconds for a document that is
 * sitting right here and the suite fails for want of the thing it was given. */
function runSuite(name, extraEnv) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [path.join(__dirname, name + '.js')], {
      stdio: 'inherit',
      env: { ...process.env, MW_BASE_URL: `http://127.0.0.1:${PORT}/`,
             APP_PASSPHRASE: PASSPHRASE, ...extraEnv }
    });
    child.on('close', code => resolve(code === 0));
    child.on('error', () => resolve(false));
  });
}

(async () => {
  const admin = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  const wanted = process.argv.slice(2);
  const list = wanted.length
    ? SUITES.filter(s => wanted.includes(s.name))
    : SUITES;
  if (wanted.length && list.length !== wanted.length) {
    const known = SUITES.map(s => s.name).join(', ');
    console.error(`Unknown suite. There are: ${known}`);
    process.exit(2);
  }
  if (list.some(s => s.kind === 'api') && !admin) {
    console.error('TEST_DATABASE_URL (or DATABASE_URL) must be set: the api ' +
                  'suites each get a database of their own.');
    process.exit(2);
  }

  let failed = 0, skipped = 0;
  for (const suite of list) {
    console.log(`\n${'='.repeat(60)}\n${suite.name} (${suite.kind})\n${'='.repeat(60)}`);

    if (suite.needs && !process.env[suite.needs]) {
      console.log(`  skipped — ${suite.needs} is not set, and this suite is ` +
                  `about what that unlocks.`);
      skipped++;
      continue;
    }

    let server = null, child = null;
    try {
      if (suite.kind === 'static') {
        server = await serveStatic(PORT);
      } else {
        const dbUrl = await freshDatabase(admin, 'muti_b_' + suite.name.replace(/\W/g, '_'));
        child = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
          cwd: ROOT, stdio: 'ignore',
          env: { ...process.env, PORT: String(PORT), DATABASE_URL: dbUrl,
                 APP_PASSPHRASE: PASSPHRASE, ...(suite.env || {}) }
        });
        if (!await waitForServer(PORT)) throw new Error('the server never answered');
      }
      const won = await runSuite(suite.name,
        suite.kind === 'api' ? {} : { APP_PASSPHRASE: '' });
      if (!won) failed++;
    } catch (e) {
      console.log(`  FAIL could not run it — ${e.message}`);
      failed++;
    } finally {
      if (child) { child.kill('SIGTERM'); await sleep(400); child.kill('SIGKILL'); }
      if (server) await new Promise(r => server.close(r));
      await sleep(300);          // the port, given back before the next one asks
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(failed ? `${failed} suite(s) FAILED` +
                       (skipped ? `, ${skipped} skipped` : '')
                     : `all browser suites passed` +
                       (skipped ? ` (${skipped} skipped)` : ''));
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
