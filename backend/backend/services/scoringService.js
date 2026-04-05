/**
 * Weighted Scoring Engine as per SRS specification.
 * Weights: capital_capacity=30%, real_estate=25%, decision_making=15%, geography=10%, contactability=10%, data_quality=10%
 */
function calculateOverallScore(enrichment, contactAvailabilityScore) {
  const weights = {
    capital_capacity: 0.30,
    real_estate_interest: 0.25,
    decision_making_power: 0.15,
    geography_fit: 0.10,
    contact_availability: 0.10,
    data_confidence: 0.10
  };

  const score =
    (enrichment.capital_capacity_score * weights.capital_capacity) +
    (enrichment.real_estate_interest_score * weights.real_estate_interest) +
    (enrichment.decision_making_power_score * weights.decision_making_power) +
    (enrichment.geography_fit_score * weights.geography_fit) +
    (contactAvailabilityScore * weights.contact_availability) +
    (enrichment.confidence_score * weights.data_confidence);

  const overall_investor_fit_score = Math.round(score);

  // Generate explanation text
  const factors = [
    { label: 'Investment Capacity', value: enrichment.capital_capacity_score, weight: '30%' },
    { label: 'Real Estate Relevance', value: enrichment.real_estate_interest_score, weight: '25%' },
    { label: 'Decision-Making Power', value: enrichment.decision_making_power_score, weight: '15%' },
    { label: 'Geography Match', value: enrichment.geography_fit_score, weight: '10%' },
    { label: 'Contactability', value: contactAvailabilityScore, weight: '10%' },
    { label: 'Data Quality', value: enrichment.confidence_score, weight: '10%' }
  ];

  const score_explanation_text = factors
    .map(f => `${f.label} (${f.weight}): ${f.value}/100`)
    .join(' | ');

  return { overall_investor_fit_score, score_explanation_text };
}

/**
 * Score rank label
 */
function getScoreLabel(score) {
  if (score >= 80) return 'Excellent';
  if (score >= 65) return 'Strong';
  if (score >= 50) return 'Moderate';
  if (score >= 35) return 'Low';
  return 'Weak';
}

module.exports = { calculateOverallScore, getScoreLabel };
