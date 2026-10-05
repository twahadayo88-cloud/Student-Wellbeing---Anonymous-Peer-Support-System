/* Scratch: smoke-test the live API — public + auth-required endpoints. */
const http = require('http');

function req(path, method = 'GET', token = null, body = null) {
  return new Promise(resolve => {
    const options = {
      host: 'localhost', port: 5000, path: `/api${path}`, method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 8000,
    };
    if (token) options.headers.Authorization = `Bearer ${token}`;
    const r = http.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data.slice(0, 200) }));
    });
    r.on('error', e => resolve({ status: 'ERR', body: e.message }));
    r.on('timeout', () => { r.destroy(); resolve({ status: 'TIMEOUT', body: '' }); });
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

(async () => {
  const checks = [
    ['/health', 'GET'],
    ['/auth/login', 'POST', null, { email: 'smoke_nonexistent@example.com', password: 'x' }],
    ['/mood/aggregated', 'GET'],          // should be 401/403 without token
    ['/resources', 'GET'],                 // should be 401
    ['/academic/requests', 'GET'],         // should be 401
    ['/notices', 'GET'],                   // should be 401
    ['/trust/leaderboard', 'GET'],         // should be 401
    ['/communication/messages', 'POST', null, {}], // documented stub
  ];
  for (const [p, m, t, b] of checks) {
    const r = await req(p, m, t, b);
    console.log(`${m.padEnd(4)} ${p.padEnd(30)} → ${r.status}  ${r.body.replace(/\s+/g, ' ').slice(0, 100)}`);
  }
})();
