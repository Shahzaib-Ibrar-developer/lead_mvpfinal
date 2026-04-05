const express = require('express');
const router = express.Router();
const SearchRequest = require('../models/SearchRequest');
const RawApolloRecord = require('../models/RawApolloRecord');
const NormalizedInvestorProfile = require('../models/NormalizedInvestorProfile');

const { fetchFromApollo } = require('../services/apolloService');
const { normalizeApolloRecord } = require('../services/normalizationService');
const { classifyInvestorType } = require('../services/classificationService');
const { deduplicateProfiles } = require('../services/deduplicationService');
const { optimizeSearchQuery } = require('../services/queryOptimizationService');
const { enrichWithAI } = require('../services/aiEnrichmentService');
const { calculateOverallScore } = require('../services/scoringService');
const AiEnrichedProfile = require('../models/AiEnrichedProfile');

// POST /api/search — Submit new search
router.post('/', async (req, res) => {
  try {
    // Optimize query with AI before processing
    const optimizedParams = await optimizeSearchQuery({
      investor_type_filter: req.body.investor_type_filter || '',
      target_geography: req.body.target_geography || '',
      company_industry_filter: req.body.company_industry_filter || '',
      job_title_keywords: req.body.job_title_keywords || '',
      minimum_estimated_check_size: req.body.minimum_estimated_check_size || '',
      maximum_estimated_check_size: req.body.maximum_estimated_check_size || '',
      real_estate_interest_keywords: req.body.real_estate_interest_keywords || '',
      search_notes_optional: req.body.search_notes_optional || ''
    });

    const searchData = {
      ...optimizedParams,
      status: 'pending',
      total_apollo_results: 0,
      current_page: 0,
      total_pages: 0
    };

    const searchRequest = new SearchRequest(searchData);
    await searchRequest.save();

    // Run pipeline for first page asynchronously
    runPipeline(searchRequest._id, searchData, 1).catch(err => {
      console.error('Pipeline error:', err);
      SearchRequest.findByIdAndUpdate(searchRequest._id, { status: 'failed', error_message: err.message }).exec();
    });

    res.status(201).json({
      message: 'Search submitted successfully',
      search_request_id: searchRequest._id,
      status: 'pending',
      optimized: optimizedParams.optimization_notes
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/search — Get all searches
router.get('/', async (req, res) => {
  try {
    const searches = await SearchRequest.find({ results_count: { $gt: 0 } }).sort({ created_at: -1 });
    res.json(searches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/search/:id — Get single search
router.get('/:id', async (req, res) => {
  try {
    const search = await SearchRequest.findById(req.params.id);
    if (!search) return res.status(404).json({ error: 'Search not found' });
    res.json(search);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/search/:id/load-page — Load next page of results
router.post('/:id/load-page', async (req, res) => {
  try {
    const search = await SearchRequest.findById(req.params.id);
    if (!search) return res.status(404).json({ error: 'Search not found' });

    const page = req.body.page || search.current_page + 1;
    
    if (page > search.total_pages) {
      return res.status(400).json({ error: 'Page exceeds total pages' });
    }

    // Run pipeline for requested page
    runPipeline(search._id, search.toObject(), page).catch(err => {
      console.error('Pipeline error:', err);
    });

    res.json({ message: 'Loading page', page, status: 'running' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// POST /api/search/:id/replay — Replay search
router.post('/:id/replay', async (req, res) => {
  try {
    const original = await SearchRequest.findById(req.params.id);
    if (!original) return res.status(404).json({ error: 'Original search not found' });

    const replay = new SearchRequest({
      investor_type_filter: original.investor_type_filter,
      target_geography: original.target_geography,
      company_industry_filter: original.company_industry_filter,
      job_title_keywords: original.job_title_keywords,
      minimum_estimated_check_size: original.minimum_estimated_check_size,
      maximum_estimated_check_size: original.maximum_estimated_check_size,
      real_estate_interest_keywords: original.real_estate_interest_keywords,
      search_notes_optional: original.search_notes_optional,
      status: 'pending',
      total_apollo_results: 0,
      current_page: 0,
      total_pages: 0
    });
    await replay.save();

    runPipeline(replay._id, original.toObject(), 1).catch(err => {
      SearchRequest.findByIdAndUpdate(replay._id, { status: 'failed', error_message: err.message }).exec();
    });

    res.status(201).json({ message: 'Search replayed', search_request_id: replay._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =================== HELPERS ===================
const CHUNK_SIZE = 10; // Process 10 investors in parallel (respects ~60 req/min OpenAI rate limit)
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

/**
 * Retry a function with exponential backoff.
 * Retries on rate-limit (429) and server errors (5xx).
 */
async function retryWithBackoff(fn, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRetryable = err.status === 429 || (err.status >= 500 && err.status < 600) || err.code === 'ECONNRESET';
      if (!isRetryable || attempt === retries) {
        throw err;
      }
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1); // 1s, 2s, 4s
      console.warn(`⚠️ Retry ${attempt}/${retries} after ${delay}ms — ${err.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Process a single investor through the full pipeline (raw save → normalize → classify → AI enrich).
 * Returns the normalized profile ID, or null on failure.
 */
async function processInvestor(person, index, total, searchRequestId, searchParams) {
  try {
    console.log(`\n📦 Processing person ${index + 1}/${total}:`, {
      name: `${person.first_name} ${person.last_name_obfuscated || person.last_name || ''}`,
      title: person.title,
      company: person.organization?.name || '',
      location: `${person.city || ''}, ${person.country || ''}`.trim()
    });

    // STEP 2: Store raw record
    const rawRecord = new RawApolloRecord({
      search_request_id: searchRequestId,
      apollo_person_id: person.id,
      full_name: `${person.first_name || ''} ${person.last_name_obfuscated || person.last_name || ''}`.trim(),
      job_title: person.title,
      organization_name: person.organization?.name || '',
      organization_domain: person.organization?.domain || '',
      linkedin_url: person.linkedin_url || '',
      location_city: person.city || '',
      location_country: person.country || '',
      email_status: person.has_email ? 'available' : 'unavailable',
      phone_status: person.has_direct_phone === 'Yes' ? 'available' : 'unavailable',
      seniority_level: person.seniority || '',
      department: person.departments?.[0] || person.department || '',
      company_size: person.organization?.employee_count || '',
      industry: person.organization?.industry || '',
      raw_json_payload: person
    });
    await rawRecord.save();

    // STEP 3: Normalize
    const normalized = normalizeApolloRecord(person);

    // STEP 4: Classify
    const investor_type_classified = classifyInvestorType({ ...normalized, industry: person.organization?.industry || '' });

    const profile = new NormalizedInvestorProfile({
      search_request_id: searchRequestId,
      raw_apollo_record_id: rawRecord._id,
      ...normalized,
      investor_type_classified
    });
    await profile.save();

    // STEP 5: AI Enrichment with retry logic
    try {
      const enrichment = await retryWithBackoff(() =>
        enrichWithAI(
          { ...normalized, investor_type_classified },
          person,
          searchParams
        )
      );

      // Clear summary fields — generated on-demand when viewing individual investor
      enrichment.ai_generated_summary = '';
      enrichment.reasoning_text = '';

      const { overall_investor_fit_score, score_explanation_text } = calculateOverallScore(
        enrichment, normalized.contact_availability_score
      );

      const enrichedProfile = new AiEnrichedProfile({
        normalized_investor_id: profile._id,
        search_request_id: searchRequestId,
        ...enrichment,
        overall_investor_fit_score,
        score_explanation_text,
        data_source_count: 1
      });
      await enrichedProfile.save();
      console.log(`✅ AI enrichment saved (score: ${overall_investor_fit_score}, summary skipped)`);
    } catch (err) {
      console.error(`❌ AI enrichment failed for ${person.first_name} after ${MAX_RETRIES} retries:`, err.message);
    }

    return profile._id;
  } catch (err) {
    console.error(`❌ Failed to process investor ${person.first_name}:`, err.message);
    return null;
  }
}

// =================== PIPELINE ===================
async function runPipeline(searchRequestId, searchParams, page = 1) {
  await SearchRequest.findByIdAndUpdate(searchRequestId, { status: 'running', progress: 0 });

  // STEP 1: Fetch from Apollo
  const apolloResponse = await fetchFromApollo(searchParams, page);
  const apolloPeople = apolloResponse.people || [];
  const totalEntries = apolloResponse.total_entries || 0;
  const totalPages = Math.ceil(totalEntries / 10);

  // Update search with pagination info
  await SearchRequest.findByIdAndUpdate(searchRequestId, {
    total_apollo_results: totalEntries,
    current_page: page,
    total_pages: totalPages
  });

  console.log(`📄 Processing page ${page}/${totalPages} (${apolloPeople.length} investors in chunks of ${CHUNK_SIZE})`);

  // Handle 0 results case - complete immediately
  if (apolloPeople.length === 0) {
    await SearchRequest.findByIdAndUpdate(searchRequestId, {
      status: 'completed',
      progress: 100,
      results_count: 0,
      completed_at: new Date()
    });
    console.log('⚠️ No results found from Apollo - search completed with 0 results');
    return;
  }

  const normalizedProfileIds = [];
  const totalInvestors = apolloPeople.length;
  let processedCount = 0;

  // Process investors in parallel chunks
  for (let i = 0; i < totalInvestors; i += CHUNK_SIZE) {
    const chunk = apolloPeople.slice(i, i + CHUNK_SIZE);
    const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;
    const totalChunks = Math.ceil(totalInvestors / CHUNK_SIZE);
    console.log(`\n🔄 Processing chunk ${chunkIndex}/${totalChunks} (${chunk.length} investors in parallel)`);

    const chunkStartTime = Date.now();

    // Process all investors in the chunk in parallel
    const results = await Promise.all(
      chunk.map((person, idx) =>
        processInvestor(person, i + idx, totalInvestors, searchRequestId, searchParams)
      )
    );

    // Collect non-null profile IDs
    for (const profileId of results) {
      if (profileId) normalizedProfileIds.push(profileId);
    }

    processedCount += chunk.length;
    const progress = Math.round((processedCount / totalInvestors) * 100);
    const chunkDuration = ((Date.now() - chunkStartTime) / 1000).toFixed(1);

    // Update progress in database
    await SearchRequest.findByIdAndUpdate(searchRequestId, { progress });
    console.log(`📊 Progress: ${progress}% (${processedCount}/${totalInvestors}) — chunk took ${chunkDuration}s`);

    // Small delay between chunks to respect rate limits
    if (i + CHUNK_SIZE < totalInvestors) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // STEP 6: Deduplication
  const dedupResult = await deduplicateProfiles(normalizedProfileIds);

  // STEP 7: Update results count
  const totalUnique = await NormalizedInvestorProfile.countDocuments({ 
    search_request_id: searchRequestId, 
    is_duplicate: false 
  });

  await SearchRequest.findByIdAndUpdate(searchRequestId, {
    status: 'completed',
    progress: 100,
    results_count: totalUnique,
    completed_at: new Date()
  });

  console.log(`✅ Page ${page} complete: ${dedupResult.unique} unique investors (${totalUnique} total unique)`);
}

module.exports = router;
