const express = require('express');
const router = express.Router();

// Sales orders routes stub
// This stub exists to prevent module load errors

router.get('/', (req, res) => {
  res.json({ message: 'Sales orders endpoints' });
});

module.exports = router;
