const express = require('express');
const router = express.Router();
const NormalizedInvestorProfile = require('../models/NormalizedInvestorProfile');
const AiEnrichedProfile = require('../models/AiEnrichedProfile');

// GET /api/export?search_id=... — CSV export
router.get('/', async (req, res) => {
  try {
    const { search_id } = req.query;
    const query = { is_duplicate: false };
    if (search_id) query.search_request_id = search_id;

    const profiles = await NormalizedInvestorProfile.find(query);
    const profileIds = profiles.map(p => p._id);
    const enrichedData = await AiEnrichedProfile.find({ normalized_investor_id: { $in: profileIds } });
    const enrichedMap = {};
    enrichedData.forEach(e => { enrichedMap[e.normalized_investor_id.toString()] = e; });

    const rows = profiles.map(p => {
      const e = enrichedMap[p._id.toString()] || {};
      return {
        Name: p.person_full_name_cleaned || '',
        Company: p.organization_name_cleaned || '',
        Title: p.standardized_job_title || '',
        Location: p.location_standardized || '',
        'Investor Type': p.investor_type_classified || '',
        'Overall Score': e.overall_investor_fit_score || 0,
        'Confidence': e.confidence_score || 0,
        'Estimated Investment Range': e.estimated_investment_capacity_range || '',
        'AI Summary': (e.ai_generated_summary || '').replace(/,/g, ';'),
        'Reasoning': (e.reasoning_text || '').replace(/,/g, ';'),
        'RE Signal': e.real_estate_signal_detected ? 'Yes' : 'No',
        'Investment Language': e.investment_language_detected ? 'Yes' : 'No',
        'Executive Role': e.executive_role_detected ? 'Yes' : 'No',
        'Contact Available': p.contact_availability_score > 50 ? 'High' : p.contact_availability_score > 0 ? 'Partial' : 'None',
        LinkedIn: p.linkedin_url || '',
        'Shortlist Status': p.shortlist_status || 'none'
      };
    });

    // Sort by score
    rows.sort((a, b) => b['Overall Score'] - a['Overall Score']);

    // Build CSV
    const headers = Object.keys(rows[0] || {});
    const csv = [
      headers.join(','),
      ...rows.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="investor_leads_${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
