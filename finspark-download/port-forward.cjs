const http = require('http');

// Create a proxy server
const proxy = http.createServer((req, res) => {
  const options = {
    hostname: '127.0.0.1',
    port: 3000,
    path: req.url,
    method: req.method,
    headers: req.headers
  };
  
  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  
  proxyReq.on('error', (err) => {
    res.writeHead(502);
    res.end('Bad Gateway: ' + err.message);
  });
  
  req.pipe(proxyReq);
});

// Listen on 0.0.0.0 to accept external connections
proxy.listen(8080, '0.0.0.0', () => {
  console.log('Port forward running on 0.0.0.0:8080 -> localhost:3000');
});
