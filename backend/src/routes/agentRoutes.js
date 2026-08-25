const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');

router.post('/message', agentController.processMessage);

module.exports = router;
