const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('../../data/ecommerce.db');
db.all('SELECT sql FROM sqlite_master WHERE type=\'table\'', (err, rows) => {
  rows.forEach(r => console.log(r.sql));
});
