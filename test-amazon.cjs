const ProductAdvertisingAPIv1 = require('paapi5-nodejs-sdk');

const defaultClient = ProductAdvertisingAPIv1.ApiClient.instance;

// Set credentials
defaultClient.accessKey = process.env.AMAZON_ACCESS_KEY;
defaultClient.secretKey = process.env.AMAZON_SECRET_KEY;
defaultClient.host = 'webservices.amazon.com';
defaultClient.region = process.env.AWS_REGION || 'us-east-1';

const api = new ProductAdvertisingAPIv1.DefaultApi();

// Create search request
const searchRequest = new ProductAdvertisingAPIv1.SearchItemsRequest();
searchRequest.PartnerTag = process.env.AMAZON_PARTNER_TAG;
searchRequest.PartnerType = 'Associates';
searchRequest.Keywords = 'usb charger';
searchRequest.Resources = ['ItemInfo.Title', 'Offers.Listings.Price'];

async function testAmazonApi() {
    console.log('Starting Amazon API test...');
    console.log('Using credentials:');
    console.log('Access Key:', process.env.AMAZON_ACCESS_KEY?.substring(0, 5) + '...');
    console.log('Partner Tag:', process.env.AMAZON_PARTNER_TAG);
    console.log('Region:', process.env.AWS_REGION || 'us-east-1');
    
    try {
        console.log('\nSending search request...');
        const response = await api.searchItems(searchRequest);
        
        console.log('\nResponse received:');
        if (response.SearchResult?.Items) {
            console.log('Items found:', response.SearchResult.Items.length);
            
            if (response.SearchResult.Items.length > 0) {
                const firstItem = response.SearchResult.Items[0];
                console.log('\nFirst item:');
                console.log('Title:', firstItem.ItemInfo?.Title?.DisplayValue);
                if (firstItem.Offers?.Listings?.[0]?.Price) {
                    console.log('Price:', firstItem.Offers.Listings[0].Price.DisplayAmount);
                }
            }
        }
    } catch (error) {
        console.error('\nError occurred:');
        console.error('Name:', error.name);
        console.error('Message:', error.message);
        
        if (error.response) {
            console.error('\nResponse error details:');
            console.error('Status:', error.response.status);
            console.error('Headers:', JSON.stringify(error.response.headers, null, 2));
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testAmazonApi().catch(console.error); 