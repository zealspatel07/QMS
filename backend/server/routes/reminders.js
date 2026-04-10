const express = require('express');
const router = express.Router();

// Reminders routes stub
// This stub exists to prevent module load errors

router.get('/', (req, res) => {
  res.json({ message: 'Reminders endpoints' });
});

module.exports = router;
