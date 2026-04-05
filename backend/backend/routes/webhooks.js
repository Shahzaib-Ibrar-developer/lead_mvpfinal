const express = require('express');
const router = express.Router();
const RawApolloRecord = require('../models/RawApolloRecord');

// POST /api/webhooks/apollo-enrichment — Receive Apollo enrichment webhook
router.post('/apollo-enrichment', async (req, res) => {
  try {
    console.log('📨 Received Apollo webhook:', JSON.stringify(req.body, null, 2));
    
    const { people, status } = req.body;
    
    if (!people || !Array.isArray(people) || people.length === 0) {
      console.log('⚠️  Invalid webhook payload - missing people array');
      return res.status(400).json({ error: 'Invalid payload' });
    }

    if (status !== 'success') {
      console.log(`⚠️  Webhook status: ${status}`);
      return res.status(200).json({ message: 'Non-success status received' });
    }

    // Process each person in the webhook
    for (const personData of people) {
      const { id, phone_numbers } = personData;
      
      if (!id) {
        console.log('⚠️  Person missing ID, skipping');
        continue;
      }

      // Find the raw record by Apollo person ID
      const rawRecord = await RawApolloRecord.findOne({ apollo_person_id: id });
      
      if (!rawRecord) {
        console.log(`⚠️  No record found for Apollo ID: ${id}`);
        continue;
      }

      // Extract phone number
      const updateData = {
        enriched: true,
        enriched_at: new Date()
      };

      if (phone_numbers && phone_numbers.length > 0) {
        const phone = phone_numbers[0];
        updateData.actual_phone = phone.sanitized_number || phone.raw_number;
        console.log(`✅ Phone enriched: ${updateData.actual_phone} (${phone.type_cd})`);
      }

      // Update the record
      await RawApolloRecord.findByIdAndUpdate(rawRecord._id, updateData);
      console.log(`✅ Enrichment complete for Apollo ID: ${id}`);
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Enrichment received',
      processed: people.length 
    });
  } catch (err) {
    console.error('❌ Webhook error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
