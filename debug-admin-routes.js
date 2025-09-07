
const ADMIN_TOKEN = '6f32d418c8234c93b85f0f41fda31cfb';
const BASE_URL = 'http://localhost:5000'; // Adjust if different

async function testRoute(path, method = 'GET', headers = {}, body = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${BASE_URL}${path}`, options);
    const responseData = await response.text();
    
    return {
      status: response.status,
      ok: response.ok,
      data: responseData.substring(0, 200) + (responseData.length > 200 ? '...' : ''),
      headers: Object.fromEntries(response.headers.entries())
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      error: error.message,
      data: null
    };
  }
}

async function runAdminRouteTests() {
  console.log('🧪 ADMIN ROUTE DEBUGGING');
  console.log('='.repeat(50));
  
  const testCases = [
    // Test different auth methods for logs endpoint
    { 
      name: 'Logs - Authorization Bearer', 
      path: '/api/admin/logs',
      headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
    },
    { 
      name: 'Logs - x-admin-token header', 
      path: '/api/admin/logs',
      headers: { 'x-admin-token': ADMIN_TOKEN }
    },
    { 
      name: 'Logs - Query parameter', 
      path: `/api/admin/logs?token=${ADMIN_TOKEN}`,
      headers: {}
    },
    
    // Test different auth methods for templates endpoint
    { 
      name: 'Templates - Authorization Bearer', 
      path: '/api/admin/email-templates',
      headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
    },
    { 
      name: 'Templates - x-admin-token header', 
      path: '/api/admin/email-templates',
      headers: { 'x-admin-token': ADMIN_TOKEN }
    },
    { 
      name: 'Templates - Query parameter', 
      path: `/api/admin/email-templates?token=${ADMIN_TOKEN}`,
      headers: {}
    },
    
    // Test without auth to verify rejection
    { 
      name: 'Templates - No auth (should fail)', 
      path: '/api/admin/email-templates',
      headers: {}
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n📍 ${testCase.name}:`);
    const result = await testRoute(testCase.path, 'GET', testCase.headers);
    console.log(`   Status: ${result.status} (${result.ok ? 'OK' : 'FAIL'})`);
    console.log(`   Data: ${result.data || result.error}`);
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ Admin route debugging complete');
}

// Run the tests
runAdminRouteTests().catch(console.error);
