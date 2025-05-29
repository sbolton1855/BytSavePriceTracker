// @ts-ignore
const paapi = require('paapi5-nodejs-sdk');

const ACCESS_KEY = process.env.AMAZON_ACCESS_KEY;
const SECRET_KEY = process.env.AMAZON_SECRET_KEY;
const PARTNER_TAG = process.env.AMAZON_PARTNER_TAG;

// Initialize the API client
const api = new paapi.ProductAdvertisingAPIv1();

// Configure credentials
api.host = 'webservices.amazon.com';
api.region = 'us-east-1';
api.accessKey = ACCESS_KEY;
api.secretKey = SECRET_KEY;

export async function searchProductsWithSDK(query: string): Promise<any[]> {
  if (!ACCESS_KEY || !SECRET_KEY || !PARTNER_TAG) {
    throw new Error('Amazon API credentials not configured');
  }

  try {
    const searchItemsRequest = {
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

    const response = await api.searchItems(searchItemsRequest);
    return response.SearchResult?.Items || [];
  } catch (error) {
    console.error('Amazon SDK Search Error:', error);
    throw new Error('Search failed');
  }
}

export async function getItemsWithSDK(asins: string[]): Promise<any[]> {
  if (!ACCESS_KEY || !SECRET_KEY || !PARTNER_TAG) {
    throw new Error('Amazon API credentials not configured');
  }

  try {
    const getItemsRequest = {
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

    const response = await api.getItems(getItemsRequest);
    return response.ItemsResult?.Items || [];
  } catch (error) {
    console.error('Amazon SDK GetItems Error:', error);
    throw new Error('Failed to get product details');
  }
}