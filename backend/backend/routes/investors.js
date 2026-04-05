const express = require('express');
const router = express.Router();
const NormalizedInvestorProfile = require('../models/NormalizedInvestorProfile');
const AiEnrichedProfile = require('../models/AiEnrichedProfile');
const RawApolloRecord = require('../models/RawApolloRecord');
const SearchRequest = require('../models/SearchRequest');
const { enrichPersonContact } = require('../services/apolloEnrichmentService');
const { enrichWithAI } = require('../services/aiEnrichmentService');
const { calculateOverallScore } = require('../services/scoringService');
const { normalizeApolloRecord } = require('../services/normalizationService');
const { classifyInvestorType } = require('../services/classificationService');

// GET /api/investors — Get all ranked investors (non-duplicate)
router.get('/', async (req, res) => {
  try {
    const { search_id, investor_type, min_score, location, sort_by, shortlist_status } = req.query;

    const query = { is_duplicate: false };
    if (search_id) query.search_request_id = search_id;
    if (investor_type) query.investor_type_classified = investor_type;
    if (shortlist_status) query.shortlist_status = shortlist_status;
    if (location) query.location_standardized = { $regex: location, $options: 'i' };

    const profiles = await NormalizedInvestorProfile.find(query);
    const profileIds = profiles.map(p => p._id);

    // Get enriched data
    const enrichedData = await AiEnrichedProfile.find({ normalized_investor_id: { $in: profileIds } });
    const enrichedMap = {};
    enrichedData.forEach(e => { enrichedMap[e.normalized_investor_id.toString()] = e; });

    // Merge and filter
    let investors = profiles.map(p => {
      const enriched = enrichedMap[p._id.toString()] || {};
      return {
        _id: p._id,
        person_full_name_cleaned: p.person_full_name_cleaned,
        organization_name_cleaned: p.organization_name_cleaned,
        location_standardized: p.location_standardized,
        investor_type_classified: p.investor_type_classified,
        standardized_job_title: p.standardized_job_title,
        linkedin_url: p.linkedin_url,
        contact_availability_score: p.contact_availability_score,
        company_domain: p.company_domain,
        shortlist_status: p.shortlist_status,
        search_request_id: p.search_request_id,
        // From AI enrichment
        overall_investor_fit_score: enriched.overall_investor_fit_score || 0,
        confidence_score: enriched.confidence_score || 0,
        ai_generated_summary: enriched.ai_generated_summary || '',
        reasoning_text: enriched.reasoning_text || '',
        real_estate_signal_detected: enriched.real_estate_signal_detected || false,
        investment_language_detected: enriched.investment_language_detected || false,
        executive_role_detected: enriched.executive_role_detected || false,
        ai_uncertainty_flag: enriched.ai_uncertainty_flag || false,
        estimated_investment_capacity_range: enriched.estimated_investment_capacity_range || '',
        real_estate_interest_score: enriched.real_estate_interest_score || 0,
        capital_capacity_score: enriched.capital_capacity_score || 0,
        decision_making_power_score: enriched.decision_making_power_score || 0,
        score_explanation_text: enriched.score_explanation_text || ''
      };
    });

    // Filter by min score
    if (min_score) {
      investors = investors.filter(i => i.overall_investor_fit_score >= Number(min_score));
    }

    // Sorting
    const sortField = sort_by || 'overall_investor_fit_score';
    investors.sort((a, b) => (b[sortField] || 0) - (a[sortField] || 0));

    res.json({ investors, total: investors.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/investors/:id — Get single investor detail
router.get('/:id', async (req, res) => {
  try {
    const profile = await NormalizedInvestorProfile.findById(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Investor not found' });

    let enriched = await AiEnrichedProfile.findOne({ normalized_investor_id: profile._id });
    let raw = await RawApolloRecord.findById(profile.raw_apollo_record_id);

    // Enrich email/LinkedIn if not already done (no phone - that's on-demand)
    if (raw && raw.apollo_person_id && !raw.actual_email && !raw.enrichment_requested) {
      console.log('📧 Enriching email/LinkedIn (no phone)...');
      try {
        const enrichResult = await enrichPersonContact(raw.apollo_person_id, false);
        if (enrichResult) {
          await RawApolloRecord.findByIdAndUpdate(raw._id, {
            actual_email: enrichResult.actual_email,
            actual_linkedin_url: enrichResult.actual_linkedin_url,
            enriched: true
          });
          raw = await RawApolloRecord.findById(raw._id);
          console.log('✅ Email/LinkedIn enriched');
        }
      } catch (err) {
        console.error('Email/LinkedIn enrichment failed:', err.message);
      }
    }

    // Generate AI summary on-demand if missing
    if (enriched && !enriched.ai_generated_summary && raw) {
      console.log('🤖 Generating AI summary on-demand...');
      try {
        const searchRequest = await SearchRequest.findById(profile.search_request_id);
        const searchParams = searchRequest ? searchRequest.toObject() : {};
        const normalized = normalizeApolloRecord(raw.raw_json_payload || {});
        const investor_type_classified = classifyInvestorType({ ...normalized, industry: raw.industry || '' });

        const summaryEnrichment = await enrichWithAI(
          { ...normalized, investor_type_classified },
          raw.raw_json_payload || {},
          searchParams
        );

        // Update only the summary and reasoning fields
        await AiEnrichedProfile.findByIdAndUpdate(enriched._id, {
          ai_generated_summary: summaryEnrichment.ai_generated_summary,
          reasoning_text: summaryEnrichment.reasoning_text
        });

        // Reload enriched profile with updated summary
        enriched = await AiEnrichedProfile.findById(enriched._id);
        console.log('✅ AI summary generated');
      } catch (err) {
        console.error('❌ AI summary generation failed:', err.message);
      }
    }

    // Build response with a clear phone_ready flag
    const rawData = raw ? {
      apollo_person_id: raw.apollo_person_id,
      email_status: raw.email_status,
      phone_status: raw.phone_status,
      actual_email: raw.actual_email,
      actual_phone: raw.actual_phone,
      actual_linkedin_url: raw.actual_linkedin_url,
      enriched: raw.enriched,
      enrichment_requested: raw.enrichment_requested,
      seniority_level: raw.seniority_level,
      department: raw.department,
      company_size: raw.company_size,
      industry: raw.industry,
      raw_json_payload: raw.raw_json_payload
    } : null;

    res.json({
      profile,
      enriched,
      raw_apollo_data: rawData,
      phone_ready: !!(raw?.actual_phone) // clean boolean for frontend
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/investors/:id/reveal-phone — Trigger phone enrichment on demand
router.post('/:id/reveal-phone', async (req, res) => {
  try {
    const profile = await NormalizedInvestorProfile.findById(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Investor not found' });

    let raw = await RawApolloRecord.findById(profile.raw_apollo_record_id);
    if (!raw || !raw.apollo_person_id) {
      return res.status(400).json({ error: 'No contact data available for enrichment' });
    }

    // If already enriched, return immediately
    if (raw.actual_phone) {
      return res.json({ 
        success: true, 
        phone: raw.actual_phone,
        message: 'Phone already available'
      });
    }

    // If enrichment already in progress, poll for result
    if (raw.enrichment_requested && !raw.enriched) {
      console.log('⏳ Enrichment already in progress, polling...');
      const maxWaitMs = 5000;
      const pollIntervalMs = 500;
      const startTime = Date.now();
      
      while (Date.now() - startTime < maxWaitMs) {
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
        const updated = await RawApolloRecord.findById(raw._id);
        if (updated && updated.enriched && updated.actual_phone) {
          return res.json({ 
            success: true, 
            phone: updated.actual_phone,
            message: 'Phone enrichment complete'
          });
        }
      }
      
      return res.json({ 
        success: false, 
        message: 'Phone enrichment in progress, please wait...',
        enriching: true
      });
    }

    // Trigger new enrichment
    console.log('📞 Triggering phone enrichment on demand...');
    
    // Mark as requested IMMEDIATELY to prevent duplicate requests
    await RawApolloRecord.findByIdAndUpdate(raw._id, {
      enrichment_requested: true,
      enriched_at: new Date()
    });
    
    // Call enrichment API (with phone reveal)
    const enrichResult = await enrichPersonContact(raw.apollo_person_id, true);
    
    if (!enrichResult) {
      return res.status(500).json({ error: 'Enrichment API failed' });
    }

    // Save email and LinkedIn immediately
    await RawApolloRecord.findByIdAndUpdate(raw._id, {
      actual_email: enrichResult.actual_email || raw.actual_email,
      actual_linkedin_url: enrichResult.actual_linkedin_url || raw.actual_linkedin_url
    });

    console.log('✅ Enrichment triggered, waiting for webhook...');
    
    // Wait for webhook to arrive (enriched flag set by webhook handler)
    const maxWaitMs = 30000; // 30 second timeout
    const pollIntervalMs = 500;
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitMs) {
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
      const updated = await RawApolloRecord.findById(raw._id);
      if (updated && updated.enriched && updated.actual_phone) {
        console.log('✅ Webhook received with phone');
        return res.json({ 
          success: true, 
          phone: updated.actual_phone,
          message: 'Phone enrichment complete'
        });
      }
    }
    
    console.log('⏳ Webhook timeout after 30s');
    return res.json({ 
      success: false, 
      message: 'Phone enrichment in progress, please refresh in a moment',
      enriching: true
    });
  } catch (err) {
    console.error('❌ Phone reveal error:', err.message);
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
