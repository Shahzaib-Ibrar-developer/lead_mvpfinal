const axios = require('axios');

/**
 * Enrich a person's contact details using Apollo People Match API
 * Gets email and LinkedIn immediately (no phone - that's on-demand only)
 */
async function enrichPersonContact(apolloPersonId, includePhone = false) {
  const APOLLO_API_KEY = process.env.APOLLO_API_KEY;

  if (!APOLLO_API_KEY || APOLLO_API_KEY === 'your_apollo_api_key_here') {
    console.log('⚠️  No Apollo API key - skipping enrichment');
    return null;
  }

  try {
    console.log(`🔍 Enriching contact for person ID: ${apolloPersonId}${includePhone ? ' (with phone)' : ''}`);
    
    const requestBody = {
      id: apolloPersonId,
      reveal_personal_emails: true
    };

    // Only include phone reveal if explicitly requested
    if (includePhone) {
      const webhookUrl = process.env.WEBHOOK_BASE_URL 
        ? `${process.env.WEBHOOK_BASE_URL}/api/webhooks/apollo-enrichment`
        : 'http://localhost:5000/api/webhooks/apollo-enrichment';
      
      console.log(`📡 Webhook URL: ${webhookUrl}`);
      requestBody.reveal_phone_number = true;
      requestBody.webhook_url = webhookUrl;
    }
    
    const response = await axios.post(
      'https://api.apollo.io/api/v1/people/match',
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': APOLLO_API_KEY
        }
      }
    );

    const person = response.data.person;
    
    if (!person) {
      console.log('❌ No person data returned from enrichment');
      return null;
    }

    if (includePhone) {
      console.log('✅ Enrichment requested - phone will arrive via webhook');
    } else {
      console.log('✅ Email/LinkedIn enrichment complete (no phone requested)');
    }
    
    console.log('📊 Immediate data:', {
      email: person.email || 'N/A',
      phone: includePhone ? 'Pending webhook' : 'Not requested',
      linkedin: person.linkedin_url || 'N/A'
    });

    // Return immediate data (phone only comes via webhook if requested)
    return {
      actual_email: person.email || null,
      actual_phone: null,
      actual_linkedin_url: person.linkedin_url || null,
      enriched: !includePhone, // Only mark as enriched if we're not waiting for phone
      enrichment_requested: includePhone,
      enriched_at: new Date()
    };
  } catch (err) {
    console.error('Apollo enrichment error:', err.response?.data || err.message);
    return null;
  }
}

module.exports = { enrichPersonContact };
