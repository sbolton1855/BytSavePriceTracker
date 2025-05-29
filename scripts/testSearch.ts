import { testSearchItems } from '../server/debug/debugAmazonSearch';

async function runTests() {
  console.log('🔎 Running Amazon SearchItems API Tests...\n');

  // Test 1: Minimal payload with fixed timestamp
  console.log('Test 1: Minimal payload + fixed timestamp');
  try {
    await testSearchItems({
      useMinimalPayload: true,
      useFixedTimestamp: true,
      logLevel: 'detailed'
    });
  } catch (err) {
    console.log('Test 1 failed, continuing to next test...\n');
  }

  // Test 2: Full payload with fixed timestamp
  console.log('\nTest 2: Full payload + fixed timestamp');
  try {
    await testSearchItems({
      useMinimalPayload: false,
      useFixedTimestamp: true,
      logLevel: 'detailed'
    });
  } catch (err) {
    console.log('Test 2 failed, continuing to next test...\n');
  }

  // Test 3: Minimal payload with current timestamp
  console.log('\nTest 3: Minimal payload + current timestamp');
  try {
    await testSearchItems({
      useMinimalPayload: true,
      useFixedTimestamp: false,
      logLevel: 'detailed'
    });
  } catch (err) {
    console.log('Test 3 failed, continuing to next test...\n');
  }

  // Test 4: Full payload with current timestamp
  console.log('\nTest 4: Full payload + current timestamp');
  try {
    await testSearchItems({
      useMinimalPayload: false,
      useFixedTimestamp: false,
      logLevel: 'detailed'
    });
  } catch (err) {
    console.log('Test 4 failed\n');
  }

  console.log('\n✨ All tests complete');
}

runTests().catch(err => console.error('\n💥 Test suite failed:', err)); 