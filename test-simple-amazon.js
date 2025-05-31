import axios from 'axios';

const credentials = {
    accessKey: process.env.AMAZON_ACCESS_KEY,
    secretKey: process.env.AMAZON_SECRET_KEY,
    partnerTag: process.env.AMAZON_PARTNER_TAG,
    region: process.env.AWS_REGION || 'us-east-1'
};

console.log('Starting simple Amazon API test');
console.log('Credentials loaded:');
console.log('- Access Key:', credentials.accessKey?.substring(0, 5) + '...');
console.log('- Partner Tag:', credentials.partnerTag);
console.log('- Region:', credentials.region);

// Simple test request
const testRequest = {
    url: 'https://webservices.amazon.com/paapi5/searchitems',
    method: 'GET',
    headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json'
    }
};

console.log('\nMaking test request to:', testRequest.url);

try {
    const response = await axios(testRequest);
    console.log('\nResponse received:');
    console.log('Status:', response.status);
    console.log('Headers:', JSON.stringify(response.headers, null, 2));
    console.log('Data:', JSON.stringify(response.data, null, 2));
} catch (error) {
    console.error('\nError occurred:');
    console.error('Name:', error.name);
    console.error('Message:', error.message);
    
    if (error.response) {
        console.error('\nResponse error details:');
        console.error('Status:', error.response.status);
        console.error('Headers:', JSON.stringify(error.response.headers, null, 2));
        console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
        console.error('\nRequest error (no response received):');
        console.error(error.request);
    }
    
    if (error.code) {
        console.error('\nError code:', error.code);
    }
} 