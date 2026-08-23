# Razorpay Buildathon - Phase 1

This is Phase 1 of the Razorpay Buildathon project (AI Growth & Agentic Commerce track).
It is a minimal, functional full-stack e-commerce prototype designed to be the foundation for an AI agent to interact with in Phase 2.

## Features
- **Backend (Node.js + Express + SQLite):**
  - Seeded with ~15 products.
  - Endpoints to fetch products and create orders.
  - Safe, transactional stock deduction on order creation.
- **Frontend (React + Vite):**
  - Simple, minimal UI.
  - Product listing and detail views.
  - Ability to place a test order.

## Requirements
- Docker and Docker Compose

## How to Run

1. Clone or navigate to the project directory.
2. Run the following command to start both backend and frontend:
   ```bash
   docker-compose up --build
   ```
3. Open your browser:
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:3000/api/products`

## API Endpoints

- `GET /api/products` - List all products (supports `?category=` and `?search=`)
- `GET /api/products/:id` - Get product by ID
- `POST /api/orders` - Create an order (Body: `{ userId: "...", items: [{ productId: "p1", quantity: 1 }] }`)
- `GET /api/orders/:id` - Get order by ID

## Testing

To run the backend tests:
```bash
cd backend
npm install
npm test
```
