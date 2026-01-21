// backend/scripts/test-auth.js
// Test authentication endpoints

const API_BASE = 'http://localhost:3000';

async function testAuth() {
  console.log('🔐 Testing Authentication System\n');
  
  try {
    // Step 1: Test login with test user
    console.log('1️⃣  Testing POST /auth/login...');
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nurse@test.com',
        password: 'password123',
      }),
    });
    
    if (!loginRes.ok) {
      console.error(`❌ Login failed: ${loginRes.status} ${loginRes.statusText}`);
      const error = await loginRes.text();
      console.error(error);
      return;
    }
    
    const loginData = await loginRes.json();
    console.log('✅ Login successful');
    console.log('   User:', loginData.user);
    console.log('   Token:', loginData.access_token?.substring(0, 20) + '...');
    
    const token = loginData.access_token;
    
    // Step 2: Test GET /auth/me with token
    console.log('\n2️⃣  Testing GET /auth/me...');
    const meRes = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (!meRes.ok) {
      console.error(`❌ GET /auth/me failed: ${meRes.status}`);
      return;
    }
    
    const meData = await meRes.json();
    console.log('✅ /auth/me successful');
    console.log('   User:', meData);
    
    // Step 3: Test GET /users/me
    console.log('\n3️⃣  Testing GET /users/me...');
    const usersMeRes = await fetch(`${API_BASE}/users/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (!usersMeRes.ok) {
      console.error(`❌ GET /users/me failed: ${usersMeRes.status}`);
      return;
    }
    
    const usersMeData = await usersMeRes.json();
    console.log('✅ /users/me successful');
    console.log('   User:', usersMeData);
    
    // Step 4: Test protected endpoint without token
    console.log('\n4️⃣  Testing protected endpoint WITHOUT token...');
    const noAuthRes = await fetch(`${API_BASE}/users/me`);
    
    if (noAuthRes.status === 401) {
      console.log('✅ Correctly rejected unauthorized request (401)');
    } else {
      console.error(`❌ Expected 401, got ${noAuthRes.status}`);
    }
    
    // Step 5: Test GET /encounters (should require auth)
    console.log('\n5️⃣  Testing GET /encounters with auth...');
    const encountersRes = await fetch(`${API_BASE}/encounters`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (!encountersRes.ok) {
      console.error(`❌ GET /encounters failed: ${encountersRes.status}`);
      return;
    }
    
    const encountersData = await encountersRes.json();
    console.log(`✅ /encounters successful (${encountersData.length} encounters)`);
    
    // Step 6: Test GET /hospitals/:id/dashboard
    const hospitalId = usersMeData.hospitalId;
    console.log(`\n6️⃣  Testing GET /hospitals/${hospitalId}/dashboard...`);
    const dashboardRes = await fetch(`${API_BASE}/hospitals/${hospitalId}/dashboard`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (!dashboardRes.ok) {
      console.error(`❌ Dashboard failed: ${dashboardRes.status}`);
      const error = await dashboardRes.text();
      console.error(error);
      return;
    }
    
    const dashboardData = await dashboardRes.json();
    console.log('✅ Dashboard successful');
    console.log('   Data:', dashboardData);
    
    console.log('\n✅ All authentication tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAuth();
