const axios = require('axios');

/**
 * Calls the Apollo People Search API.
 */
async function fetchFromApollo(searchParams, page = 1) {
  const APOLLO_API_KEY = process.env.APOLLO_API_KEY;

  if (!APOLLO_API_KEY || APOLLO_API_KEY === 'your_apollo_api_key_here') {
    throw new Error('Apollo API key not configured. Please set APOLLO_API_KEY in .env file.');
  }

  try {
    const response = await axios.post(
      'https://api.apollo.io/api/v1/mixed_people/api_search',
      buildApolloQuery(searchParams, page),
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': APOLLO_API_KEY
        }
      }
    );
    
    console.log('✅ Apollo API Response:', {
      total_entries: response.data.total_entries,
      people_count: response.data.people?.length || 0,
      page: page,
      sample_person: response.data.people?.[0] || null
    });
    
    return {
      people: response.data.people || [],
      total_entries: response.data.total_entries || 0
    };
  } catch (err) {
    console.error('Apollo API error:', err.response?.data || err.message);
    throw new Error(`Apollo API failed: ${err.response?.data?.message || err.message}`);
  }
}

function buildApolloQuery(params, page = 1) {
  const query = {
    page: page,
    per_page: 10
  };
  
  // Job titles - split by comma and clean
  if (params.job_title_keywords) {
    query.person_titles = params.job_title_keywords
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
  }
  
  // Person location (where the person is located) - supports multiple locations
  if (params.target_geography) {
    query.person_locations = params.target_geography
      .split(',')
      .map(loc => loc.trim())
      .filter(Boolean);
  }
  
  // Add industry tag if provided - split by comma for multiple industries
  if (params.company_industry_filter) {
    query.q_organization_keyword_tags = params.company_industry_filter
      .split(',')
      .map(i => i.trim())
      .filter(Boolean);
  }
  
  // Company size filter (based on estimated check size)
  // Apollo uses employee count ranges as proxy for company size/investment capacity
  if (params.minimum_estimated_check_size || params.maximum_estimated_check_size) {
    const minCheck = parseFloat(params.minimum_estimated_check_size) || 0;
    const maxCheck = parseFloat(params.maximum_estimated_check_size) || Infinity;
    
    // Map check size to company employee ranges (rough heuristic)
    // $1M-$5M check → 50-500 employees
    // $5M-$10M check → 500-5000 employees
    // $10M+ check → 5000+ employees
    
    const employeeRanges = [];
    if (minCheck < 5) employeeRanges.push('11,20', '21,50', '51,200', '201,500');
    if (minCheck < 10 && maxCheck >= 5) employeeRanges.push('501,1000', '1001,5000');
    if (maxCheck >= 10) employeeRanges.push('5001,10000', '10001+');
    
    if (employeeRanges.length > 0) {
      query.organization_num_employees_ranges = employeeRanges;
    }
  }
  
  // NOTE: We intentionally do NOT send real_estate_interest_keywords as q_keywords to Apollo.
  // Apollo's API does not support boolean operators (OR/AND) in q_keywords, and plain keywords
  // use AND logic with all other filters, making results extremely restrictive (often 0 results).
  // Instead, keywords are used downstream in AI enrichment & scoring to rank result relevance.
  
  // Note: investor_type_filter and search_notes are stored but not sent to Apollo
  // They're used for internal classification and filtering after results are returned
  
  console.log('Apollo Query:', JSON.stringify(query, null, 2));
  console.log('📊 Filter count:', Object.keys(query).length - 2, '(excluding page/per_page)');
  
  return query;
}

module.exports = { fetchFromApollo };
