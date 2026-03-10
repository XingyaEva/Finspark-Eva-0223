const http = require('http');

const BACKEND_PORT = 3000;
const FRONTEND_PORT = 8080;

const proxy = http.createServer((req, res) => {
  const options = {
    hostname: '127.0.0.1',
    port: BACKEND_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers
  };
  
  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  
  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err.message);
    res.writeHead(502);
    res.end('Bad Gateway: ' + err.message);
  });
  
  req.pipe(proxyReq);
});

proxy.listen(FRONTEND_PORT, '0.0.0.0', () => {
  console.log(`Proxy running on 0.0.0.0:${FRONTEND_PORT} -> localhost:${BACKEND_PORT}`);
});

proxy.on('error', (err) => {
  console.error('Proxy server error:', err.message);
  process.exit(1);
});
