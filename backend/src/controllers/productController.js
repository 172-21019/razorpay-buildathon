const { db, logAuditEvent } = require('../db');

exports.getProducts = (req, res) => {
  const { category, search } = req.query;
  let query = 'SELECT * FROM products WHERE brand IS NOT NULL';
  const params = [];

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }

  if (search) {
    query += ' AND name LIKE ?';
    params.push(`%${search}%`);
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to retrieve products' });
    }
    res.json(rows);
  });
};

exports.getProductById = (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM products WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to retrieve product' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(row);
  });
};

exports.getRelatedProducts = (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT category FROM products WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to retrieve product category' });
    }
    if (!row) {
      return res.json([]);
    }
    
    const query = 'SELECT * FROM products WHERE category = ? AND id != ? AND stock > 0 ORDER BY rating DESC LIMIT 2';
    db.all(query, [row.category, id], (err, relatedRows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to retrieve related products' });
      }
      
      if (relatedRows && relatedRows.length > 0) {
        const sessionId = req.headers['x-session-id'] || 'anonymous';
        logAuditEvent(sessionId, 'cross_sell_suggested', { category: row.category, originalProductId: id }, { suggestedProductIds: relatedRows.map(p => p.id) });
      }
      
      res.json(relatedRows || []);
    });
  });
};
