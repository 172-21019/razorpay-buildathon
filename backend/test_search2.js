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
  const search1 = await req('/api/ai/search', 'POST', { message: 'Find wireless headphones under 5000' });
  console.log('Search 1 (wireless headphones under 5000):');
  console.log('Top Pick:', search1.body.topPick ? search1.body.topPick.name : 'None');
  console.log('Alternatives:', search1.body.alternatives ? search1.body.alternatives.map(a => a.name) : 'None');
  console.log('Excluded:', search1.body.excludedByBudget ? search1.body.excludedByBudget.map(a => a.name) : 'None');
})();
