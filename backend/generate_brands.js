const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const seedPath = path.resolve('C:\\Users\\kmano\\.gemini\\antigravity\\scratch\\razorpay-buildathon\\backend\\data\\seed.json');
const dbPath = path.resolve('C:\\Users\\kmano\\.gemini\\antigravity\\scratch\\razorpay-buildathon\\backend\\data\\ecommerce.db');

const originalSeed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

const brandsMap = {
  'p1': ['JBL', 'Sony', 'boAt', 'Noise', 'Sennheiser'],
  'p2': ['Logitech', 'Razer', 'Corsair', 'Keychron'],
  'p3': ['Herman Miller', 'Steelcase', 'IKEA', 'SIHOO'],
  'p4': ['Milton', 'Cello', 'Yeti', 'Hydro Flask'],
  'p5': ['Liforme', 'Manduka', 'Gaiam', 'Decathlon'],
  'p6': ['JBL', 'Sony', 'Bose', 'Marshall'],
  'p7': ['Bowflex', 'Core Fitness', 'PowerBlock', 'Decathlon'],
  'p8': ['Philips', 'Xiaomi', 'Wipro', 'Syska'],
  'p9': ['Bombay Dyeing', 'Spaces', 'Portico', 'DDecor'],
  'p10': ['Theraband', 'Decathlon', 'Boldfit', 'Nivia'],
  'p11': ['Apple', 'Samsung', 'Noise', 'Amazfit', 'Garmin'],
  'p12': ['Nespresso', 'Philips', 'Morphy Richards', 'DeLonghi'],
  'p13': ['Wildcraft', 'American Tourister', 'Skybags', 'Safari'],
  'p14': ['Nike', 'Adidas', 'Puma', 'Reebok', 'Asics'],
  'p15': ['Ray-Ban', 'Fastrack', 'Oakley', 'Lenskart', 'Polaroid']
};

let newProducts = [];
let idCounter = 100;

for (let p of originalSeed) {
  let brands = brandsMap[p.id];
  if (brands) {
    brands.forEach((brand, idx) => {
      let variant = {
        id: `p${idCounter++}`,
        name: `${brand} ${p.name}`,
        brand: brand,
        category: p.category,
        price: Math.round(p.price * (0.8 + Math.random() * 0.6)), // +-20-40% variance
        stock: Math.floor(Math.random() * 50) + 10,
        rating: Math.round((4.0 + Math.random() * 0.9) * 10) / 10,
        discount: Math.floor(Math.random() * 5) * 5 // 0, 5, 10, 15, 20
      };
      // Keep price rounded nicely
      variant.price = Math.floor(variant.price / 100) * 100 + 99;
      if (variant.price < 99) variant.price = 99;
      newProducts.push(variant);
    });
  }
}

const existingIds = new Set(originalSeed.map(p => p.id));
const filteredNew = newProducts.filter(p => !existingIds.has(p.id));

const finalSeed = [...originalSeed, ...filteredNew];
fs.writeFileSync(seedPath, JSON.stringify(finalSeed, null, 2));

const db = new sqlite3.Database(dbPath);
db.serialize(() => {
  db.run('ALTER TABLE products ADD COLUMN brand TEXT', (err) => {
    // Ignore error if column exists
  });
  
  const stmt = db.prepare('INSERT OR IGNORE INTO products (id, name, brand, category, price, stock, rating, discount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  
  finalSeed.forEach(p => {
    stmt.run(p.id, p.name, p.brand || null, p.category, p.price, p.stock, p.rating, p.discount || 0);
  });
  
  stmt.finalize();
  console.log('Finished updating DB and seed.json with', filteredNew.length, 'branded products');
});
