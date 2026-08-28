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
  console.log('Testing AI Search...');
  const aiRes = await makeReq('POST', '/api/ai/search', { message: 'find headphones under 5000' });
  console.log('AI Search MatchType:', aiRes.matchType);
  
  console.log('Testing Audit...');
  const auditRes1 = await makeReq('GET', '/api/audit');
  console.log('Audit 1:', auditRes1.map(l => l.event_type));
  
  console.log('Testing Order Creation...');
  const orderRes = await makeReq('POST', '/api/orders', { userId: '123', items: [{ productId: 'p1', quantity: 1 }], address: {} });
  console.log('Order Msg:', orderRes.message);
  
  const orderId = orderRes.order.id;
  
  console.log('Testing Payment Link...');
  const paymentRes = await makeReq('POST', '/api/orders/' + orderId + '/create-payment');
  console.log('Payment Link ID:', paymentRes.paymentLinkId);
  
  console.log('Testing Audit again...');
  const auditRes2 = await makeReq('GET', '/api/audit/' + orderId);
  console.log('Audit 2:', auditRes2.map(l => l.event_type));
})();

