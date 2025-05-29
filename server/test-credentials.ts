
import { fetchSignedAmazonRequest } from './lib/awsSignedRequest';

async function testCredentials() {
  console.log('🔧 Testing Amazon API Credentials and Setup');
  console.log('=============================================');
  
  // Check environment variables
  console.log('\n1. Checking Environment Variables:');
  console.log('AMAZON_ACCESS_KEY:', process.env.AMAZON_ACCESS_KEY ? '✅ Set' : '❌ Missing');
  console.log('AMAZON_SECRET_KEY:', process.env.AMAZON_SECRET_KEY ? '✅ Set' : '❌ Missing');
  console.log('AMAZON_PARTNER_TAG:', process.env.AMAZON_PARTNER_TAG || 'Using default: bytsave-20');
  
  if (!process.env.AMAZON_ACCESS_KEY || !process.env.AMAZON_SECRET_KEY) {
    console.log('\n❌ Missing required credentials!');
    return;
  }
  
  // Test 1: Simple GetItems request
  console.log('\n2. Testing GetItems with known ASIN...');
  try {
    const getItemsPayload = {
      ItemIds: ['B08PX626SG'],
      PartnerTag: process.env.AMAZON_PARTNER_TAG || 'bytsave-20',
      PartnerType: 'Associates',
      Marketplace: 'www.amazon.com',
      Resources: ['ItemInfo.Title', 'Offers.Listings.Price']
    };
    
    const response = await fetchSignedAmazonRequest('/paapi5/getitems', getItemsPayload);
    console.log('✅ GetItems Success:', response?.ItemsResult?.Items?.length || 0, 'items found');
  } catch (error) {
    console.log('❌ GetItems Failed:', error.message);
    if ((error as any).response) {
      console.log('Response Status:', (error as any).response.status);
      console.log('Response Data:', JSON.stringify((error as any).response.data, null, 2));
    }
  }
  
  // Test 2: Simple SearchItems request
  console.log('\n3. Testing SearchItems...');
  try {
    const searchPayload = {
      Keywords: 'vitamins',
      PartnerTag: process.env.AMAZON_PARTNER_TAG || 'bytsave-20',
      PartnerType: 'Associates',
      Marketplace: 'www.amazon.com',
      Resources: ['ItemInfo.Title', 'Offers.Listings.Price'],
      ItemCount: 1
    };
    
    const response = await fetchSignedAmazonRequest('/paapi5/searchitems', searchPayload);
    console.log('✅ SearchItems Success:', response?.SearchResult?.Items?.length || 0, 'items found');
  } catch (error) {
    console.log('❌ SearchItems Failed:', error.message);
    if ((error as any).response) {
      console.log('Response Status:', (error as any).response.status);
      console.log('Response Data:', JSON.stringify((error as any).response.data, null, 2));
    }
  }
  
  // Test 3: Check signature generation
  console.log('\n4. Testing Request Signature...');
  const testPayload = { test: 'data' };
  const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  console.log('Timestamp format:', timestamp);
  console.log('Access Key length:', process.env.AMAZON_ACCESS_KEY?.length);
  console.log('Secret Key length:', process.env.AMAZON_SECRET_KEY?.length);
  
  console.log('\n5. Recommendations:');
  console.log('- Verify your Amazon Associate account is active');
  console.log('- Check if your Product Advertising API access is approved');
  console.log('- Ensure credentials are from the correct AWS region (us-east-1)');
  console.log('- Verify the Partner Tag matches your Associate ID');
}

testCredentials().catch(console.error);
