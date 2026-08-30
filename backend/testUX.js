const http = require('http');
function makeReq(method, path, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: 'localhost',
      port: 3005,
      path: path,
      method: method,
      headers: data ? {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      } : {}
    }, (res) => {
      let response = '';
      res.on('data', d => response += d);
      res.on('end', () => resolve(JSON.parse(response)));
    });
    if (data) req.write(data);
    req.end();
  });
}
(async () => {
  console.log('Testing AI Search for sunglasses under 200...');
  const res1 = await makeReq('POST', '/api/ai/search', { message: 'sunglasses under 200' });
  console.log('MatchType:', res1.matchType);
  console.log('Excluded count:', res1.excludedByBudget?.length);
  if (res1.excludedByBudget?.length > 0) {
    console.log('Excluded items:', res1.excludedByBudget.map(i => i.name + ' - ' + i.finalPrice));
  }
  console.log('Message:', res1.message);
  
  console.log('\nTesting AI Search for shoes...');
  const res2 = await makeReq('POST', '/api/ai/search', { message: 'shoes' });
  console.log('MatchType:', res2.matchType);
  
  console.log('\nChecking Audit Log...');
  const audit = await makeReq('GET', '/api/audit');
  const intent1 = audit.find(l => l.event_type === 'intent_parsed' && l.input === 'sunglasses under 200');
  const intent2 = audit.find(l => l.event_type === 'intent_parsed' && l.input === 'shoes');
  console.log('Sunglasses intent parsed:', intent1?.output);
  console.log('Shoes intent parsed:', intent2?.output);
})();

