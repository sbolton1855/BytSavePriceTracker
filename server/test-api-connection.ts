
import { fetchSignedAmazonRequest } from './lib/awsSignedRequest';

async function testBasicConnection() {
  console.log('🔍 Testing basic Amazon API connection...');
  
  // Test with a known working ASIN
  const payload = {
    ItemIds: ['B08PX626SG'], // YumEarth product that should exist
    PartnerTag: process.env.AMAZON_PARTNER_TAG,
    PartnerType: 'Associates',
    Marketplace: 'www.amazon.com',
    Resources: [
      'ItemInfo.Title',
      'Offers.Listings.Price'
    ]
  };

  try {
    console.log('Making request to Amazon API...');
    const response = await fetchSignedAmazonRequest('/paapi5/getitems', payload);
    console.log('✅ Success:', JSON.stringify(response, null, 2));
  } catch (error) {
    console.error('❌ Error:', error);
    if (error instanceof Error && (error as any).response) {
      console.error('Response details:', {
        status: (error as any).response.status,
        statusText: (error as any).response.statusText,
        data: (error as any).response.data,
        headers: (error as any).response.headers
      });
    }
  }
}

testBasicConnection();
