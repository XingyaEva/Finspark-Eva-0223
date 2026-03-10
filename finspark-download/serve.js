const { spawn } = require('child_process');
const net = require('net');

// Start wrangler
const wrangler = spawn('npx', ['wrangler', 'pages', 'dev', 'dist', '--port', '3001', '--local-protocol', 'http', '--live-reload', 'false'], {
  cwd: '/home/user/webapp',
  stdio: 'inherit'
});

// Create a proxy server that listens on 0.0.0.0:3000 and forwards to localhost:3001
const proxy = net.createServer((clientSocket) => {
  const serverSocket = net.connect(3001, '127.0.0.1', () => {
    clientSocket.pipe(serverSocket);
    serverSocket.pipe(clientSocket);
  });
  
  serverSocket.on('error', (err) => {
    console.error('Server socket error:', err.message);
    clientSocket.destroy();
  });
  
  clientSocket.on('error', (err) => {
    console.error('Client socket error:', err.message);
    serverSocket.destroy();
  });
});

setTimeout(() => {
  proxy.listen(3000, '0.0.0.0', () => {
    console.log('Proxy listening on 0.0.0.0:3000 -> localhost:3001');
  });
}, 5000);

wrangler.on('close', (code) => {
  console.log('Wrangler exited with code:', code);
  proxy.close();
  process.exit(code);
});
