import { useState, useEffect, useMemo } from 'react';
import './App.css';
import AIAgentButton from './AIAgentButton';

const API_BASE = '/api';

function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // App State
  const [currentView, setCurrentView] = useState('catalog'); // catalog, detail, cart, checkout, confirmation
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [cart, setCart] = useState([]);
  const [orderData, setOrderData] = useState(null);

  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [aiSearchResult, setAiSearchResult] = useState(null);

  // Payment UI State
  const [paymentLinkData, setPaymentLinkData] = useState(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (currentView === 'payment_verification' && paymentLinkData) {
      const timer = setInterval(() => {
        const now = Math.floor(Date.now() / 1000);
        const remaining = paymentLinkData.expiresAt - now;
        if (remaining <= 0) {
          setCountdown(0);
          clearInterval(timer);
        } else {
          setCountdown(remaining);
        }
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [currentView, paymentLinkData]);
  
  // Checkout Form State
  const [checkoutForm, setCheckoutForm] = useState({
    customerName: '',
    addressLine: '',
    city: '',
    pincode: '',
    phoneNumber: ''
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/products`);
      if (!res.ok) throw new Error('Failed to fetch products');
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getFinalPrice = (product) => {
    if (!product.discount) return product.price;
    return Math.round(product.price * (1 - product.discount / 100));
  };

  // ----- VIEW: CATALOG -----
  const filteredProducts = useMemo(() => {
    if (aiSearchResult) {
      if (aiSearchResult.matchType === 'found') {
        const aiIds = new Set([
          aiSearchResult.topPick?.id,
          ...(aiSearchResult.alternatives?.map(a => a.id) || [])
        ].filter(Boolean));
        return products.filter(p => aiIds.has(p.id));
      } else {
        return [];
      }
    }
    if (!searchTerm) return products;
    return products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [products, searchTerm, aiSearchResult]);

  // ----- ACTIONS -----
  const addToCart = (product, quantity) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });
    alert('Added to cart!');
  };

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateCartQuantity = (productId, delta) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQ = Math.max(1, item.quantity + delta);
        // We ensure we don't exceed stock
        const finalQ = Math.min(newQ, item.product.stock);
        return { ...item, quantity: finalQ };
      }
      return item;
    }));
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    try {
      // Step 1: Create Order as pending
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'demo_user',
          items: cart.map(item => ({ productId: item.product.id, quantity: item.quantity })),
          address: checkoutForm
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to place order');
      
      const newOrder = data.order;
      setOrderData(newOrder);

      // Step 2: Create Payment Link
      const paymentRes = await fetch(`${API_BASE}/orders/${newOrder.id}/create-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const paymentData = await paymentRes.json();
      
      if (!paymentRes.ok) throw new Error(paymentData.error || 'Failed to create payment link');

      setPaymentLinkData(paymentData);

      // Open Razorpay payment link automatically
      window.open(paymentData.shortUrl, '_blank');
      
      // Move to verification view
      setCurrentView('payment_verification');
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleVerifyPayment = async () => {
    if (!orderData) return;
    try {
      const res = await fetch(`${API_BASE}/orders/${orderData.id}/verify-payment`, {
        method: 'POST'
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to verify payment');
      
      if (data.status === 'paid') {
        // Payment successful
        setOrderData(prev => ({ ...prev, status: 'paid' }));
        setCart([]); // Clear cart only after payment is confirmed
        setCurrentView('confirmation');
        fetchProducts(); // Refresh stock in background
      } else {
        alert('Payment not yet confirmed. Please complete the payment on the Razorpay page and try again. Status: ' + data.status);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleCancelPayment = async () => {
    if (!orderData) return;
    try {
      const res = await fetch(`${API_BASE}/orders/${orderData.id}/cancel-payment`, {
        method: 'POST'
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to cancel payment');
      
      // Return to checkout or cart
      setCurrentView('checkout');
      setPaymentLinkData(null);
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // ----- CALCULATIONS -----
  const cartTotals = useMemo(() => {
    let subtotal = 0; // Price without discount
    let finalTotal = 0; // Price with discount
    
    cart.forEach(item => {
      subtotal += item.product.price * item.quantity;
      finalTotal += getFinalPrice(item.product) * item.quantity;
    });

    return { subtotal, finalTotal, discountSaved: subtotal - finalTotal };
  }, [cart]);

  // ----- RENDERERS -----
  if (loading) return <div className="container">Loading products...</div>;
  if (error) return <div className="container">Error: {error}</div>;

  return (
    <div className="container">
      <header>
        <div className="header-top">
          <div>
            <h1>Mock E-commerce Store</h1>
            <p>Phase 1.5 Prototype</p>
          </div>
          <button className="cart-btn" onClick={() => setCurrentView('cart')}>
            🛒 Cart ({cart.reduce((acc, item) => acc + item.quantity, 0)})
          </button>
        </div>
      </header>

      {currentView === 'catalog' && (
        <div className="view-catalog">
          <div className="search-bar">
            <input 
              type="text" 
              placeholder="Search products by name..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="product-grid">
            {filteredProducts.length === 0 ? (
              <div style={{ textAlign: 'center', gridColumn: '1 / -1', padding: '40px 0', color: '#666' }}>
                <p>Sorry, product not found..</p>
              </div>
            ) : (
              filteredProducts.map(product => {
                const finalPrice = getFinalPrice(product);
              const cartItem = cart.find(item => item.product.id === product.id);
              const quantityInCart = cartItem ? cartItem.quantity : 0;

              const isTopPick = aiSearchResult?.topPick?.id === product.id;
              const isAlternative = aiSearchResult?.alternatives?.some(a => a.id === product.id);

              return (
                <div 
                  key={product.id} 
                  className={`product-card ${isTopPick ? 'ai-top-pick' : ''}`}
                  style={isTopPick ? { border: '2px solid #6366f1' } : {}}
                >
                  {isTopPick && <span style={{ position: 'absolute', top: '-10px', left: '10px', background: '#6366f1', color: '#fff', fontSize: '11px', padding: '3px 8px', borderRadius: '12px', fontWeight: 'bold', zIndex: 1 }}>✨ AI Pick</span>}
                  {isAlternative && !isTopPick && <span style={{ position: 'absolute', top: '-10px', left: '10px', background: '#e0e7ff', color: '#4f46e5', fontSize: '11px', padding: '3px 8px', borderRadius: '12px', fontWeight: 'bold', zIndex: 1 }}>Alternative</span>}
                  {product.discount > 0 && <span className="discount-badge">{product.discount}% OFF</span>}
                  <h3>{product.name}</h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '0.9em', color: '#666' }}>
                    <span className="category">{product.category}</span>
                    <span className="rating">⭐ {product.rating}</span>
                  </div>
                  <div className="bottom-row" style={{ marginBottom: '12px' }}>
                    <span className="price">
                      {product.discount > 0 && <span className="old-price">₹{product.price}</span>}
                      ₹{finalPrice}
                    </span>
                    <span className={`stock ${product.stock === 0 ? 'out-of-stock' : ''}`}>
                      {product.stock > 0 ? `${product.stock} left` : 'Out of Stock'}
                    </span>
                  </div>
                  
                  <div className="card-cart-controls" style={{ display: 'flex', justifyContent: 'center' }}>
                    {quantityInCart === 0 ? (
                      <button 
                        onClick={() => addToCart(product, 1)} 
                        disabled={product.stock === 0}
                        className="primary-btn"
                        style={{ width: '100%', padding: '8px' }}
                      >
                        {product.stock > 0 ? 'Add to Cart' : 'Out of Stock'}
                      </button>
                    ) : (
                      <div className="quantity-controls" style={{ margin: '0', display: 'flex', width: '100%', justifyContent: 'space-between' }}>
                         <button onClick={() => {
                           if (quantityInCart <= 1) {
                             removeFromCart(product.id);
                           } else {
                             updateCartQuantity(product.id, -1);
                           }
                         }}>-</button>
                         <span>{quantityInCart}</span>
                         <button onClick={() => updateCartQuantity(product.id, 1)} disabled={quantityInCart >= product.stock}>+</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            }))}
          </div>
          <AIAgentButton onSearchResult={setAiSearchResult} onClear={() => setAiSearchResult(null)} />
        </div>
      )}

      {currentView === 'detail' && selectedProduct && (
        <div className="product-detail">
          <button onClick={() => setCurrentView('catalog')} className="text-btn">&larr; Back to catalog</button>
          <h2>{selectedProduct.name}</h2>
          <div className="detail-meta">
            <span className="category">{selectedProduct.category}</span>
            <span className="rating">⭐ {selectedProduct.rating}</span>
          </div>
          
          <div className="price-container">
            {selectedProduct.discount > 0 && <span className="old-price">₹{selectedProduct.price}</span>}
            <span className="price">₹{getFinalPrice(selectedProduct)}</span>
          </div>

          <p className="stock">Stock: {selectedProduct.stock} units available</p>
          
          {selectedProduct.stock > 0 && (
            <div className="quantity-controls">
               <button onClick={() => setSelectedProduct(p => ({...p, selectedQuantity: Math.max(1, p.selectedQuantity - 1)}))}>-</button>
               <span>{selectedProduct.selectedQuantity}</span>
               <button onClick={() => setSelectedProduct(p => ({...p, selectedQuantity: Math.min(p.stock, p.selectedQuantity + 1)}))}>+</button>
            </div>
          )}

          <button 
            onClick={() => addToCart(selectedProduct, selectedProduct.selectedQuantity)} 
            disabled={selectedProduct.stock === 0}
            className="primary-btn"
          >
            {selectedProduct.stock > 0 ? 'Add to Cart' : 'Out of Stock'}
          </button>
        </div>
      )}

      {currentView === 'cart' && (
        <div className="cart-view" style={{ paddingBottom: '100px' }}>
          <button onClick={() => setCurrentView('catalog')} className="text-btn">&larr; Continue Shopping</button>
          <h2>Your Cart</h2>
          {cart.length === 0 ? (
            <p>Your cart is empty.</p>
          ) : (
            <>
              <div className="cart-items">
                {cart.map((item) => {
                  const finalPrice = getFinalPrice(item.product);
                  return (
                    <div key={item.product.id} className="cart-item">
                      <div className="cart-item-info">
                        <h4>{item.product.name}</h4>
                        <p>₹{finalPrice} each</p>
                      </div>
                      <div className="cart-item-actions">
                        <div className="quantity-controls small">
                          <button onClick={() => updateCartQuantity(item.product.id, -1)}>-</button>
                          <span>{item.quantity}</span>
                          <button onClick={() => updateCartQuantity(item.product.id, 1)}>+</button>
                        </div>
                        <span className="line-total">₹{finalPrice * item.quantity}</span>
                        <button onClick={() => removeFromCart(item.product.id)} className="text-btn remove-btn">Remove</button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="cart-summary">
                <h3>Subtotal: ₹{cartTotals.finalTotal}</h3>
                <button onClick={() => setCurrentView('checkout')} className="primary-btn checkout-btn">Proceed to Checkout</button>
              </div>
            </>
          )}
          <AIAgentButton onSearchResult={setAiSearchResult} onClear={() => setAiSearchResult(null)} />
        </div>
      )}

      {currentView === 'checkout' && (
        <div className="checkout-view">
           <button onClick={() => setCurrentView('cart')} className="text-btn">&larr; Back to Cart</button>
           <h2>Checkout</h2>
           <div className="checkout-layout">
             <form onSubmit={handlePlaceOrder} className="checkout-form">
               <h3>Shipping Address</h3>
               <input required type="text" placeholder="Full Name" value={checkoutForm.customerName} onChange={e => setCheckoutForm({...checkoutForm, customerName: e.target.value})} />
               <input required type="text" placeholder="Address Line" value={checkoutForm.addressLine} onChange={e => setCheckoutForm({...checkoutForm, addressLine: e.target.value})} />
               <input required type="text" placeholder="City" value={checkoutForm.city} onChange={e => setCheckoutForm({...checkoutForm, city: e.target.value})} />
               <input required type="text" placeholder="Pincode" value={checkoutForm.pincode} onChange={e => setCheckoutForm({...checkoutForm, pincode: e.target.value})} />
               <input required type="text" placeholder="Phone Number" value={checkoutForm.phoneNumber} onChange={e => setCheckoutForm({...checkoutForm, phoneNumber: e.target.value})} />
               <button type="submit" className="primary-btn place-order-btn">Place Order</button>
             </form>
             
             <div className="order-summary-box">
                <h3>Order Summary</h3>
                <div className="summary-line">
                  <span>Subtotal:</span>
                  <span>₹{cartTotals.subtotal}</span>
                </div>
                {cartTotals.discountSaved > 0 && (
                  <div className="summary-line discount-line">
                    <span>Discount Saved:</span>
                    <span>- ₹{cartTotals.discountSaved}</span>
                  </div>
                )}
                <div className="summary-line final-total">
                  <span>Total:</span>
                  <span>₹{cartTotals.finalTotal}</span>
                </div>
             </div>
           </div>
        </div>
      )}

      {currentView === 'redirect_verifying' && (
        <div className="payment-verification-view" style={{ textAlign: 'center', padding: '40px' }}>
          <h2>Verifying your payment...</h2>
          <div style={{ margin: '20px 0', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          </div>
          <p style={{ margin: '10px 0', fontSize: '1.1em', color: '#555' }}>
            Please wait while we confirm your payment status.
          </p>
          <style>{`
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          `}</style>
        </div>
      )}

      {currentView === 'payment_verification' && orderData && (
        <div className="payment-verification-view" style={{ textAlign: 'center', padding: '40px' }}>
          {countdown > 0 ? (
            <>
              <h2>Waiting for payment</h2>
              <div style={{ margin: '20px 0', display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              </div>
              <p style={{ margin: '10px 0', fontSize: '1.1em', color: '#555' }}>
                Redirecting to payment site...
              </p>
              
              <p style={{ margin: '20px 0', fontSize: '1.2em', fontWeight: 'bold', color: '#ef4444' }}>
                Expires in {Math.floor(countdown / 60).toString().padStart(2, '0')}:{(countdown % 60).toString().padStart(2, '0')}
              </p>
              
              <div style={{ margin: '30px 0' }}>
                <button 
                  onClick={() => window.open(paymentLinkData.shortUrl, '_blank')} 
                  className="text-btn" 
                  style={{ textDecoration: 'underline', color: '#6366f1' }}
                >
                  Site didn't redirect? Click here
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 style={{ color: '#ef4444' }}>Payment link expired</h2>
              <p style={{ margin: '20px 0', fontSize: '1.1em', color: '#555' }}>
                The 15-minute payment window has ended.
              </p>
            </>
          )}

          {countdown > 0 ? (
            <div style={{ margin: '30px 0', display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' }}>
              <button onClick={handleVerifyPayment} className="primary-btn" style={{ padding: '12px 24px', fontSize: '1.1em' }}>
                I have completed the payment
              </button>
              <button onClick={handleCancelPayment} className="text-btn" style={{ color: '#ef4444' }}>
                Cancel Payment
              </button>
            </div>
          ) : (
            <div style={{ margin: '30px 0' }}>
              <button onClick={() => { setCurrentView('checkout'); setPaymentLinkData(null); }} className="primary-btn" style={{ padding: '12px 24px', fontSize: '1.1em' }}>
                Return to Checkout
              </button>
            </div>
          )}
          
          <p style={{ color: '#888', fontSize: '0.9em', marginTop: '20px' }}>
            Order ID: {orderData.id} • Amount: ₹{orderData.totalAmount}
          </p>
          <style>{`
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          `}</style>
        </div>
      )}

      {currentView === 'confirmation' && orderData && (
        <div className="confirmation-view">
          <h2>🎉 Order Placed Successfully!</h2>
          <div className="confirmation-card">
            <p><strong>Order ID:</strong> {orderData.id}</p>
            <p><strong>Status:</strong> <span className="status-badge">{orderData.status}</span></p>
            <p><strong>Total Paid:</strong> ₹{orderData.totalAmount}</p>
            
            <div className="confirmation-address">
              <h3>Delivering to:</h3>
              <p>{orderData.address.customerName}</p>
              <p>{orderData.address.addressLine}</p>
              <p>{orderData.address.city}, {orderData.address.pincode}</p>
              <p>{orderData.address.phoneNumber}</p>
            </div>

            <div className="confirmation-items">
              <h3>Items Purchased:</h3>
              <ul>
                {orderData.items.map(item => (
                  <li key={item.productId}>{item.name} x {item.quantity} (₹{item.priceAtPurchase} each)</li>
                ))}
              </ul>
            </div>
          </div>
          <button onClick={() => setCurrentView('catalog')} className="primary-btn mt-2">Return to Home</button>
        </div>
      )}
    </div>
  );
}

export default App;
