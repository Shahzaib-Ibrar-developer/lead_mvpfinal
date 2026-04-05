const mongoose = require('mongoose');

const SearchRequestSchema = new mongoose.Schema({
  investor_type_filter: { type: String, default: '' },
  target_geography: { type: String, default: '' },
  company_industry_filter: { type: String, default: '' },
  job_title_keywords: { type: String, default: '' },
  minimum_estimated_check_size: { type: String, default: '' },
  maximum_estimated_check_size: { type: String, default: '' },
  real_estate_interest_keywords: { type: String, default: '' },
  search_notes_optional: { type: String, default: '' },
  optimization_notes: { type: String, default: '' },
  total_apollo_results: { type: Number, default: 0 },
  current_page: { type: Number, default: 0 },
  total_pages: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'running', 'completed', 'failed'], default: 'pending' },
  results_count: { type: Number, default: 0 },
  progress: { type: Number, default: 0, min: 0, max: 100 },
  created_at: { type: Date, default: Date.now },
  completed_at: { type: Date },
  error_message: { type: String }
});

module.exports = mongoose.model('SearchRequest', SearchRequestSchema);
