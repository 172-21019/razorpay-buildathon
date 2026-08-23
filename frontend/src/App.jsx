import { useState, useEffect, useMemo } from 'react';
import './App.css';

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
    if (!searchTerm) return products;
    return products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [products, searchTerm]);

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
      
      setOrderData(data.order);
      setCart([]); // Clear cart
      setCurrentView('confirmation');
      fetchProducts(); // Refresh stock in background
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
            {filteredProducts.map(product => {
              const finalPrice = getFinalPrice(product);
              return (
                <div 
                  key={product.id} 
                  className="product-card"
                  onClick={() => {
                    setSelectedProduct({ ...product, selectedQuantity: 1 });
                    setCurrentView('detail');
                  }}
                >
                  {product.discount > 0 && <span className="discount-badge">{product.discount}% OFF</span>}
                  <h3>{product.name}</h3>
                  <p className="category">{product.category}</p>
                  <div className="bottom-row">
                    <span className="price">
                      {product.discount > 0 && <span className="old-price">₹{product.price}</span>}
                      ₹{finalPrice}
                    </span>
                    <span className={`stock ${product.stock === 0 ? 'out-of-stock' : ''}`}>
                      {product.stock > 0 ? `${product.stock} left` : 'Out of Stock'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
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
        <div className="cart-view">
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
