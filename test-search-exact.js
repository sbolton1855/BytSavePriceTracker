const axios = require('axios');

async function testSearch() {
    try {
        console.log('Testing search with exact cURL match...');
        
        const response = await axios({
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
        });

        if (response.data) {
            console.log('\nSearch successful!');
            console.log('Items found:', response.data?.SearchResult?.Items?.length || 0);
            if (response.data?.SearchResult?.Items?.length > 0) {
                const firstItem = response.data.SearchResult.Items[0];
                console.log('\nFirst item:');
                console.log('Title:', firstItem.ItemInfo?.Title?.DisplayValue);
                console.log('ASIN:', firstItem.ASIN);
                if (firstItem.Offers?.Listings?.[0]?.Price) {
                    console.log('Price:', firstItem.Offers.Listings[0].Price.DisplayAmount);
                }
            }
        }
    } catch (error) {
        console.error('\nSearch failed!');
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Error details:', error.response.data);
            console.error('Headers:', JSON.stringify(error.response.headers, null, 2));
        }
        process.exit(1);
    }
}

// Run the test
console.log('🔍 Starting Amazon Product Search Test');
testSearch(); 