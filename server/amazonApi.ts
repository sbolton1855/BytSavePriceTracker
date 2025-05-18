import { z } from 'zod';
import crypto from 'crypto';
import axios from 'axios';

// Amazon API credentials from environment variables
const ACCESS_KEY = process.env.AMAZON_ACCESS_KEY;
const SECRET_KEY = process.env.AMAZON_SECRET_KEY;
const PARTNER_TAG = process.env.AMAZON_PARTNER_TAG;

// Amazon API endpoints and region
const REGION = 'us-east-1';
const HOST = 'webservices.amazon.com';
const GET_ITEMS_URI = '/paapi5/getitems';
const SEARCH_ITEMS_URI = '/paapi5/searchitems';
const SERVICE = 'ProductAdvertisingAPI';

// This URL parsing utility helps extract ASINs from Amazon URLs
function extractAsinFromUrl(url: string): string | null {
  // Common patterns for Amazon URLs
  const patterns = [
    /amazon\.com\/dp\/([A-Z0-9]{10})/i,
    /amazon\.com\/(.+)\/dp\/([A-Z0-9]{10})/i,
    /amazon\.com\/gp\/product\/([A-Z0-9]{10})/i,
    /amazon\.com\/(.+)\/product\/([A-Z0-9]{10})/i,
    /amazon\.com\/(.+)\/([A-Z0-9]{10})\//i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      // The ASIN is the last captured group
      return match[match.length - 1];
    }
  }

  return null;
}

// Function to validate if a string is a valid ASIN
function isValidAsin(asin: string): boolean {
  return /^[A-Z0-9]{10}$/i.test(asin);
}

// Response schema for product data
const amazonProductSchema = z.object({
  asin: z.string(),
  title: z.string(),
  price: z.number(),
  originalPrice: z.number().optional(),
  imageUrl: z.string().optional(),
  url: z.string(),
});

type AmazonProduct = z.infer<typeof amazonProductSchema>;

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

// Schema for search results
const amazonSearchResultSchema = z.object({
  asin: z.string(),
  title: z.string(),
  price: z.number().optional(),
  imageUrl: z.string().optional(),
  url: z.string(),
});

type AmazonSearchResult = z.infer<typeof amazonSearchResultSchema>;

// Main function to search products by keyword
async function searchProducts(keyword: string, limit: number = 10): Promise<AmazonSearchResult[]> {
  if (!ACCESS_KEY || !SECRET_KEY || !PARTNER_TAG) {
    throw new Error('Amazon API credentials not found in environment variables');
  }

  if (!keyword || keyword.trim().length < 3) {
    throw new Error('Search term must be at least 3 characters long');
  }

  try {
    // Create request payload
    const payload = JSON.stringify({
      Keywords: keyword,
      PartnerTag: PARTNER_TAG,
      PartnerType: 'Associates',
      Marketplace: 'www.amazon.com',
      Resources: [
        'Images.Primary.Small',
        'ItemInfo.Title',
        'Offers.Listings.Price',
        'Offers.Listings.SavingBasis'
      ],
      ItemCount: limit,
      SearchIndex: 'All'
    });

    // Generate timestamp
    const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');

    // Sign the request
    const signature = signRequest(
      'POST', 
      payload, 
      timestamp, 
      ACCESS_KEY as string, 
      SECRET_KEY as string,
      SEARCH_ITEMS_URI,
      'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems'
    );

    // Make the API request
    const response = await axios({
      method: 'post',
      url: `https://${HOST}${SEARCH_ITEMS_URI}`,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Encoding': 'amz-1.0',
        'X-Amz-Target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems',
        'X-Amz-Date': signature['x-amz-date'],
        'Authorization': signature.authorization,
        'Host': HOST
      },
      data: payload
    });

    // Extract search results from response
    const items = response.data.SearchResult?.Items || [];
    
    if (!items.length) {
      return [];
    }

    // Map Amazon API response to our schema
    return items.map((item: any) => {
      const price = item.Offers?.Listings?.[0]?.Price?.Amount 
        ? parseFloat(item.Offers.Listings[0].Price.Amount) 
        : undefined;
      
      return {
        asin: item.ASIN,
        title: item.ItemInfo.Title.DisplayValue,
        price: price,
        imageUrl: item.Images?.Primary?.Small?.URL,
        url: item.DetailPageURL
      };
    });
  } catch (error) {
    console.error('Error searching products from Amazon API:', error);
    
    // If it's an AxiosError, check for API-specific error messages
    if (axios.isAxiosError(error) && error.response) {
      const errorMessage = error.response.data?.Errors?.[0]?.Message || 'Error communicating with Amazon API';
      throw new Error(errorMessage);
    }
    
    // For other errors
    throw new Error('Failed to search products from Amazon: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

// Main function to get product information from Amazon API
async function getProductInfo(asinOrUrl: string): Promise<AmazonProduct> {
  if (!ACCESS_KEY || !SECRET_KEY || !PARTNER_TAG) {
    throw new Error('Amazon API credentials not found in environment variables');
  }

  // Determine if input is ASIN or URL
  let asin = asinOrUrl;
  
  if (asinOrUrl.includes('amazon.com')) {
    const extractedAsin = extractAsinFromUrl(asinOrUrl);
    if (!extractedAsin) {
      throw new Error('Could not extract ASIN from the provided Amazon URL');
    }
    asin = extractedAsin;
  }

  // Validate ASIN format
  if (!isValidAsin(asin)) {
    throw new Error('Invalid ASIN format. ASIN should be a 10-character alphanumeric code');
  }

  try {
    // Create request payload
    const payload = JSON.stringify({
      ItemIds: [asin],
      PartnerTag: PARTNER_TAG,
      PartnerType: 'Associates',
      Marketplace: 'www.amazon.com',
      Resources: [
        'Images.Primary.Medium',
        'ItemInfo.Title',
        'Offers.Listings.Price',
        'Offers.Listings.SavingBasis'
      ]
    });

    // Generate timestamp
    const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');

    // Sign the request
    const signature = signRequest(
      'POST', 
      payload, 
      timestamp, 
      ACCESS_KEY as string, 
      SECRET_KEY as string,
      GET_ITEMS_URI,
      'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems'
    );

    // Make the API request
    const response = await axios({
      method: 'post',
      url: `https://${HOST}${GET_ITEMS_URI}`,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Encoding': 'amz-1.0',
        'X-Amz-Target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems',
        'X-Amz-Date': signature['x-amz-date'],
        'Authorization': signature.authorization,
        'Host': HOST
      },
      data: payload,
      timeout: 10000 // 10 second timeout
    });

    if (!response.data?.ItemsResult?.Items?.length) {
      throw new Error('No product data returned from Amazon API');
    }

    // Extract product data from response
    const item = response.data.ItemsResult.Items[0];
    
    if (!item) {
      throw new Error('Product not found');
    }

    // Get the current price
    const price = parseFloat(item.Offers?.Listings[0]?.Price?.Amount || '0');
    
    // Get original price if available (for discounted items)
    let originalPrice: number | undefined;
    if (item.Offers?.Listings[0]?.SavingBasis?.Amount) {
      originalPrice = parseFloat(item.Offers.Listings[0].SavingBasis.Amount);
    }
    
    // Return formatted product data
    return {
      asin: item.ASIN,
      title: item.ItemInfo.Title.DisplayValue,
      price: price || 0,
      originalPrice: originalPrice,
      imageUrl: item.Images?.Primary?.Medium?.URL,
      url: item.DetailPageURL
    };
  } catch (error) {
    console.error('Error fetching product from Amazon API:', error);
    
    // If it's an AxiosError, check for API-specific error messages
    if (axios.isAxiosError(error) && error.response) {
      // Extract error message from Amazon response
      const errorMessage = error.response.data?.Errors?.[0]?.Message || 'Error communicating with Amazon API';
      throw new Error(errorMessage);
    }
    
    // For other errors
    throw new Error('Failed to fetch product information from Amazon: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

// Function to add affiliate tag to Amazon URL
function addAffiliateTag(url: string, tag: string = PARTNER_TAG || 'bytsave-20'): string {
  // Check if URL already has parameters
  const hasParams = url.includes('?');
  const separator = hasParams ? '&' : '?';
  
  // Add the tag parameter
  return `${url}${separator}tag=${tag}`;
}

export {
  getProductInfo,
  searchProducts,
  extractAsinFromUrl,
  isValidAsin,
  addAffiliateTag,
  type AmazonProduct,
  type AmazonSearchResult
};
