import crypto from 'crypto';
import axios from 'axios';

const ACCESS_KEY = process.env.AMAZON_ACCESS_KEY;
const SECRET_KEY = process.env.AMAZON_SECRET_KEY;
const PARTNER_TAG = process.env.AMAZON_PARTNER_TAG;
const REGION = 'us-east-1';
const HOST = 'webservices.amazon.com';
const SERVICE = 'ProductAdvertisingAPI';

function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string) {
  const kDate = crypto.createHmac('sha256', 'AWS4' + key).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  return kSigning;
}

function createSignature(method: string, uri: string, payload: string, timestamp: string): {
  authorization: string;
  'x-amz-date': string;
} {
  if (!ACCESS_KEY || !SECRET_KEY) {
    throw new Error('Amazon API credentials not found');
  }

  const date = timestamp.split('T')[0];
  const target = `com.amazon.paapi5.v1.ProductAdvertisingAPIv1.${uri.split('/').pop()}`;

  // Create canonical request - headers must be in alphabetical order
  const canonicalHeaders = 
    'content-encoding:amz-1.0\n' +
    'host:' + HOST + '\n' +
    'x-amz-date:' + timestamp + '\n' +
    'x-amz-target:' + target + '\n';

  const signedHeaders = 'content-encoding;host;x-amz-date;x-amz-target';
  
  const payloadHash = crypto.createHash('sha256').update(payload).digest('hex');
  
  const canonicalRequest = 
    method + '\n' +
    uri + '\n' +
    '\n' +
    canonicalHeaders + '\n' +
    signedHeaders + '\n' +
    payloadHash;

  // Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = date + '/' + REGION + '/' + SERVICE + '/aws4_request';
  const stringToSign = 
    algorithm + '\n' +
    timestamp + '\n' +
    credentialScope + '\n' +
    crypto.createHash('sha256').update(canonicalRequest).digest('hex');

  // Calculate signature
  const signingKey = getSignatureKey(SECRET_KEY, date, REGION, SERVICE);
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  // Create authorization header
  const authorization = algorithm + ' ' +
    'Credential=' + ACCESS_KEY + '/' + credentialScope + ', ' +
    'SignedHeaders=' + signedHeaders + ', ' +
    'Signature=' + signature;

  return {
    authorization,
    'x-amz-date': timestamp
  };
}

export async function makeAmazonApiRequest(operation: string, payload: any): Promise<any> {
  const uri = `/paapi5/${operation.toLowerCase()}`;
  const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const stringifiedPayload = JSON.stringify(payload);
  
  const signature = createSignature('POST', uri, stringifiedPayload, timestamp);
  const target = `com.amazon.paapi5.v1.ProductAdvertisingAPIv1.${operation}`;

  try {
    const response = await axios({
      method: 'POST',
      url: `https://${HOST}${uri}`,
      headers: {
        'Host': HOST,
        'Accept': 'application/json, text/javascript',
        'Accept-Language': 'en-US',
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Amz-Date': signature['x-amz-date'],
        'X-Amz-Target': target,
        'Content-Encoding': 'amz-1.0',
        'Authorization': signature.authorization
      },
      data: stringifiedPayload,
      timeout: 15000
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.log('Amazon API Error Response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        headers: error.response.headers
      });
      
      const errorMessage = error.response.data?.Errors?.[0]?.Message || 
                          error.response.data?.Output?.__type || 
                          'Error communicating with Amazon API';
      throw new Error(errorMessage);
    }
    console.log('Amazon API Network Error:', error.message);
    throw new Error('Network error communicating with Amazon API');
  }
}

export async function searchProductsFixed(query: string): Promise<any[]> {
  const payload = {
    Keywords: query,
    PartnerTag: PARTNER_TAG,
    PartnerType: 'Associates',
    Marketplace: 'www.amazon.com',
    SearchIndex: 'All',
    Resources: [
      'Images.Primary.Medium',
      'ItemInfo.Title',
      'ItemInfo.Features',
      'Offers.Listings.Price'
    ]
  };

  const response = await makeAmazonApiRequest('SearchItems', payload);
  return response.SearchResult?.Items || [];
}

export async function getItemsFixed(asins: string[]): Promise<any[]> {
  const payload = {
    ItemIds: asins,
    PartnerTag: PARTNER_TAG,
    PartnerType: 'Associates',
    Marketplace: 'www.amazon.com',
    Resources: [
      'Images.Primary.Medium',
      'ItemInfo.Title',
      'ItemInfo.Features',
      'Offers.Listings.Price'
    ]
  };

  const response = await makeAmazonApiRequest('GetItems', payload);
  return response.ItemsResult?.Items || [];
}