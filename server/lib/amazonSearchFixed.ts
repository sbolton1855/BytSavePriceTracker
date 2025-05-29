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

function createAWSSignature(payload: string): {
  timestamp: string;
  authorization: string;
} {
  if (!ACCESS_KEY || !SECRET_KEY) {
    throw new Error('Amazon API credentials not found');
  }

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = timestamp.split('T')[0];
  
  const algorithm = 'AWS4-HMAC-SHA256';
  const service = 'ProductAdvertisingAPI';
  const region = 'us-east-1';
  const host = 'webservices.amazon.com';
  const uri = '/paapi5/searchitems';
  const target = 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems';

  // Create canonical request exactly like your working curl
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
  const signingKey = getSignatureKey(SECRET_KEY, dateStamp, region, service);
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  // Create authorization header
  const authorization = algorithm + ' ' +
    'Credential=' + ACCESS_KEY + '/' + credentialScope + ', ' +
    'SignedHeaders=' + signedHeaders + ', ' +
    'Signature=' + signature;

  return { timestamp, authorization };
}

export async function searchAmazonProducts(query: string): Promise<any[]> {
  if (!ACCESS_KEY || !SECRET_KEY || !PARTNER_TAG) {
    throw new Error('Amazon API credentials not configured');
  }

  const payload = JSON.stringify({
    Keywords: query,
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

  const { timestamp, authorization } = createAWSSignature(payload);

  try {
    const response = await axios({
      method: 'POST',
      url: 'https://webservices.amazon.com/paapi5/searchitems',
      headers: {
        'Host': 'webservices.amazon.com',
        'Accept': 'application/json, text/javascript',
        'Accept-Language': 'en-US',
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Amz-Date': timestamp,
        'X-Amz-Target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems',
        'Content-Encoding': 'amz-1.0',
        'Authorization': authorization
      },
      data: payload,
      timeout: 15000
    });

    return response.data?.SearchResult?.Items || [];
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.log('Amazon Search API Error:', {
        status: error.response.status,
        data: error.response.data
      });
      
      const errorMessage = error.response.data?.Errors?.[0]?.Message || 
                          error.response.data?.__type || 
                          'Amazon search failed';
      throw new Error(errorMessage);
    }
    throw new Error('Network error during Amazon search');
  }
}