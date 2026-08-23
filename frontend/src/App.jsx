import { useState, useEffect } from 'react';
import './App.css';

// Using Vite proxy in development, falls back to direct URL if needed
const API_BASE = '/api';

function App() {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  const handleProductClick = (product) => {
    setSelectedProduct(product);
  };

  const handleBack = () => {
    setSelectedProduct(null);
    fetchProducts(); // Refresh to get latest stock if we made an order
  };

  const handleOrder = async () => {
    try {
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: 'demo_user',
          items: [{ productId: selectedProduct.id, quantity: 1 }]
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to place order');
      
      alert(`Order placed successfully! Order ID: ${data.order.id}`);
      handleBack(); // Go back to list and refresh
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  if (loading) return <div className="container">Loading products...</div>;
  if (error) return <div className="container">Error: {error}</div>;

  return (
    <div className="container">
      <header>
        <h1>Mock E-commerce Store</h1>
        <p>Phase 1 Prototype</p>
      </header>

      {selectedProduct ? (
        <div className="product-detail">
          <button onClick={handleBack} className="back-btn">&larr; Back to catalog</button>
          <h2>{selectedProduct.name}</h2>
          <div className="detail-meta">
            <span className="category">{selectedProduct.category}</span>
            <span className="rating">⭐ {selectedProduct.rating}</span>
          </div>
          <p className="price">₹{selectedProduct.price}</p>
          <p className="stock">Stock: {selectedProduct.stock} units available</p>
          
          <button 
            onClick={handleOrder} 
            disabled={selectedProduct.stock === 0}
            className="order-btn"
          >
            {selectedProduct.stock > 0 ? 'Place Test Order (1 item)' : 'Out of Stock'}
          </button>
        </div>
      ) : (
        <div className="product-grid">
          {products.map(product => (
            <div 
              key={product.id} 
              className="product-card"
              onClick={() => handleProductClick(product)}
            >
              <h3>{product.name}</h3>
              <p className="category">{product.category}</p>
              <div className="bottom-row">
                <span className="price">₹{product.price}</span>
                <span className={`stock ${product.stock === 0 ? 'out-of-stock' : ''}`}>
                  {product.stock > 0 ? `${product.stock} left` : 'Out of Stock'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
