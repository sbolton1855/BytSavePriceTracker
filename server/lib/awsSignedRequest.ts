import crypto from 'crypto';
import axios from 'axios';

// Amazon API configuration
const ACCESS_KEY = process.env.AMAZON_ACCESS_KEY;
const SECRET_KEY = process.env.AMAZON_SECRET_KEY;
const REGION = 'us-east-1';
const HOST = 'webservices.amazon.com';
const SERVICE = 'ProductAdvertisingAPI';

// Function to sign request with AWS Signature Version 4
function signRequest(
  method: string,
  payload: string,
  timestamp: string,
  accessKey: string,
  secretKey: string,
  uri: string,
  target: string
): { authorization: string; 'x-amz-date': string } {
  const date = timestamp.split('T')[0];
  
  // Step 1: Create canonical request
  const canonicalHeaders = 
    'content-encoding:amz-1.0\n' +
    'content-type:application/json; charset=utf-8\n' +
    'host:' + HOST + '\n' +
    'x-amz-date:' + timestamp + '\n' +
    `x-amz-target:${target}\n`;
    
  const signedHeaders = 'content-encoding;content-type;host;x-amz-date;x-amz-target';
  
  const payloadHash = crypto
    .createHash('sha256')
    .update(payload)
    .digest('hex');
    
  const canonicalRequest = 
    method + '\n' +
    uri + '\n' +
    '\n' + // Query string
    canonicalHeaders + '\n' +
    signedHeaders + '\n' +
    payloadHash;
    
  // Step 2: Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = date + '/' + REGION + '/' + SERVICE + '/aws4_request';
  const canonicalRequestHash = crypto
    .createHash('sha256')
    .update(canonicalRequest)
    .digest('hex');
    
  const stringToSign = 
    algorithm + '\n' +
    timestamp + '\n' +
    credentialScope + '\n' +
    canonicalRequestHash;
    
  // Step 3: Calculate signature
  const kDate = crypto
    .createHmac('sha256', 'AWS4' + secretKey)
    .update(date)
    .digest();
    
  const kRegion = crypto
    .createHmac('sha256', kDate)
    .update(REGION)
    .digest();
    
  const kService = crypto
    .createHmac('sha256', kRegion)
    .update(SERVICE)
    .digest();
    
  const kSigning = crypto
    .createHmac('sha256', kService)
    .update('aws4_request')
    .digest();
    
  const signature = crypto
    .createHmac('sha256', kSigning)
    .update(stringToSign)
    .digest('hex');
    
  // Step 4: Create authorization header
  const authorization = 
    algorithm + ' ' +
    'Credential=' + accessKey + '/' + credentialScope + ', ' +
    'SignedHeaders=' + signedHeaders + ', ' +
    'Signature=' + signature;
    
  return {
    authorization: authorization,
    'x-amz-date': timestamp,
  };
}

export async function fetchSignedAmazonRequest(uri: string, payload: any): Promise<any> {
  if (!ACCESS_KEY || !SECRET_KEY) {
    throw new Error('Amazon API credentials not found in environment variables');
  }

  const stringifiedPayload = JSON.stringify(payload);
  const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const target = `com.amazon.paapi5.v1.ProductAdvertisingAPIv1.${uri.split('/').pop()}`;

  // Sign the request
  const signature = signRequest(
    'POST',
    stringifiedPayload,
    timestamp,
    ACCESS_KEY,
    SECRET_KEY,
    uri,
    target
  );

  try {
    const response = await axios({
      method: 'post',
      url: `https://${HOST}${uri}`,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Encoding': 'amz-1.0',
        'X-Amz-Target': target,
        'X-Amz-Date': signature['x-amz-date'],
        'Authorization': signature.authorization,
        'Host': HOST
      },
      data: stringifiedPayload,
      timeout: 15000
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const errorMessage = error.response.data?.Errors?.[0]?.Message || 'Error communicating with Amazon API';
      throw new Error(errorMessage);
    }
    throw error;
  }
} 