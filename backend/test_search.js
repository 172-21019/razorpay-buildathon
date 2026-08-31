const http = require('http');

function req(path, method, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : '';
    const r = http.request({
      hostname: 'localhost',
      port: 3006,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let response = '';
      res.on('data', d => response += d);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(response) }));
    });
    r.write(data);
    r.end();
  });
}

(async () => {
  const search1 = await req('/api/ai/search', 'POST', { message: 'find JBL headphones' });
  console.log('Search 1 (JBL headphones):');
  console.log('Top Pick:', search1.body.topPick ? search1.body.topPick.name : 'None');
  console.log('Alternatives:', search1.body.alternatives ? search1.body.alternatives.map(a => a.name) : 'None');

  const search2 = await req('/api/ai/search', 'POST', { message: 'find Sony products' });
  console.log('\nSearch 2 (Sony products):');
  console.log('Top Pick:', search2.body.topPick ? search2.body.topPick.name : 'None');
  console.log('Alternatives:', search2.body.alternatives ? search2.body.alternatives.map(a => a.name) : 'None');
})();
