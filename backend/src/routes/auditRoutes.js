const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');

router.get('/', auditController.getRecentAuditLogs);
router.get('/:sessionId', auditController.getAuditLogsBySession);

module.exports = router;
