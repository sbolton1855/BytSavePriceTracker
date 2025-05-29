import crypto from 'crypto';
import axios from 'axios';

const ACCESS_KEY = process.env.AMAZON_ACCESS_KEY;
const SECRET_KEY = process.env.AMAZON_SECRET_KEY;
const PARTNER_TAG = process.env.AMAZON_PARTNER_TAG;

function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string) {
  const kDate = crypto.createHmac('sha256', 'AWS4' + key).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  return kSigning;
}

function createAWSSignature(payload: string, operation: 'GetItems' | 'SearchItems') {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = timestamp.split('T')[0];
  
  const algorithm = 'AWS4-HMAC-SHA256';
  const service = 'ProductAdvertisingAPI';
  const region = 'us-east-1';
  const host = 'webservices.amazon.com';
  
  const uri = operation === 'GetItems' ? '/paapi5/getitems' : '/paapi5/searchitems';
  const target = operation === 'GetItems' 
    ? 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems'
    : 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems';

  // Create canonical request
  const canonicalHeaders = 
    'content-encoding:amz-1.0\n' +
    'host:' + host + '\n' +
    'x-amz-date:' + timestamp + '\n' +
    'x-amz-target:' + target + '\n';

  const signedHeaders = 'content-encoding;host;x-amz-date;x-amz-target';
  const payloadHash = crypto.createHash('sha256').update(payload).digest('hex');

  const canonicalRequest = 
    'POST\n' +
    uri + '\n' +
    '\n' +
    canonicalHeaders + '\n' +
    signedHeaders + '\n' +
    payloadHash;

  // Create string to sign
  const credentialScope = dateStamp + '/' + region + '/' + service + '/aws4_request';
  const stringToSign = 
    algorithm + '\n' +
    timestamp + '\n' +
    credentialScope + '\n' +
    crypto.createHash('sha256').update(canonicalRequest).digest('hex');

  // Calculate signature
  const signingKey = getSignatureKey(SECRET_KEY!, dateStamp, region, service);
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  // Create authorization header
  const authorization = algorithm + ' ' +
    'Credential=' + ACCESS_KEY + '/' + credentialScope + ', ' +
    'SignedHeaders=' + signedHeaders + ', ' +
    'Signature=' + signature;

  return { timestamp, authorization, target, uri };
}

async function testGetItems() {
  console.log('\n=== TESTING GETITEMS ===');
  
  const payload = JSON.stringify({
    ItemIds: ['B08N5WRWNW'],
    PartnerTag: PARTNER_TAG,
    PartnerType: 'Associates',
    Marketplace: 'www.amazon.com',
    Resources: [
      'Images.Primary.Medium',
      'ItemInfo.Title',
      'Offers.Listings.Price'
    ]
  });

  const { timestamp, authorization, target, uri } = createAWSSignature(payload, 'GetItems');
  
  console.log('GetItems URI:', uri);
  console.log('GetItems Target:', target);
  console.log('GetItems Payload:', payload);
  console.log('GetItems Authorization:', authorization.substring(0, 50) + '...');
  
  try {
    const response = await axios({
      method: 'POST',
      url: `https://webservices.amazon.com${uri}`,
      headers: {
        'Host': 'webservices.amazon.com',
        'Accept': 'application/json, text/javascript',
        'Accept-Language': 'en-US',
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Amz-Date': timestamp,
        'X-Amz-Target': target,
        'Content-Encoding': 'amz-1.0',
        'Authorization': authorization
      },
      data: payload,
      timeout: 15000
    });
    
    console.log('GetItems SUCCESS:', response.status);
    console.log('GetItems Response:', JSON.stringify(response.data, null, 2).substring(0, 500) + '...');
  } catch (error: any) {
    console.log('GetItems ERROR:', error.response?.status, error.response?.statusText);
    console.log('GetItems Error Data:', JSON.stringify(error.response?.data, null, 2));
  }
}

async function testSearchItems() {
  console.log('\n=== TESTING SEARCHITEMS ===');
  
  const payload = JSON.stringify({
    Keywords: 'laptop',
    PartnerTag: PARTNER_TAG,
    PartnerType: 'Associates',
    Marketplace: 'www.amazon.com',
    SearchIndex: 'All',
    Resources: [
      'Images.Primary.Medium',
      'ItemInfo.Title',
      'Offers.Listings.Price'
    ]
  });

  const { timestamp, authorization, target, uri } = createAWSSignature(payload, 'SearchItems');
  
  console.log('SearchItems URI:', uri);
  console.log('SearchItems Target:', target);
  console.log('SearchItems Payload:', payload);
  console.log('SearchItems Authorization:', authorization.substring(0, 50) + '...');
  
  try {
    const response = await axios({
      method: 'POST',
      url: `https://webservices.amazon.com${uri}`,
      headers: {
        'Host': 'webservices.amazon.com',
        'Accept': 'application/json, text/javascript',
        'Accept-Language': 'en-US',
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Amz-Date': timestamp,
        'X-Amz-Target': target,
        'Content-Encoding': 'amz-1.0',
        'Authorization': authorization
      },
      data: payload,
      timeout: 15000
    });
    
    console.log('SearchItems SUCCESS:', response.status);
    console.log('SearchItems Response:', JSON.stringify(response.data, null, 2).substring(0, 500) + '...');
  } catch (error: any) {
    console.log('SearchItems ERROR:', error.response?.status, error.response?.statusText);
    console.log('SearchItems Error Data:', JSON.stringify(error.response?.data, null, 2));
  }
}

async function runComparison() {
  if (!ACCESS_KEY || !SECRET_KEY || !PARTNER_TAG) {
    console.error('Missing Amazon API credentials');
    return;
  }
  
  console.log('Amazon API Signature Comparison Test');
  console.log('===================================');
  
  await testGetItems();
  await testSearchItems();
  
  console.log('\n=== COMPARISON COMPLETE ===');
}

runComparison().catch(console.error);