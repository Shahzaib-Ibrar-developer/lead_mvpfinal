const OpenAI = require('openai');

const INVESTMENT_CAPACITY_MAP = {
  '1-10': '$500K–$2M',
  '11-50': '$1M–$5M',
  '51-200': '$5M–$25M',
  '201-500': '$10M–$50M',
  '501-1000': '$25M–$100M',
  '1001+': '$50M–$500M'
};

/**
 * AI enrichment using OpenAI GPT. Falls back to rule-based if no key set.
 */
async function enrichWithAI(normalizedProfile, rawRecord, searchParams) {
  const OPENAI_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_KEY || OPENAI_KEY === 'your_openai_api_key_here') {
    return ruleBasedEnrichment(normalizedProfile, rawRecord, searchParams);
  }

  try {
    const openai = new OpenAI({ apiKey: OPENAI_KEY });

    const prompt = buildEnrichmentPrompt(normalizedProfile, rawRecord, searchParams);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3
    });

    const result = JSON.parse(completion.choices[0].message.content);
    return sanitizeAiResult(result, normalizedProfile, rawRecord);
  } catch (err) {
    console.error('OpenAI enrichment failed, falling back to rule-based:', err.message);
    return ruleBasedEnrichment(normalizedProfile, rawRecord, searchParams);
  }
}

function buildEnrichmentPrompt(profile, rawRecord, searchParams) {
  return `You are an expert investor intelligence analyst for real estate deals of $1M–$10M.

Analyze this contact and return a JSON with these exact keys:
{
  "ai_generated_summary": "2-3 sentence professional summary",
  "real_estate_interest_score": 0-100,
  "investor_relevance_score": 0-100,
  "confidence_score": 0-100,
  "reasoning_text": "Why this person ranks as they do",
  "estimated_investment_capacity_range": "e.g. $5M–$25M",
  "capital_capacity_score": 0-100,
  "decision_making_power_score": 0-100,
  "geography_fit_score": 0-100,
  "ai_uncertainty_flag": true or false,
  "real_estate_signal_detected": true or false,
  "investment_language_detected": true or false,
  "executive_role_detected": true or false
}

Contact Profile:
- Name: ${profile.person_full_name_cleaned}
- Title: ${profile.standardized_job_title}
- Company: ${profile.organization_name_cleaned}
- Industry: ${rawRecord.industry || 'Unknown'}
- Seniority: ${rawRecord.seniority || 'Unknown'}
- Location: ${profile.location_standardized}
- Company Size: ${profile.company_size || 'Unknown'}
- Investor Type Classified: ${profile.investor_type_classified}
- Search Target Geography: ${searchParams.target_geography || 'Any'}
- Search Real Estate Keywords: ${searchParams.real_estate_interest_keywords || 'real estate, investment'}

Be realistic. Use ai_uncertainty_flag=true if data is insufficient to make confident scoring.`;
}

function sanitizeAiResult(result, profile, rawRecord) {
  const clamp = (v, min = 0, max = 100) => Math.min(max, Math.max(min, Number(v) || 0));
  return {
    ai_generated_summary: result.ai_generated_summary || '',
    real_estate_interest_score: clamp(result.real_estate_interest_score),
    investor_relevance_score: clamp(result.investor_relevance_score),
    confidence_score: clamp(result.confidence_score),
    reasoning_text: result.reasoning_text || '',
    estimated_investment_capacity_range: result.estimated_investment_capacity_range || '',
    capital_capacity_score: clamp(result.capital_capacity_score),
    decision_making_power_score: clamp(result.decision_making_power_score),
    geography_fit_score: clamp(result.geography_fit_score),
    ai_uncertainty_flag: !!result.ai_uncertainty_flag,
    real_estate_signal_detected: !!result.real_estate_signal_detected,
    investment_language_detected: !!result.investment_language_detected,
    executive_role_detected: !!result.executive_role_detected
  };
}

/**
 * Rule-based fallback enrichment (no AI key required)
 */
function ruleBasedEnrichment(profile, rawRecord, searchParams) {
  const title = (profile.standardized_job_title || '').toLowerCase();
  const org = (profile.organization_name_cleaned || '').toLowerCase();
  const industry = (rawRecord.industry || '').toLowerCase();
  const seniority = (rawRecord.seniority || '').toLowerCase();

  // Real estate interest score
  const RE_TEXT = [title, org, industry].join(' ');
  const RE_WORDS = ['real estate', 'realty', 'property', 'reit', 'acquisitions', 'development'];
  const reScore = RE_WORDS.filter(w => RE_TEXT.includes(w)).length;
  const real_estate_interest_score = Math.min(reScore * 20 + 30, 95);

  // Decision-making power
  const EXEC = ['c_suite', 'owner', 'partner', 'director', 'vp', 'founder'];
  const decision_making_power_score = EXEC.some(e => seniority.includes(e) || title.includes(e)) ? 80 : 45;

  // Capital capacity
  const sizeMap = {
    '1-10': 35, '11-50': 55, '51-200': 70, '201-500': 80, '501-1000': 88, '1001+': 95
  };
  const capital_capacity_score = sizeMap[profile.company_size] || 40;

  // Geography fit
  const targetGeo = (searchParams.target_geography || '').toLowerCase();
  const profileLoc = (profile.location_standardized || '').toLowerCase();
  const geography_fit_score = (!targetGeo || profileLoc.includes(targetGeo.split(',')[0].trim())) ? 85 : 40;

  // Data confidence
  const data_confidence_score = profile.contact_availability_score > 50 ? 80 : 50;

  // Investment capacity range
  const estimated_investment_capacity_range = INVESTMENT_CAPACITY_MAP[profile.company_size] || '$1M–$10M';

  // Signal tags
  const real_estate_signal_detected = RE_WORDS.some(w => RE_TEXT.includes(w));
  const INV_WORDS = ['invest', 'fund', 'capital', 'asset', 'portfolio', 'equity', 'wealth'];
  const investment_language_detected = INV_WORDS.some(w => [title, org].join(' ').includes(w));
  const EXEC_WORDS = ['ceo', 'cfo', 'coo', 'cio', 'president', 'director', 'managing', 'founder', 'partner', 'principal', 'vp'];
  const executive_role_detected = EXEC_WORDS.some(w => title.includes(w));

  // Summary
  const seniorityLabel = seniority.includes('c_suite') ? 'C-suite executive' :
    seniority.includes('director') ? 'Director-level professional' :
    seniority.includes('vp') ? 'VP-level professional' :
    seniority.includes('manager') ? 'Manager' : 'Professional';

  const ai_generated_summary = `${seniorityLabel} at ${profile.organization_name_cleaned || 'an organization'} ` +
    `in the ${industry || 'investment'} sector, based in ${profile.location_standardized || 'USA'}. ` +
    `${real_estate_signal_detected ? 'Shows strong real estate exposure. ' : ''}` +
    `${executive_role_detected ? 'Holds a decision-making title with likely investment authority.' : 'May have investment exposure based on role and company type.'}`;

  const reasonParts = [];
  if (real_estate_signal_detected) reasonParts.push('Matches real estate keyword signals');
  if (executive_role_detected) reasonParts.push('Senior role in relevant industry');
  if (profile.contact_availability_score > 60) reasonParts.push('High contact availability');
  if (investment_language_detected) reasonParts.push('Investment language detected in profile');
  if (geography_fit_score > 70) reasonParts.push('Strong geography match');

  const reasoning_text = reasonParts.length > 0 ? reasonParts.join(' · ') : 'General investor profile based on role and company data';

  return {
    ai_generated_summary,
    real_estate_interest_score,
    investor_relevance_score: Math.round((real_estate_interest_score + decision_making_power_score) / 2),
    confidence_score: data_confidence_score,
    reasoning_text,
    estimated_investment_capacity_range,
    capital_capacity_score,
    decision_making_power_score,
    geography_fit_score,
    ai_uncertainty_flag: data_confidence_score < 60,
    real_estate_signal_detected,
    investment_language_detected,
    executive_role_detected
  };
}

module.exports = { enrichWithAI };
