const mongoose = require('mongoose');

const RawApolloRecordSchema = new mongoose.Schema({
  search_request_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SearchRequest', required: true },
  apollo_person_id: { type: String },
  full_name: { type: String },
  job_title: { type: String },
  organization_name: { type: String },
  organization_domain: { type: String },
  linkedin_url: { type: String },
  location_city: { type: String },
  location_country: { type: String },
  email_status: { type: String },
  phone_status: { type: String },
  actual_email: { type: String },
  actual_phone: { type: String },
  actual_linkedin_url: { type: String },
  enriched: { type: Boolean, default: false },
  enrichment_requested: { type: Boolean, default: false },
  enriched_at: { type: Date },
  seniority_level: { type: String },
  department: { type: String },
  company_size: { type: String },
  industry: { type: String },
  raw_json_payload: { type: mongoose.Schema.Types.Mixed }, // Full raw JSON
  ingested_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RawApolloRecord', RawApolloRecordSchema);
