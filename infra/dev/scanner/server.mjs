import { createServer } from 'node:http';

const maxBytes = 12 * 1024 * 1024;

createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: true }));
    return;
  }
  if (request.method !== 'POST' || request.url !== '/scan') {
    response.writeHead(404).end();
    return;
  }

  const chunks = [];
  let size = 0;
  request.on('data', (chunk) => {
    size += chunk.length;
    if (size > maxBytes) request.destroy();
    else chunks.push(chunk);
  });
  request.on('end', () => {
    const content = Buffer.concat(chunks).toString('utf8');
    const clean = !content.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE');
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({
      clean,
      detail: clean ? 'simulation scanner: clean' : 'simulation scanner: quarantined test signature',
    }));
  });
}).listen(8080, '0.0.0.0');
