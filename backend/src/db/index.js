const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.resolve(__dirname, '../../data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.resolve(dbDir, 'ecommerce.db');
const seedPath = path.resolve(dbDir, 'seed.json');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  }
});

const initializeDb = () => {
  db.serialize(() => {
    // Create Tables
    db.run(`CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT,
      category TEXT,
      price INTEGER,
      stock INTEGER,
      rating REAL,
      discount INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      total_amount INTEGER,
      status TEXT,
      customer_name TEXT,
      address_line TEXT,
      city TEXT,
      pincode TEXT,
      phone_number TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT,
      product_id TEXT,
      quantity INTEGER,
      price_at_purchase INTEGER,
      FOREIGN KEY (order_id) REFERENCES orders (id),
      FOREIGN KEY (product_id) REFERENCES products (id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS agent_audit_log (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      event_type TEXT,
      input TEXT,
      output TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Seed Data if empty
    db.get('SELECT COUNT(*) as count FROM products', (err, row) => {
      if (err) {
        console.error('Error checking products count', err);
        return;
      }
      
      if (row.count === 0) {
        console.log('Seeding products...');
        const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
        const stmt = db.prepare('INSERT INTO products (id, name, category, price, stock, rating, discount) VALUES (?, ?, ?, ?, ?, ?, ?)');
        
        seedData.forEach(p => {
          stmt.run(p.id, p.name, p.category, p.price, p.stock, p.rating, p.discount || 0);
        });
        
        stmt.finalize();
        console.log('Seeding completed.');
      }
    });
  });
};

initializeDb();

const logAuditEvent = (sessionId, eventType, input, output) => {
  return new Promise((resolve) => {
    try {
      const crypto = require('crypto');
      const id = crypto.randomUUID();
      const inputStr = typeof input === 'object' ? JSON.stringify(input) : input;
      const outputStr = typeof output === 'object' ? JSON.stringify(output) : output;
      
      db.run(
        'INSERT INTO agent_audit_log (id, session_id, event_type, input, output) VALUES (?, ?, ?, ?, ?)',
        [id, sessionId, eventType, inputStr, outputStr],
        (err) => {
          if (err) console.error('Failed to write audit log:', err.message);
          resolve(); // Never reject to avoid breaking app logic
        }
      );
    } catch (err) {
      console.error('Failed to process audit log:', err.message);
      resolve();
    }
  });
};

module.exports = { db, logAuditEvent };
