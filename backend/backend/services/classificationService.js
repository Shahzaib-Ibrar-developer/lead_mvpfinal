/**
 * Classify investor type based on job title, department, and company/industry signals.
 */
function classifyInvestorType(normalizedProfile) {
  const title = (normalizedProfile.standardized_job_title || '').toLowerCase();
  const dept = (normalizedProfile.department || '').toLowerCase();
  const org = (normalizedProfile.organization_name_cleaned || '').toLowerCase();
  const industry = (normalizedProfile.industry || '').toLowerCase();

  // Family office
  if (
    org.includes('family office') || org.includes('family wealth') || org.includes('family capital') ||
    title.includes('family office') || industry.includes('family office')
  ) return 'family_office';

  // Fund manager
  if (
    org.includes('fund') || org.includes('capital partners') || org.includes('asset management') ||
    org.includes('capital management') || org.includes('investment') ||
    title.includes('fund manager') || title.includes('portfolio manager') || 
    title.includes('cio') || title.includes('chief investment') ||
    industry.includes('private equity') || industry.includes('investment management') ||
    industry.includes('financial services')
  ) return 'fund_manager';

  // Real estate operator
  if (
    industry.includes('real estate') || org.includes('real estate') || org.includes(' re ') ||
    org.includes('realty') || org.includes('property') ||
    title.includes('real estate') || title.includes('acquisitions') || 
    title.includes('development') || title.includes('property')
  ) return 'real_estate_operator';

  // Private investor (broader catch-all for executives)
  if (
    title.includes('investor') || title.includes('angel') || title.includes('principal') ||
    title.includes('managing director') || title.includes('founder') || title.includes('ceo') ||
    title.includes('managing partner') || title.includes('partner') ||
    dept.includes('finance') || dept.includes('executive')
  ) return 'private_investor';

  return 'unknown';
}

/**
 * Detect signal tags based on profile fields.
 */
function detectSignalTags(normalizedProfile, rawRecord) {
  const text = [
    normalizedProfile.standardized_job_title,
    normalizedProfile.organization_name_cleaned,
    normalizedProfile.industry,
    rawRecord.industry || ''
  ].join(' ').toLowerCase();

  const RE_SIGNALS = ['real estate', 'realty', 'property', 'reit', 'acquisitions', 'development', 'commercial'];
  const INV_SIGNALS = ['invest', 'fund', 'capital', 'asset', 'portfolio', 'venture', 'equity', 'wealth'];

  const realEstateSignal = RE_SIGNALS.some(k => text.includes(k));
  const investmentLanguage = INV_SIGNALS.some(k => text.includes(k));

  const titleLower = (normalizedProfile.standardized_job_title || '').toLowerCase();
  const EXEC_KEYWORDS = ['ceo', 'cfo', 'coo', 'cio', 'president', 'director', 'managing', 'founder', 'partner', 'principal', 'vp', 'head of'];
  const executiveRole = EXEC_KEYWORDS.some(k => titleLower.includes(k));

  return { realEstateSignal, investmentLanguage, executiveRole };
}

module.exports = { classifyInvestorType, detectSignalTags };
