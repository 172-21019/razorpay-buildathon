const db = require('../db');
const crypto = require('crypto');

// Utility to run queries as promises
const run = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const get = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const all = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

exports.createOrder = async (req, res) => {
  const { userId, items, address } = req.body;

  if (!userId || !items || !items.length) {
    return res.status(400).json({ error: 'userId and items are required' });
  }

  try {
    await run('BEGIN TRANSACTION');

    let totalAmount = 0;
    const validatedItems = [];

    // Check stock and calculate total
    for (const item of items) {
      const product = await get('SELECT * FROM products WHERE id = ?', [item.productId]);
      
      if (!product) {
        await run('ROLLBACK');
        return res.status(400).json({ error: `Product ${item.productId} not found` });
      }

      if (product.stock < item.quantity) {
        await run('ROLLBACK');
        return res.status(400).json({ error: `Insufficient stock for product ${product.name}` });
      }

      const discount = product.discount || 0;
      const finalPrice = Math.round(product.price * (1 - discount / 100));
      
      totalAmount += finalPrice * item.quantity;
      validatedItems.push({
        ...item,
        priceAtPurchase: finalPrice,
        name: product.name
      });
    }

    const orderId = 'ord-' + crypto.randomBytes(4).toString('hex');
    const orderStatus = 'paid'; // MOCK: Assume paid for Phase 1.5
    
    // Address fields
    const { customerName, addressLine, city, pincode, phoneNumber } = address || {};

    await run(
      `INSERT INTO orders (id, user_id, total_amount, status, customer_name, address_line, city, pincode, phone_number) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderId, userId, totalAmount, orderStatus, customerName, addressLine, city, pincode, phoneNumber]
    );

    for (const item of validatedItems) {
      const orderItemId = 'oi-' + crypto.randomBytes(4).toString('hex');
      
      await run(
        'INSERT INTO order_items (id, order_id, product_id, quantity, price_at_purchase) VALUES (?, ?, ?, ?, ?)',
        [orderItemId, orderId, item.productId, item.quantity, item.priceAtPurchase]
      );

      // Deduct stock atomically
      await run(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [item.quantity, item.productId]
      );
    }

    await run('COMMIT');

    res.status(201).json({
      message: 'Order created successfully',
      order: {
        id: orderId,
        userId,
        totalAmount,
        status: orderStatus,
        items: validatedItems,
        address
      }
    });

  } catch (error) {
    await run('ROLLBACK').catch(() => {}); // Ignore rollback error if it fails
    console.error('Order creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getOrderById = async (req, res) => {
  const { id } = req.params;
  
  try {
    const order = await get('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const items = await all('SELECT * FROM order_items WHERE order_id = ?', [id]);
    
    res.json({
      ...order,
      items
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
