/**
 * Normalize raw Apollo person object into structured profile fields.
 */
function normalizeApolloRecord(rawRecord) {
  const fullName = `${rawRecord.first_name || ''} ${rawRecord.last_name_obfuscated || rawRecord.last_name || ''}`.trim();
  const city = rawRecord.city || '';
  const country = rawRecord.country || '';
  const location = [city, country].filter(Boolean).join(', ');

  // Contact availability: has_email and has_direct_phone flags
  let contactScore = 0;
  if (rawRecord.has_email === true) contactScore += 60;
  if (rawRecord.has_direct_phone === 'Yes') contactScore += 40;
  else if (rawRecord.has_direct_phone && rawRecord.has_direct_phone.includes('Maybe')) contactScore += 20;

  return {
    person_full_name_cleaned: fullName,
    organization_name_cleaned: (rawRecord.organization?.name || rawRecord.organization_name || '').trim(),
    standardized_job_title: (rawRecord.title || '').trim(),
    location_standardized: location,
    company_domain: rawRecord.organization?.domain || rawRecord.organization_domain || '',
    linkedin_url: rawRecord.linkedin_url || '',
    contact_availability_score: Math.min(contactScore, 100),
    seniority_level: rawRecord.seniority || '',
    department: Array.isArray(rawRecord.departments) ? rawRecord.departments[0] : (rawRecord.department || ''),
    company_size: rawRecord.organization?.employee_count || rawRecord.organization_estimated_number_of_employees || '',
    industry: rawRecord.organization?.industry || rawRecord.industry || ''
  };
}

module.exports = { normalizeApolloRecord };
