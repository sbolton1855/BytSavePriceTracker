
export function buildAffiliateLink(asin: string): string {
  const tag = process.env.AMAZON_AFFILIATE_TAG || 'bytsave-20';
  return `https://www.amazon.com/dp/${asin}?tag=${tag}&linkCode=ogi&th=1&psc=1`;
}

export function addAffiliateTag(url: string, tag?: string): string {
  const affiliateTag = tag || process.env.AMAZON_AFFILIATE_TAG || 'bytsave-20';
  
  try {
    const urlObj = new URL(url);
    urlObj.searchParams.set('tag', affiliateTag);
    urlObj.searchParams.set('linkCode', 'ogi');
    urlObj.searchParams.set('th', '1');
    urlObj.searchParams.set('psc', '1');
    return urlObj.toString();
  } catch (error) {
    // If URL parsing fails, return original URL
    console.warn('Failed to parse URL for affiliate tag:', url);
    return url;
  }
}

export const AFFILIATE_DISCLOSURE = "As an Amazon Associate, BytSave earns from qualifying purchases.";
