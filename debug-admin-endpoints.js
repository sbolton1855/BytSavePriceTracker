
#!/usr/bin/env node

const https = require('https');
const http = require('http');

const BASE_URL = process.env.REPL_URL || 'http://localhost:5000';
const ADMIN_TOKEN = process.env.ADMIN_SECRET || 'admin-test-token';

async function testEndpoint(path, method = 'GET', headers = {}) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: Object.fromEntries(Object.entries(res.headers)),
          data: data.substring(0, 500) // Truncate for readability
        });
      });
    });

    req.on('error', (err) => {
      resolve({ error: err.message });
    });

    req.end();
  });
}

async function runTests() {
  console.log('🔍 Testing Admin Endpoints');
  console.log('='.repeat(50));

  // Test 1: Templates endpoint with Bearer auth
  console.log('\n1. Templates with Bearer Auth:');
  const templatesBearer = await testEndpoint('/api/admin/email-templates', 'GET', {
    'Authorization': `Bearer ${ADMIN_TOKEN}`
  });
  console.log(`   Status: ${templatesBearer.status}`);
  console.log(`   Data: ${templatesBearer.data?.substring(0, 100) || templatesBearer.error}...`);

  // Test 2: Templates endpoint without auth (should fail)
  console.log('\n2. Templates without auth:');
  const templatesNoAuth = await testEndpoint('/api/admin/email-templates');
  console.log(`   Status: ${templatesNoAuth.status}`);
  console.log(`   Data: ${templatesNoAuth.data?.substring(0, 100) || templatesNoAuth.error}...`);

  // Test 3: Logs endpoint with Bearer auth
  console.log('\n3. Logs with Bearer Auth:');
  const logsBearer = await testEndpoint('/api/admin/logs', 'GET', {
    'Authorization': `Bearer ${ADMIN_TOKEN}`
  });
  console.log(`   Status: ${logsBearer.status}`);
  console.log(`   Data: ${logsBearer.data?.substring(0, 100) || logsBearer.error}...`);

  // Test 4: Logs endpoint with query token (old method)
  console.log('\n4. Logs with query token:');
  const logsQuery = await testEndpoint(`/api/admin/logs?token=${ADMIN_TOKEN}`);
  console.log(`   Status: ${logsQuery.status}`);
  console.log(`   Data: ${logsQuery.data?.substring(0, 100) || logsQuery.error}...`);

  // Test 5: Debug what middleware is actually running
  console.log('\n5. Auth validation endpoint:');
  const authTest = await testEndpoint('/api/admin/validate-token', 'POST', {}, JSON.stringify({ token: ADMIN_TOKEN }));
  console.log(`   Status: ${authTest.status}`);
  console.log(`   Data: ${authTest.data?.substring(0, 100) || authTest.error}...`);

  console.log('\n' + '='.repeat(50));
  console.log('✅ Test Complete');
}

if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testEndpoint, runTests };
