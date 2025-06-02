import { fetchSignedAmazonRequest } from './lib/awsSignedRequest';

// Test payload that matches Amazon Scratchpad exactly
const scratchpadPayload = {
  ItemIds: ["B08N5WRWNW"],
  Resources: [
    "Images.Primary.Small",
    "ItemInfo.Title", 
    "Offers.Listings.Price"
  ],
  PartnerTag: "bytsave-20",
  PartnerType: "Associates",
  Marketplace: "www.amazon.com"
};

async function testScratchpadRequest() {
  console.log('📋 Testing with Scratchpad-style payload:');
  console.log(JSON.stringify(scratchpadPayload, null, 2));
  
  try {
    const response = await fetchSignedAmazonRequest('/paapi5/getitems', scratchpadPayload);
    console.log('✅ Success! Response:', JSON.stringify(response, null, 2));
  } catch (error: any) {
    console.error('❌ Failed:', error.message);
    
    // If you got a successful response in scratchpad but error here,
    // compare these values with your scratchpad:
    console.log('\n🔍 Debug Info for Scratchpad Comparison:');
    console.log('1. Check your Access Key matches (first 5 chars):', process.env.AMAZON_ACCESS_KEY?.substring(0, 5));
    console.log('2. Check your Partner Tag:', process.env.AMAZON_PARTNER_TAG);
    console.log('3. Check region is us-east-1');
    console.log('4. Verify Secret Key is correct (cannot display for security)');
  }
}

// Run the test
testScratchpadRequest(); 