const { spawn } = require('child_process');
const net = require('net');
const http = require('http');

// Start wrangler on port 3001
const wrangler = spawn('npx', ['wrangler', 'pages', 'dev', 'dist', '--port', '3001', '--local-protocol', 'http', '--live-reload', 'false'], {
  cwd: '/home/user/webapp',
  stdio: 'inherit'
});

// Wait for wrangler to start then create HTTP proxy
setTimeout(() => {
  const proxy = http.createServer((req, res) => {
    const options = {
      hostname: '127.0.0.1',
      port: 3001,
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
      res.end('Bad Gateway');
    });
    
    req.pipe(proxyReq);
  });

  proxy.listen(3000, '0.0.0.0', () => {
    console.log('HTTP Proxy listening on 0.0.0.0:3000 -> localhost:3001');
  });
}, 8000);

wrangler.on('close', (code) => {
  console.log('Wrangler exited with code:', code);
  process.exit(code);
});
