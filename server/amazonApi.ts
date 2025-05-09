import { z } from 'zod';

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

// Main function to get product information - simulated for MVP
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
    throw new Error('Invalid ASIN format. ASIN should be a 10-character alphanumeric code');
  }

  // In a real implementation, this would call the Amazon Product Advertising API
  // For the MVP, we'll simulate the API response
  
  // Generate a simulated product based on the ASIN
  const hash = Array.from(asin).reduce((acc, char) => {
    return acc + char.charCodeAt(0);
  }, 0);
  
  const basePrice = (hash % 300) + 50; // Price between $50 and $350
  const discountPercent = hash % 30; // Discount between 0% and 30%
  const originalPrice = basePrice * (100 / (100 - discountPercent));
  
  // Product categories based on ASIN first letter
  const categories = [
    'Electronics', 'Books', 'Home & Kitchen', 'Toys & Games',
    'Clothing', 'Beauty', 'Sports & Outdoors', 'Office Products', 
    'Tools & Home Improvement', 'Health & Household'
  ];
  const categoryIndex = asin.charCodeAt(0) % categories.length;
  const category = categories[categoryIndex];
  
  // Generate product name
  const adjectives = ['Premium', 'Deluxe', 'Advanced', 'Professional', 'Ultra', 'Smart', 'Portable'];
  const nouns = ['Pro', 'Max', 'Plus', 'Elite', 'Lite', 'Series', 'Edition'];
  
  const adjIndex = hash % adjectives.length;
  const nounIndex = (hash + 3) % nouns.length;
  
  const brandNames = ['TechMaster', 'HomeStyle', 'EcoLife', 'PowerPro', 'ComfortPlus', 'NatureCare', 'PrimeLine'];
  const brandIndex = (hash + 5) % brandNames.length;
  
  const title = `${brandNames[brandIndex]} ${adjectives[adjIndex]} ${category} ${nouns[nounIndex]} (${asin})`;
  
  // Create product object
  return {
    asin,
    title,
    price: Math.round(basePrice * 100) / 100,
    originalPrice: Math.round(originalPrice * 100) / 100,
    imageUrl: `https://picsum.photos/seed/${asin}/200/200`,
    url: `https://www.amazon.com/dp/${asin}`
  };
}

// Function to add affiliate tag to Amazon URL
function addAffiliateTag(url: string, tag: string): string {
  // Check if URL already has parameters
  const hasParams = url.includes('?');
  const separator = hasParams ? '&' : '?';
  
  // Add the tag parameter
  return `${url}${separator}tag=${tag}`;
}

export {
  getProductInfo,
  extractAsinFromUrl,
  isValidAsin,
  addAffiliateTag,
  type AmazonProduct
};
