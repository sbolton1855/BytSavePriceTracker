// Automated test for tracking a product

import { storage } from './storage';
import { extractAsinFromUrl } from './amazonApi';

// Use global fetch which is available in Node.js environments

async function testProductTracking() {
  console.log("===== STARTING TRACKING TEST =====");
  
  // Test data
  const testAsin = "B07MJL8NXR"; // Premier Protein
  const testUrl = `https://www.amazon.com/dp/${testAsin}`;
  const testEmail = "test@example.com";
  const testPrice = 19.99;
  
  try {
    // 1. Check if product exists in database already
    console.log(`1. Checking if product with ASIN ${testAsin} exists in database`);
    let product = await storage.getProductByAsin(testAsin);
    
    if (product) {
      console.log(`   ✓ Product found in database: ${product.title}`);
    } else {
      console.log(`   ⚠️ Product not found in database`);
    }
    
    // 2. Test tracking endpoint directly
    console.log(`2. Testing /api/track endpoint with test data`);
    
    const trackingData = {
      productUrl: testUrl,
      targetPrice: testPrice,
      email: testEmail
    };
    
    console.log(`   Sending request with data:`, JSON.stringify(trackingData, null, 2));
    
    // 3. Make the API request
    const response = await fetch('http://localhost:5000/api/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(trackingData)
    });
    
    console.log(`   Response status: ${response.status}`);
    
    // 4. Check response
    if (response.ok) {
      const result = await response.json();
      console.log(`   ✓ Tracking successful:`, JSON.stringify(result, null, 2));
    } else {
      const errorText = await response.text();
      console.error(`   ❌ Tracking failed: ${errorText}`);
      
      // 5. Debug validation issues
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.details) {
          console.log(`   Validation errors:`, JSON.stringify(errorJson.details, null, 2));
        }
      } catch (e) {
        // Not JSON, just use the text
      }
    }
    
    // 6. Check if tracking was created in database
    console.log(`3. Checking if tracking was created in database`);
    const trackings = await storage.getTrackedProductsByEmail(testEmail);
    
    if (trackings.length > 0) {
      console.log(`   ✓ Found ${trackings.length} tracking(s) for ${testEmail}`);
      for (const tracking of trackings) {
        console.log(`      - Product ID: ${tracking.productId}, Target Price: $${tracking.targetPrice}`);
      }
    } else {
      console.log(`   ❌ No trackings found for ${testEmail}`);
    }
    
  } catch (error) {
    console.error("Test failed with error:", error);
  }
  
  console.log("===== TRACKING TEST COMPLETE =====");
}

// Run the test
testProductTracking();