const express = require('express');
const router = express.Router();
const NormalizedInvestorProfile = require('../models/NormalizedInvestorProfile');

// PUT /api/shortlist/:id — Update investor shortlist status
router.put('/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['none', 'saved', 'contacted', 'rejected'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const profile = await NormalizedInvestorProfile.findByIdAndUpdate(
      req.params.id,
      { shortlist_status: status },
      { new: true }
    );

    if (!profile) return res.status(404).json({ error: 'Investor not found' });

    res.json({ success: true, shortlist_status: profile.shortlist_status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
