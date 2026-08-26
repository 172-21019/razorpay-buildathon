const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

router.post('/', orderController.createOrder);
router.get('/:id', orderController.getOrderById);
router.post('/:id/create-payment', orderController.createPayment);
router.post('/:id/verify-payment', orderController.verifyPayment);
router.post('/:id/cancel-payment', orderController.cancelPayment);

module.exports = router;
