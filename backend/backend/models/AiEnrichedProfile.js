const mongoose = require('mongoose');

const AiEnrichedProfileSchema = new mongoose.Schema({
  normalized_investor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'NormalizedInvestorProfile', required: true },
  search_request_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SearchRequest' },

  // AI Enrichment
  ai_generated_summary: { type: String },
  estimated_investment_capacity_range: { type: String },
  real_estate_interest_score: { type: Number, default: 0 },     // 0–100
  investor_relevance_score: { type: Number, default: 0 },       // 0–100
  confidence_score: { type: Number, default: 0 },               // 0–100
  reasoning_text: { type: String },

  // Scoring Engine (weighted)
  capital_capacity_score: { type: Number, default: 0 },         // 0–100
  decision_making_power_score: { type: Number, default: 0 },    // 0–100
  geography_fit_score: { type: Number, default: 0 },            // 0–100
  data_confidence_score: { type: Number, default: 0 },          // 0–100
  overall_investor_fit_score: { type: Number, default: 0 },     // 0–100 (composite)
  score_explanation_text: { type: String },

  // Signal Tags
  real_estate_signal_detected: { type: Boolean, default: false },
  investment_language_detected: { type: Boolean, default: false },
  executive_role_detected: { type: Boolean, default: false },
  ai_uncertainty_flag: { type: Boolean, default: false },
  data_source_count: { type: Number, default: 1 },

  enriched_at: { type: Date, default: Date.now }
});

// Database indexes for faster queries
AiEnrichedProfileSchema.index({ normalized_investor_id: 1 }, { unique: true });
AiEnrichedProfileSchema.index({ search_request_id: 1 });
AiEnrichedProfileSchema.index({ search_request_id: 1, overall_investor_fit_score: -1 });

module.exports = mongoose.model('AiEnrichedProfile', AiEnrichedProfileSchema);
