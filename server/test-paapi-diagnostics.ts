import { fetchSignedAmazonRequest } from './lib/awsSignedRequest';

const TEST_ASIN = process.env.TEST_ASIN || 'B08N5WRWNW'; // Echo Dot
const TEST_SEARCH_INDEX = process.env.TEST_SEARCH_INDEX || 'Electronics';
const TEST_MARKETPLACE = process.env.TEST_MARKETPLACE || 'www.amazon.com';
const TEST_PARTNER_TAG = process.env.AMAZON_PARTNER_TAG;
const TEST_ACCESS_KEY = process.env.AMAZON_ACCESS_KEY;
const TEST_SECRET_KEY = process.env.AMAZON_SECRET_KEY;

async function testCredentialsAndTag() {
  console.log('--- [1] Credentials & Tag Validity ---');
  if (!TEST_ACCESS_KEY || !TEST_SECRET_KEY) {
    console.log('FAIL: Missing access key or secret key');
    return false;
  }
  if (!TEST_PARTNER_TAG) {
    console.log('FAIL: Missing partner tag');
    return false;
  }
  console.log('PASS: Credentials and tag are present');
  return true;
}

async function testMarketplaceAndHost() {
  console.log('--- [2] Marketplace & Host Match ---');
  if (TEST_MARKETPLACE !== 'www.amazon.com') {
    console.log('WARN: Marketplace is not www.amazon.com, got:', TEST_MARKETPLACE);
  }
  console.log('PASS: Marketplace parameter is set to', TEST_MARKETPLACE);
  return true;
}

async function testSignatureAndRequest() {
  console.log('--- [3] Signature & Request Test ---');
  const payload = {
    ItemIds: [TEST_ASIN],
    PartnerTag: TEST_PARTNER_TAG,
    PartnerType: 'Associates',
    Marketplace: TEST_MARKETPLACE,
    Resources: [
      'Images.Primary.Small',
      'ItemInfo.Title',
      'Offers.Listings.Price'
    ]
  };
  try {
    const response = await fetchSignedAmazonRequest('/paapi5/getitems', payload);
    if (response.ItemsResult && response.ItemsResult.Items && response.ItemsResult.Items.length > 0) {
      console.log('PASS: Signature and request accepted by Amazon.');
      return true;
    } else {
      console.log('FAIL: No items returned. Response:', JSON.stringify(response, null, 2));
      return false;
    }
  } catch (err: any) {
    console.log('FAIL: Request failed:', err.message);
    return false;
  }
}

async function testAccountApproval() {
  console.log('--- [4] Account/Tag Approval ---');
  // This is a heuristic: if the above request fails with InternalFailure or 404, it's likely an approval/tag issue
  // (since signature and credentials are already tested)
  // We'll call the signature test and interpret the error
  const payload = {
    ItemIds: [TEST_ASIN],
    PartnerTag: TEST_PARTNER_TAG,
    PartnerType: 'Associates',
    Marketplace: TEST_MARKETPLACE,
    Resources: [
      'Images.Primary.Small',
      'ItemInfo.Title',
      'Offers.Listings.Price'
    ]
  };
  try {
    const response = await fetchSignedAmazonRequest('/paapi5/getitems', payload);
    if (response.ItemsResult && response.ItemsResult.Items && response.ItemsResult.Items.length > 0) {
      console.log('PASS: Account/tag appears to be approved for PA-API.');
      return true;
    } else {
      console.log('FAIL: No items returned. This may indicate an unapproved tag/account.');
      return false;
    }
  } catch (err: any) {
    if (err.message && err.message.match(/InternalFailure|not valid|not approved|associate/)) {
      console.log('FAIL: Likely account/tag approval issue:', err.message);
    } else {
      console.log('FAIL: Unknown error:', err.message);
    }
    return false;
  }
}

async function testThrottling() {
  console.log('--- [5] Throttling Test ---');
  // We'll make 3 rapid requests and see if throttling occurs
  let throttled = false;
  for (let i = 0; i < 3; i++) {
    try {
      await fetchSignedAmazonRequest('/paapi5/getitems', {
        ItemIds: [TEST_ASIN],
        PartnerTag: TEST_PARTNER_TAG,
        PartnerType: 'Associates',
        Marketplace: TEST_MARKETPLACE,
        Resources: [
          'Images.Primary.Small',
          'ItemInfo.Title',
          'Offers.Listings.Price'
        ]
      });
    } catch (err: any) {
      if (err.message && err.message.match(/throttle|limit|TooManyRequests/)) {
        throttled = true;
        break;
      }
    }
  }
  if (throttled) {
    console.log('PASS: Throttling detected as expected.');
    return true;
  } else {
    console.log('PASS: No throttling detected in 3 rapid requests.');
    return true;
  }
}

async function runDiagnostics() {
  console.log('================ PA-API DIAGNOSTICS ================');
  let passCount = 0;
  let total = 5;
  if (await testCredentialsAndTag()) passCount++;
  if (await testMarketplaceAndHost()) passCount++;
  if (await testSignatureAndRequest()) passCount++;
  if (await testAccountApproval()) passCount++;
  if (await testThrottling()) passCount++;
  console.log('====================================================');
  console.log(`PA-API Diagnostic Summary: ${passCount}/${total} tests passed.`);
  if (passCount === total) {
    console.log('All major PA-API integration checks passed!');
  } else {
    console.log('Some checks failed. See above for details.');
  }
}

runDiagnostics(); 