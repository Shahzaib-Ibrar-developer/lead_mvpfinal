const mongoose = require('mongoose');

const NormalizedInvestorProfileSchema = new mongoose.Schema({
  search_request_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SearchRequest' },
  raw_apollo_record_id: { type: mongoose.Schema.Types.ObjectId, ref: 'RawApolloRecord' },
  person_full_name_cleaned: { type: String },
  organization_name_cleaned: { type: String },
  standardized_job_title: { type: String },
  investor_type_classified: {
    type: String,
    enum: ['family_office', 'private_investor', 'real_estate_operator', 'fund_manager', 'unknown'],
    default: 'unknown'
  },
  location_standardized: { type: String },
  company_domain: { type: String },
  linkedin_url: { type: String },
  contact_availability_score: { type: Number, default: 0 }, // 0–100
  data_source: { type: String, default: 'apollo' },
  is_duplicate: { type: Boolean, default: false },
  duplicate_of: { type: mongoose.Schema.Types.ObjectId, ref: 'NormalizedInvestorProfile' },
  duplicate_match_confidence_score: { type: Number, default: 0 },
  shortlist_status: {
    type: String,
    enum: ['none', 'saved', 'contacted', 'rejected'],
    default: 'none'
  },
  created_at: { type: Date, default: Date.now }
});

// Database indexes for faster queries
NormalizedInvestorProfileSchema.index({ search_request_id: 1, is_duplicate: 1 });
NormalizedInvestorProfileSchema.index({ search_request_id: 1 });
NormalizedInvestorProfileSchema.index({ linkedin_url: 1 });
NormalizedInvestorProfileSchema.index({ person_full_name_cleaned: 1, organization_name_cleaned: 1 });

module.exports = mongoose.model('NormalizedInvestorProfile', NormalizedInvestorProfileSchema);
