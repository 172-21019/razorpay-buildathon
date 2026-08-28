const { db } = require('../db');

exports.getRecentAuditLogs = (req, res) => {
  db.all('SELECT * FROM agent_audit_log ORDER BY timestamp DESC LIMIT 20', [], (err, rows) => {
    if (err) {
      console.error('Failed to get recent audit logs:', err.message);
      return res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
    
    // Parse JSON strings back into objects for response
    const formattedRows = rows.map(row => {
      try {
        if (row.input) row.input = JSON.parse(row.input);
      } catch (e) {}
      try {
        if (row.output) row.output = JSON.parse(row.output);
      } catch (e) {}
      return row;
    });

    res.json(formattedRows);
  });
};

exports.getAuditLogsBySession = (req, res) => {
  const { sessionId } = req.params;
  
  db.all('SELECT * FROM agent_audit_log WHERE session_id = ? ORDER BY timestamp ASC', [sessionId], (err, rows) => {
    if (err) {
      console.error('Failed to get audit logs by session:', err.message);
      return res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
    
    // Parse JSON strings back into objects for response
    const formattedRows = rows.map(row => {
      try {
        if (row.input) row.input = JSON.parse(row.input);
      } catch (e) {}
      try {
        if (row.output) row.output = JSON.parse(row.output);
      } catch (e) {}
      return row;
    });

    res.json(formattedRows);
  });
};
