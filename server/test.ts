
import { getProductInfo } from './amazonApi';
import { updateProductPrice } from './priceChecker';
import { storage } from './storage';

async function runTest() {
  console.log('Starting manual test...');

  // Test case 1: Valid ASIN
  const validAsin = 'B0863TXGM3'; // This ASIN worked in the logs
  try {
    console.log(`Testing getProductInfo with valid ASIN: ${validAsin}`);
    const productInfo = await getProductInfo(validAsin);
    console.log('Product info retrieved successfully:', productInfo);
  } catch (error) {
    console.error('Test 1 failed:', error);
  }

  // Test case 2: Invalid ASIN
  const invalidAsin = 'B0F2T7HPQ6'; // This ASIN failed in the logs
  try {
    console.log(`Testing getProductInfo with invalid ASIN: ${invalidAsin}`);
    const productInfo = await getProductInfo(invalidAsin);
    console.log('Product info retrieved successfully:', productInfo);
  } catch (error) {
    console.log('Expected error caught for invalid ASIN:', error.message);
  }

  // Test case 3: Price update simulation
  try {
    console.log('Testing price update process...');
    const testProduct = {
      id: 32, // From the logs
      asin: 'B0863TXGM3',
      title: 'Test Product',
      url: 'https://amazon.com/dp/B0863TXGM3',
      currentPrice: 0,
      lastChecked: new Date()
    };
    
    const updatedProduct = await updateProductPrice(testProduct);
    console.log('Price update result:', updatedProduct);
  } catch (error) {
    console.error('Test 3 failed:', error);
  }

  console.log('Manual test completed');
}

// Run the test
runTest().catch(console.error);
