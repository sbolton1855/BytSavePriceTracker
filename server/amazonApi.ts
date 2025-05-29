import { z } from 'zod';
import { fetchSignedAmazonRequest } from './lib/awsSignedRequest';
import { logApiError } from './errorController';
import type { ApiErrorType } from './errorController';
import { withRateLimit, batchWithRateLimit } from './lib/rateLimiter';
import { cache } from './lib/cache';
import { metrics } from './lib/metrics';
import { AmazonErrorHandler } from './lib/amazonErrorHandler';

// Amazon API configuration
const PARTNER_TAG = process.env.AMAZON_PARTNER_TAG || 'bytsave-20';
const MARKETPLACE = 'www.amazon.com';

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
  couponDetected: z.boolean().optional(),
});

type AmazonProduct = z.infer<typeof amazonProductSchema>;

// Schema for search results
const amazonSearchResultSchema = z.object({
  asin: z.string(),
  title: z.string(),
  price: z.number().optional(),
  imageUrl: z.string().optional(),
  url: z.string(),
  couponDetected: z.boolean().optional(),
});

type AmazonSearchResult = z.infer<typeof amazonSearchResultSchema>;

// Function to search products by keyword
async function searchProducts(
  keyword: string,
  limit: number = 10,
  page: number = 1
): Promise<{ items: AmazonSearchResult[]; totalPages: number }> {
  if (!keyword || keyword.trim().length < 3) {
    throw new Error('Search term must be at least 3 characters long');
  }

  try {
    const payload = {
      Keywords: keyword,
      PartnerTag: PARTNER_TAG,
      PartnerType: 'Associates',
      Marketplace: MARKETPLACE,
      Resources: [
        'Images.Primary.Small',
        'ItemInfo.Title',
        'Offers.Listings.Price',
        'Offers.Listings.Promotions'
      ],
      ItemCount: limit,
      ItemPage: page,
      SearchIndex: 'All'
    };

    const response = await withRateLimit(
      () => fetchSignedAmazonRequest('/paapi5/searchitems', payload),
      { operation: 'SearchItems' }
    );

    const items = response.SearchResult?.Items || [];
    const totalPages = Math.ceil((response.SearchResult?.TotalResultCount || 0) / limit);
    
    if (!items.length) {
      return { items: [], totalPages: 0 };
    }

    // Get detailed price information for each item
    const asins = items.map((item: any) => item.ASIN);
    const detailedItems = await getDetailedProductInfo(asins);

    // Map Amazon API response to our schema
    const mappedItems = detailedItems.map((item: any) => ({
      asin: item.ASIN,
      title: item.ItemInfo.Title.DisplayValue,
      price: item.Offers?.Listings?.[0]?.Price?.Amount,
      imageUrl: item.Images?.Primary?.Small?.URL,
      url: item.DetailPageURL,
      couponDetected: item.Offers?.Listings?.[0]?.Promotions?.length > 0
    }));

    return { items: mappedItems, totalPages };
  } catch (error) {
    console.error('Error searching products from Amazon API:', error);
    
    if (error instanceof Error) {
      throw new Error('Failed to search products from Amazon: ' + error.message);
    }
    
    throw new Error('Failed to search products from Amazon: Unknown error');
  }
}

// Function to get detailed product information for multiple ASINs
async function getDetailedProductInfo(asins: string[]): Promise<any[]> {
  // Check cache first
  const cachedProducts = asins.map(asin => {
    const product = cache.getProduct(asin);
    if (product) {
      metrics.incrementCacheHits();
    } else {
      metrics.incrementCacheMisses();
    }
    return product;
  }).filter(Boolean);
  
  const uncachedAsins = asins.filter(asin => !cache.getProduct(asin));

  if (uncachedAsins.length === 0) {
    return cachedProducts;
  }

  // Fetch uncached products
  const operations = uncachedAsins.map(asin => async () => {
    try {
      const payload = {
        ItemIds: [asin],
        PartnerTag: PARTNER_TAG,
        PartnerType: 'Associates',
        Marketplace: MARKETPLACE,
        Resources: [
          'Images.Primary.Medium',
          'ItemInfo.Title',
          'Offers.Listings.Price',
          'Offers.Listings.SavingBasis',
          'Offers.Listings.MerchantInfo',
          'Offers.Listings.Condition',
          'Offers.Listings.Promotions'
        ]
      };

      const response = await fetchSignedAmazonRequest('/paapi5/getitems', payload);
      const item = response.ItemsResult?.Items?.[0];

      if (!item?.Offers?.Listings?.length) {
        await AmazonErrorHandler.handleError(
          new Error(`No offers found for ASIN: ${asin}`),
          asin
        );
        return null;
      }

      // Validate price data
      const listing = item.Offers.Listings[0];
      if (!listing.Price?.Amount || isNaN(listing.Price.Amount) || listing.Price.Amount <= 0) {
        await AmazonErrorHandler.handleError(
          new Error(`Invalid price data received for ASIN: ${asin}`),
          asin
        );
        return null;
      }

      return item;
    } catch (error) {
      await AmazonErrorHandler.handleError(error, asin);
      return null;
    }
  });

  const fetchedProducts = await batchWithRateLimit(operations, { operation: 'GetItems' });
  
  // Cache the fetched products
  fetchedProducts.forEach(product => {
    if (product) {
      const mappedProduct = {
        asin: product.ASIN,
        title: product.ItemInfo.Title.DisplayValue,
        price: product.Offers?.Listings?.[0]?.Price?.Amount,
        originalPrice: product.Offers?.Listings?.[0]?.SavingBasis?.Amount,
        imageUrl: product.Images?.Primary?.Medium?.URL,
        url: product.DetailPageURL,
        couponDetected: product.Offers?.Listings?.[0]?.Promotions?.length > 0
      };

      // Additional price validation
      if (mappedProduct.price && (!mappedProduct.originalPrice || mappedProduct.originalPrice < mappedProduct.price)) {
        mappedProduct.originalPrice = mappedProduct.price;
      }

      cache.setProduct(product.ASIN, mappedProduct);

      // Check for price drops
      const oldPrice = cache.getPriceHistory(product.ASIN).slice(-1)[0]?.price;
      const newPrice = mappedProduct.price;
      
      if (oldPrice && newPrice && newPrice < oldPrice) {
        const dropPercent = ((oldPrice - newPrice) / oldPrice) * 100;
        metrics.recordPriceDrop({
          asin: product.ASIN,
          title: mappedProduct.title,
          oldPrice,
          newPrice,
          dropPercent,
          timestamp: new Date(),
          couponApplied: mappedProduct.couponDetected
        });
      }
    }
  });

  return [...cachedProducts, ...fetchedProducts.filter(Boolean)];
}

// Main function to get product information from Amazon API
async function getProductInfo(asinOrUrl: string): Promise<AmazonProduct> {
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
    await AmazonErrorHandler.handleError(
      new Error(`Invalid ASIN format: ${asin}`),
      asin
    );
  }

  try {
    // Check cache first
    const cachedProduct = cache.getProduct(asin);
    if (cachedProduct) {
      return cachedProduct;
    }

    // Get detailed product information
    const items = await getDetailedProductInfo([asin]);
    
    if (!items.length) {
      await AmazonErrorHandler.handleError(
        new Error(`No product data found for ASIN: ${asin}`),
        asin
      );
    }

    const item = items[0];
    if (!item) {
      await AmazonErrorHandler.handleError(
        new Error(`Failed to fetch product data for ASIN: ${asin}`),
        asin
      );
    }

    return item;
  } catch (error) {
    return await AmazonErrorHandler.handleError(error, asin);
  }
}

// Function to add affiliate tag to Amazon URL
function addAffiliateTag(url: string, tag: string = PARTNER_TAG): string {
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
