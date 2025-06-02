import axios from 'axios';
import crypto from 'crypto';

const ACCESS_KEY = process.env.AMAZON_ACCESS_KEY;
const SECRET_KEY = process.env.AMAZON_SECRET_KEY;
const PARTNER_TAG = process.env.AMAZON_PARTNER_TAG;
const HOST = 'webservices.amazon.com';
const REGION = 'us-east-1';
const SERVICE = 'ProductAdvertisingAPI';
const ENDPOINT = `https://${HOST}/paapi5/getitems`;
const TEST_ASIN = process.env.TEST_ASIN || 'B0CHVZJDCM';

function getAmzDate() {
  let now = new Date();
  if (now.getFullYear() === 2025) {
    now = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000));
  }
  return now.toISOString().replace(/[:-]|\..+/g, '');
}

function sign({ method, uri, payload, timestamp, accessKey, secretKey, target }:
  { method: string, uri: string, payload: string, timestamp: string, accessKey: string, secretKey: string, target: string }) {
  const date = timestamp.substring(0, 8);
  const canonicalHeaders =
    'content-encoding:amz-1.0\n' +
    'content-type:application/json; charset=UTF-8\n' +
    'host:' + HOST + '\n' +
    'x-amz-date:' + timestamp + '\n' +
    'x-amz-target:' + target + '\n';
  const signedHeaders = 'content-encoding;content-type;host;x-amz-date;x-amz-target';
  const payloadHash = crypto.createHash('sha256').update(payload).digest('hex');
  const canonicalRequest =
    method + '\n' +
    uri + '\n\n' +
    canonicalHeaders + '\n' +
    signedHeaders + '\n' +
    payloadHash;
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${date}/${REGION}/${SERVICE}/aws4_request`;
  const canonicalRequestHash = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
  const stringToSign = `${algorithm}\n${timestamp}\n${credentialScope}\n${canonicalRequestHash}`;
  const kDate = crypto.createHmac('sha256', 'AWS4' + secretKey).update(date).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(REGION).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(SERVICE).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  const authorization = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return { authorization, 'x-amz-date': timestamp, canonicalRequest, stringToSign };
}

async function main() {
  if (!ACCESS_KEY || !SECRET_KEY || !PARTNER_TAG) {
    console.error('Missing credentials or tag');
    process.exit(1);
  }
  const payloadObj = {
    ItemIds: [TEST_ASIN],
    PartnerTag: PARTNER_TAG,
    PartnerType: 'Associates',
    Marketplace: 'www.amazon.com',
    Resources: [
      'Images.Primary.Small',
      'ItemInfo.Title',
      'Offers.Listings.Price'
    ]
  };
  const payload = JSON.stringify(payloadObj);
  const method = 'POST';
  const uri = '/paapi5/getitems';
  const target = 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems';
  const timestamp = getAmzDate();
  const sig = sign({ method, uri, payload, timestamp, accessKey: ACCESS_KEY, secretKey: SECRET_KEY, target });
  const headers = {
    'Accept': 'application/json, text/javascript',
    'Accept-Language': 'en-US',
    'Content-Type': 'application/json; charset=UTF-8',
    'X-Amz-Target': target,
    'X-Amz-Date': sig['x-amz-date'],
    'Authorization': sig.authorization,
    'Host': HOST,
    'Content-Encoding': 'amz-1.0'
  };
  console.log('---[DEBUG]---');
  console.log('Payload:', payload);
  console.log('Canonical Request:\n' + sig.canonicalRequest);
  console.log('String to Sign:\n' + sig.stringToSign);
  console.log('Headers:', headers);
  console.log('---[END DEBUG]---');
  try {
    const response = await axios({
      method: 'post',
      url: ENDPOINT,
      headers,
      data: payload,
      transformRequest: [(data) => data],
      timeout: 15000
    });
    console.log('Response:', response.data);
  } catch (err: any) {
    if (err.response) {
      console.error('Error:', err.response.status, err.response.data);
    } else {
      console.error('Error:', err.message);
    }
  }
}

main(); 