const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Uses AI to fix spelling and formatting in search query parameters before sending to Apollo
 * - Fixes typos and spelling errors
 * - Standardizes capitalization
 * - Validates industry tag names
 * - Does NOT alter, remove, or restructure user keywords
 */
async function optimizeSearchQuery(rawParams) {
  console.log('🤖 Optimizing search query with AI...');
  console.log('📥 Raw input:', JSON.stringify(rawParams, null, 2));

  try {
    const prompt = `You are a search query spell-checker for Apollo.io API. Your ONLY job is to fix typos and spelling errors. You must NEVER alter, remove, add, or restructure any keywords.

INPUT PARAMETERS:
${JSON.stringify(rawParams, null, 2)}

STRICT RULES:
1. Fix spelling errors ONLY (e.g., "realstate" → "real estate", "austrailia" → "Australia", "tecnology" → "Technology")
2. Fix capitalization for job titles (e.g., "ceo" → "CEO", "managing director" → "Managing Director")
3. Standardize industry names to valid Apollo tags: "Real Estate", "Private Equity", "Investment Management", "Financial Services", "Venture Capital", "Family Office", "Technology"
4. Keep location format exactly as provided by user (only fix spelling)
5. DO NOT remove any keywords from "real_estate_interest_keywords" — keep ALL of them, only fix spelling
6. DO NOT reduce, consolidate, or simplify keywords — return the EXACT same keywords with only spelling corrections
7. DO NOT add new keywords or information
8. Keep the exact same number of comma-separated items in every field

RESPOND WITH ONLY A JSON OBJECT (no markdown, no explanation):
{
  "investor_type_filter": "same as input or empty string",
  "target_geography": "spelling-fixed location",
  "company_industry_filter": "spelling-fixed industry tags, comma-separated if multiple",
  "job_title_keywords": "spelling-fixed job titles",
  "minimum_estimated_check_size": "same as input",
  "maximum_estimated_check_size": "same as input",
  "real_estate_interest_keywords": "ALL original keywords with ONLY spelling fixes, comma-separated",
  "search_notes_optional": "same as input",
  "optimization_notes": "brief note about what spelling was fixed, or 'no changes needed'"
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a spelling and formatting corrector. Return only valid JSON, no markdown formatting. Never remove or alter keywords — only fix typos and spelling.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 500
    });

    const content = response.choices[0].message.content.trim();
    
    // Remove markdown code blocks if present
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const optimized = JSON.parse(jsonStr);
    
    console.log('✅ Optimized query:', JSON.stringify(optimized, null, 2));
    console.log('📝 Changes:', optimized.optimization_notes);

    return optimized;
  } catch (error) {
    console.error('❌ Query optimization failed:', error.message);
    console.log('⚠️ Falling back to original parameters');
    
    // Fallback: basic typo fixes
    return {
      ...rawParams,
      real_estate_interest_keywords: rawParams.real_estate_interest_keywords?.replace(/realstate/gi, 'real estate'),
      company_industry_filter: rawParams.company_industry_filter?.replace(/realstate/gi, 'Real Estate'),
      optimization_notes: 'AI optimization failed, applied basic fixes'
    };
  }
}

module.exports = { optimizeSearchQuery };
