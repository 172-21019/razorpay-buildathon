const { db, logAuditEvent } = require('../db');
const crypto = require('crypto');
const Razorpay = require('razorpay');

// Initialize Razorpay SDK (will use env vars)
// Ensure these keys are present in your backend/.env
let razorpayInstance = null;
const getRazorpay = () => {
  if (!razorpayInstance) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      console.warn("Razorpay keys missing from .env");
    }
    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  }
  return razorpayInstance;
};

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
    const orderStatus = 'pending'; // Set as pending instead of paid!
    
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
      
      // Stock deduction is REMOVED from here. Will be deducted in verifyPayment.
    }

    await run('COMMIT');
    
    logAuditEvent(orderId, 'order_created', { items, address }, { orderId, totalAmount, status: orderStatus });

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
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Failed to retrieve order' });
  }
};

exports.createPayment = async (req, res) => {
  const { id } = req.params;

  try {
    const order = await get('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Ensure we don't recreate links if order is already paid
    if (order.status === 'paid') {
      return res.status(400).json({ error: 'Order is already paid' });
    }

    const rzp = getRazorpay();

    // Prevent duplicate link creation if an active link exists
    if (order.razorpay_payment_link_id) {
      const currentTimestamp = Math.floor(Date.now() / 1000);
      
      // If the link has NOT expired, and the order is not marked cancelled, reuse it
      if (order.razorpay_payment_link_expires_at > currentTimestamp && order.status !== 'cancelled') {
        // Double check status from razorpay just in case it was cancelled on razorpay side
        const existingLink = await rzp.paymentLink.fetch(order.razorpay_payment_link_id);
        
        if (existingLink.status !== 'cancelled' && existingLink.status !== 'expired') {
          return res.json({
            paymentLinkId: order.razorpay_payment_link_id,
            shortUrl: order.razorpay_payment_link_url,
            expiresAt: order.razorpay_payment_link_expires_at
          });
        }
      }
    }

    // Otherwise, create a NEW Payment Link
    // Razorpay requires expire_by to be AT LEAST 15 minutes in the future. We add a 1 minute buffer.
    const expiresAt = Math.floor(Date.now() / 1000) + 960; // 16 minutes

    const paymentLinkRequest = {
      amount: order.total_amount * 100, // Razorpay takes amount in subunits (paise)
      currency: "INR",
      reference_id: order.id + '_' + Date.now(), // Unique reference ID per attempt
      description: "Payment for Order " + order.id,
      expire_by: expiresAt,
      customer: {
        name: order.customer_name || "Guest",
        contact: order.phone_number || ""
      }
    };

    const paymentLink = await rzp.paymentLink.create(paymentLinkRequest);

    // Save link info to the database
    await run(
      'UPDATE orders SET razorpay_payment_link_id = ?, razorpay_payment_link_url = ?, razorpay_payment_link_expires_at = ?, status = ? WHERE id = ?',
      [paymentLink.id, paymentLink.short_url, expiresAt, 'pending', id]
    );

    logAuditEvent(id, 'payment_link_created', { orderId: id, amount: paymentLinkRequest.amount / 100 }, { razorpay_payment_link_id: paymentLink.id, expires_at: expiresAt });

    res.json({
      paymentLinkId: paymentLink.id,
      shortUrl: paymentLink.short_url,
      expiresAt: expiresAt
    });

  } catch (error) {
    console.error('Create payment link error:', error);
    res.status(500).json({ error: 'Failed to create payment link' });
  }
};

exports.verifyPayment = async (req, res) => {
  const { id } = req.params;

  try {
    const order = await get('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.status === 'paid') {
      return res.json({ status: 'paid', message: 'Order is already paid' });
    }

    if (!order.razorpay_payment_link_id) {
      return res.status(400).json({ error: 'No payment link associated with this order' });
    }

    // Call Razorpay to verify true status
    const rzp = getRazorpay();
    const paymentLink = await rzp.paymentLink.fetch(order.razorpay_payment_link_id);
    
    logAuditEvent(id, 'payment_verification_checked', { orderId: id }, { razorpay_status: paymentLink.status, verified: paymentLink.status === 'paid' });

    if (paymentLink.status === 'paid') {
      // Payment confirmed! Now we update status and deduct stock atomically
      await run('BEGIN TRANSACTION');
      
      await run('UPDATE orders SET status = ? WHERE id = ?', ['paid', id]);
      
      const items = await all('SELECT * FROM order_items WHERE order_id = ?', [id]);
      for (const item of items) {
        await run(
          'UPDATE products SET stock = stock - ? WHERE id = ?',
          [item.quantity, item.product_id]
        );
      }
      
      await run('COMMIT');
      
      logAuditEvent(id, 'payment_confirmed', null, { orderId: id, finalStatus: 'paid' });

      return res.json({ status: 'paid', message: 'Payment successful' });
    } else {
      // Payment is pending, cancelled, or failed
      // Also update local status to cancelled if razorpay says cancelled, so next time they retry it creates a new link
      if (paymentLink.status === 'cancelled' || paymentLink.status === 'expired') {
          await run('UPDATE orders SET status = ? WHERE id = ?', [paymentLink.status, id]);
      }
      return res.json({ status: paymentLink.status, message: 'Payment not completed yet' });
    }

  } catch (error) {
    await run('ROLLBACK').catch(() => {});
    console.error('Verify payment error:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
};

exports.cancelPayment = async (req, res) => {
  const { id } = req.params;

  try {
    const order = await get('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.status === 'paid') {
      return res.status(400).json({ error: 'Order is already paid, cannot cancel' });
    }

    if (!order.razorpay_payment_link_id) {
      return res.status(400).json({ error: 'No payment link associated with this order' });
    }

    const rzp = getRazorpay();
    const paymentLink = await rzp.paymentLink.fetch(order.razorpay_payment_link_id);

    if (paymentLink.status === 'paid') {
      return res.status(400).json({ error: 'Payment is already completed. Please verify instead.' });
    }

    if (paymentLink.status !== 'cancelled') {
      await rzp.paymentLink.cancel(order.razorpay_payment_link_id);
    }

    // Update local order to cancelled, but keep the razorpay references
    await run('UPDATE orders SET status = ? WHERE id = ?', ['cancelled', id]);
    
    logAuditEvent(id, 'payment_cancelled', null, { orderId: id, razorpay_payment_link_id: order.razorpay_payment_link_id });
    
    res.json({ message: 'Payment link cancelled successfully' });
  } catch (error) {
    console.error('Cancel payment error:', error);
    res.status(500).json({ error: 'Failed to cancel payment' });
  }
};
