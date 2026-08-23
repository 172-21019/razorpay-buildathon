const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, '../../data/ecommerce.db');
const seedPath = path.resolve(__dirname, '../../data/seed.json');

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

module.exports = db;
