import crypto from "crypto";
import axios from "axios";

// Amazon API configuration
const ACCESS_KEY = process.env.AMAZON_ACCESS_KEY;
const SECRET_KEY = process.env.AMAZON_SECRET_KEY;
const REGION = "us-east-1";
const HOST = "webservices.amazon.com";
const SERVICE = "ProductAdvertisingAPI";

// Debug credential loading
console.log('[AWS] Credential Check on Load:');
console.log('[AWS] ACCESS_KEY present:', !!ACCESS_KEY);
console.log('[AWS] ACCESS_KEY length:', ACCESS_KEY?.length);
console.log('[AWS] ACCESS_KEY starts with:', ACCESS_KEY?.substring(0, 5) + '...');
console.log('[AWS] SECRET_KEY present:', !!SECRET_KEY);
console.log('[AWS] SECRET_KEY length:', SECRET_KEY?.length);

// AWS SigV4 signer for Amazon PA-API v5
function signRequest(
  method: string,
  payload: string,
  timestamp: string,
  accessKey: string,
  secretKey: string,
  uri: string,
  target: string,
): { authorization: string; "x-amz-date": string } {
  const date = timestamp.substring(0, 8); // Extract YYYYMMDD from YYYYMMDDTHHmmssZ

  // Step 1: Canonical Request
  const canonicalHeaders =
    "content-encoding:amz-1.0\n" +
    "content-type:application/json; charset=UTF-8\n" +
    "host:" + HOST + "\n" +
    "x-amz-date:" + timestamp + "\n" +
    "x-amz-target:" + target + "\n";

  const signedHeaders = "content-encoding;content-type;host;x-amz-date;x-amz-target";

  const payloadHash = crypto.createHash("sha256").update(payload).digest("hex");

  const canonicalRequest =
    method + "\n" +
    uri + "\n\n" +
    canonicalHeaders + "\n" +
    signedHeaders + "\n" +
    payloadHash;

  // Step 2: String to Sign
  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${date}/${REGION}/${SERVICE}/aws4_request`;
  const canonicalRequestHash = crypto
    .createHash("sha256")
    .update(canonicalRequest)
    .digest("hex");

  const stringToSign = `${algorithm}\n${timestamp}\n${credentialScope}\n${canonicalRequestHash}`;

  // LOGGING for debugging signature issues
  console.log('---[AWS SIGV4 DEBUG]---');
  console.log('[Canonical Request]\n' + canonicalRequest);
  console.log('[String to Sign]\n' + stringToSign);
  console.log('[Payload for Signing]\n' + payload);
  console.log('----------------------');

  // Step 3: Signature Key
  const kDate = crypto
    .createHmac("sha256", "AWS4" + secretKey)
    .update(date)
    .digest();
  const kRegion = crypto.createHmac("sha256", kDate).update(REGION).digest();
  const kService = crypto
    .createHmac("sha256", kRegion)
    .update(SERVICE)
    .digest();
  const kSigning = crypto
    .createHmac("sha256", kService)
    .update("aws4_request")
    .digest();

  const signature = crypto
    .createHmac("sha256", kSigning)
    .update(stringToSign)
    .digest("hex");

  // Step 4: Authorization Header
  const authorization = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    authorization,
    "x-amz-date": timestamp,
  };
}

export async function fetchSignedAmazonRequest(uri: string, payload: any): Promise<any> {
  console.log('📡 [AWS] fetchSignedAmazonRequest called');
  console.log('[AWS] URI:', uri);
  console.log('[AWS] Payload (object):', payload);
  const stringifiedPayload = JSON.stringify(payload);
  console.log('[AWS] Payload (stringified):', stringifiedPayload);
  
  if (!ACCESS_KEY || !SECRET_KEY) {
    console.error('[AWS] Missing credentials:', {
      ACCESS_KEY: ACCESS_KEY ? 'Set' : 'Missing',
      SECRET_KEY: SECRET_KEY ? 'Set' : 'Missing'
    });
    throw new Error('Amazon API credentials not found in environment variables');
  }

  // Create proper timestamp in ISO format
  let now = new Date();
  
  // TEMPORARY FIX: If system time is in 2025, adjust it back to 2024
  if (now.getFullYear() === 2025) {
    console.warn('[AWS] System time is in 2025, adjusting to 2024 for API compatibility');
    // Set the date back by approximately 1 year
    now = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000));
  }
  
  const timestamp = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  
  console.log('[AWS] Adjusted date:', now.toISOString());
  console.log('[AWS] Generated timestamp:', timestamp);
  console.log('[AWS] System time check:', {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    systemTime: Date.now()
  });
  
  // Validate timestamp is not in the future
  if (now.getFullYear() > 2024) {
    console.error('[AWS] WARNING: System time appears to be in the future!');
  }
  
  // Extract operation name and capitalize it properly
  const operationName = uri.split('/').pop() || '';
  let properOperation = '';
  
  // Map the operation names correctly
  if (operationName.toLowerCase() === 'searchitems') {
    properOperation = 'SearchItems';
  } else if (operationName.toLowerCase() === 'getitems') {
    properOperation = 'GetItems';
  } else {
    // Default capitalization for other operations
    properOperation = operationName.charAt(0).toUpperCase() + operationName.slice(1);
  }
  
  const target = `com.amazon.paapi5.v1.ProductAdvertisingAPIv1.${properOperation}`;

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

  const url = `https://${HOST}${uri}`;
  const headers = {
    'Accept': 'application/json, text/javascript',
    'Accept-Language': 'en-US',
    'Content-Type': 'application/json; charset=UTF-8',
    'X-Amz-Target': target,
    'X-Amz-Date': signature['x-amz-date'],
    'Authorization': signature.authorization,
    'Host': HOST,
    'Content-Encoding': 'amz-1.0'
  };

  console.log('[AWS] Request URL:', url);
  console.log('[AWS] Request headers:', headers);

  try {
    // Remove Operation field if present (Scratchpad does not send it)
    if (payload.Operation) {
      delete payload.Operation;
    }

    const response = await axios({
      method: 'post',
      url,
      headers,
      data: stringifiedPayload,
      transformRequest: [(data) => data],
      timeout: 15000
    });

    console.log('[AWS] Response status:', response.status);
    console.log('[AWS] Response headers:', response.headers);
    console.log('[AWS] Response data:', JSON.stringify(response.data, null, 2));

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error('❌ [AWS] Amazon API Error:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: JSON.stringify(error.response.data, null, 2),
        headers: error.response.headers
      });
      // Log specific error types
      if (error.response.data?.__type) {
        console.error('[AWS] Error Type:', error.response.data.__type);
      }
      const errorMessage = error.response.data?.Errors?.[0]?.Message || 
                          error.response.data?.message || 
                          'Error communicating with Amazon API';
      throw new Error(errorMessage);
    }
    console.error('❌ [AWS] Request failed:', error);
    throw error;
  }
}