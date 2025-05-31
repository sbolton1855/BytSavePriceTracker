import axios from 'axios';

const HOST = 'webservices.amazon.com';
const API_PATH = '/paapi5/searchitems';

async function testBasicConnection() {
    console.log('Starting basic connection test...');
    
    try {
        console.log('Attempting to connect to:', `https://${HOST}${API_PATH}`);
        
        const response = await axios({
            method: 'get',
            url: `https://${HOST}${API_PATH}`,
            timeout: 5000,
            validateStatus: false
        });
        
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
        
        if (error.code === 'ECONNREFUSED') {
            console.error('\nConnection refused - the server actively rejected the connection');
        } else if (error.code === 'ETIMEDOUT') {
            console.error('\nConnection timed out - the server did not respond in time');
        } else if (error.code === 'ENOTFOUND') {
            console.error('\nHost not found - DNS lookup failed');
        }
    }
}

testBasicConnection(); 