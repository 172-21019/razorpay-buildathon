const http = require('http');
function makeReq(method, path, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: data ? {
        'Content-Type': 'application/json',
        'Content-Length': data.length
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
  const audit = await makeReq('GET', '/api/audit');
  const orderId = audit.find(l => l.event_type === 'payment_link_created').session_id;
  
  console.log('Testing Verify Payment...');
  const verifyRes = await makeReq('POST', '/api/orders/' + orderId + '/verify-payment');
  console.log('Verify Msg:', verifyRes.message);
  
  const auditRes2 = await makeReq('GET', '/api/audit/' + orderId);
  console.log('Audit 2:', auditRes2.map(l => l.event_type));
})();

