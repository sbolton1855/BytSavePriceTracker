import axios from 'axios';
import { promises as fs } from 'fs';

async function log(message) {
    await fs.appendFile('search-test.log', message + '\n');
}

async function testSearch() {
    try {
        await log('🔍 Starting search test...');
        
        const config = {
            method: 'post',
            url: 'https://webservices.amazon.com/paapi5/searchitems',
            headers: {
                'Host': 'webservices.amazon.com',
                'Accept': 'application/json, text/javascript',
                'Accept-Language': 'en-US',
                'Content-Type': 'application/json; charset=UTF-8',
                'X-Amz-Date': '20250529T034154Z',
                'X-Amz-Target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems',
                'Content-Encoding': 'amz-1.0',
                'Authorization': 'AWS4-HMAC-SHA256 Credential=AKIAJ5FQA5U7RIAD6M4Q/20250529/us-east-1/ProductAdvertisingAPI/aws4_request SignedHeaders=content-encoding;host;x-amz-date;x-amz-target Signature=518390161887bea8a6ee17ac6952706bc93124aa8b3bd65a67298241ae092caa'
            },
            data: {
                "Keywords": "usb charger",
                "Resources": [
                    "ItemInfo.Title",
                    "Offers.Listings.Price"
                ],
                "PartnerTag": "bytsave-20",
                "PartnerType": "Associates",
                "Marketplace": "www.amazon.com"
            }
        };

        await log('\nRequest config:');
        await log(JSON.stringify(config, null, 2));

        const response = await axios(config);

        await log('\nResponse received:');
        await log('Status: ' + response.status);
        await log('Headers: ' + JSON.stringify(response.headers, null, 2));
        await log('Data: ' + JSON.stringify(response.data, null, 2));

        if (response.data?.SearchResult?.Items?.length > 0) {
            await log('\nSearch successful!');
            await log(`Found ${response.data.SearchResult.Items.length} items`);
            
            const firstItem = response.data.SearchResult.Items[0];
            await log('\nFirst item:');
            await log(`Title: ${firstItem.ItemInfo?.Title?.DisplayValue}`);
            await log(`ASIN: ${firstItem.ASIN}`);
            if (firstItem.Offers?.Listings?.[0]?.Price) {
                await log(`Price: ${firstItem.Offers.Listings[0].Price.DisplayAmount}`);
            }
        }
    } catch (error) {
        await log('\n❌ Search failed!');
        await log('Error: ' + error.message);
        if (error.response) {
            await log('Status: ' + error.response.status);
            await log('Error details: ' + JSON.stringify(error.response.data, null, 2));
            await log('Headers: ' + JSON.stringify(error.response.headers, null, 2));
        }
    }
}

// Run test and show output
await fs.writeFile('search-test.log', '');
await testSearch();
const logContent = await fs.readFile('search-test.log', 'utf8');
console.log(logContent); 