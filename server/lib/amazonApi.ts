import axios from 'axios';

interface SearchResult {
  asin: string;
  title: string;
  price?: string;
  imageUrl?: string;
}

interface Deal {
  asin: string;
  title: string;
  image?: string;
  currentPrice?: number;
  originalPrice?: number;
  discount?: number;
  url?: string;
  category?: string;
}

class AmazonAPI {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor() {
    this.apiKey = process.env.AMAZON_API_KEY || '';
    this.baseUrl = process.env.AMAZON_API_URL || 'https://api.rainforestapi.com/request';
  }

  async searchProducts(query: string): Promise<SearchResult[]> {
    if (!this.apiKey) {
      throw new Error('Amazon API key is not configured');
    }

    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          api_key: this.apiKey,
          type: 'search',
          amazon_domain: 'amazon.com',
          search_term: query
        }
      });

      return response.data.search_results.map((result: any) => ({
        asin: result.asin,
        title: result.title,
        price: result.price?.raw,
        imageUrl: result.image
      }));
    } catch (error) {
      console.error('Amazon API error:', error);
      throw error;
    }
  }
}

export const amazonApi = new AmazonAPI();

export async function getDeals(): Promise<Deal[]> {
  try {
    console.log('[getDeals] Function called');

    // Mock deals data for testing - replace with real Amazon API integration later
    const mockDeals: Deal[] = [
      {
        asin: "B08N5WRWNW",
        title: "Echo Dot (4th Gen) | Smart speaker with Alexa | Charcoal",
        image: "https://m.media-amazon.com/images/I/61kwWCusjsL._AC_SL1000_.jpg",
        currentPrice: 29.99,
        originalPrice: 49.99,
        discount: 40,
        url: "https://amazon.com/dp/B08N5WRWNW",
        category: "Electronics"
      },
      {
        asin: "B07FZ8S74R",
        title: "Instant Pot Duo 7-in-1 Electric Pressure Cooker",
        image: "https://m.media-amazon.com/images/I/71VnjJ2xvnL._AC_SL1500_.jpg",
        currentPrice: 69.99,
        originalPrice: 99.99,
        discount: 30,
        url: "https://amazon.com/dp/B07FZ8S74R",
        category: "Kitchen"
      },
      {
        asin: "B0756CYWWD",
        title: "Fire TV Stick 4K with Alexa Voice Remote",
        image: "https://m.media-amazon.com/images/I/51TjJOTfslL._AC_SL1000_.jpg",
        currentPrice: 34.99,
        originalPrice: 49.99,
        discount: 30,
        url: "https://amazon.com/dp/B0756CYWWD",
        category: "Electronics"
      }
    ];

    console.log(`[getDeals] Returning ${mockDeals.length} mock deals`);
    return mockDeals;
  } catch (error) {
    console.error('Error in getDeals:', error);
    return [];
  }
}