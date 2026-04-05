const NormalizedInvestorProfile = require('../models/NormalizedInvestorProfile');

/**
 * Deduplicates investors based on name + domain + linkedin matching.
 * Marks duplicates in the DB and returns only the primary records.
 */
async function deduplicateProfiles(profileIds) {
  const profiles = await NormalizedInvestorProfile.find({ _id: { $in: profileIds } });
  const seen = new Map(); // key -> normalized_investor_id
  const duplicateUpdates = [];

  for (const profile of profiles) {
    // Build dedup key using available fields
    const nameKey = (profile.person_full_name_cleaned || '').toLowerCase().replace(/\s+/g, '');
    const domainKey = (profile.company_domain || '').toLowerCase();
    const linkedinKey = (profile.linkedin_url || '').toLowerCase();

    // Priority: linkedin > domain+name > name only
    let dedupKey = linkedinKey || (nameKey && domainKey ? `${nameKey}::${domainKey}` : nameKey);

    if (!dedupKey) continue;

    if (seen.has(dedupKey)) {
      // This is a duplicate
      const primaryId = seen.get(dedupKey);
      const confidence = linkedinKey ? 99 : (domainKey && nameKey ? 85 : 60);
      duplicateUpdates.push({
        id: profile._id,
        is_duplicate: true,
        duplicate_of: primaryId,
        duplicate_match_confidence_score: confidence
      });
    } else {
      seen.set(dedupKey, profile._id);
    }
  }

  // Batch update duplicates
  for (const update of duplicateUpdates) {
    await NormalizedInvestorProfile.findByIdAndUpdate(update.id, {
      is_duplicate: update.is_duplicate,
      duplicate_of: update.duplicate_of,
      duplicate_match_confidence_score: update.duplicate_match_confidence_score
    });
  }

  return {
    total: profiles.length,
    unique: profiles.length - duplicateUpdates.length,
    duplicates_found: duplicateUpdates.length
  };
}

module.exports = { deduplicateProfiles };
