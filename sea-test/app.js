const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('SEA works!');
});
server.listen(3100, () => console.log('SEA test server on 3100'));
