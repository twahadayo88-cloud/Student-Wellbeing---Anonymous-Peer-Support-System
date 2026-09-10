const axios = require('axios');

async function testAdminSecurity() {
  console.log('--- Admin Security Test ---');
  try {
    // 1. Register a test student
    const regRes = await axios.post('http://localhost:5000/api/auth/register', {
      email: `test_student_${Date.now()}@university.edu`,
      password: 'Password123!',
      role: 'student'
    });
    
    const { token } = regRes.data.data;
    console.log('Student account created.');

    // 2. Try to access admin stats
    try {
      await axios.get('http://localhost:5000/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('❌ FAIL: Student accessed admin routes.');
    } catch (err) {
      if (err.response?.status === 403) {
        console.log('✅ PASS: Student received 403 Forbidden for admin routes.');
      } else {
        console.log(`❌ FAIL: Unexpected error ${err.response?.status}`);
      }
    }
  } catch (err) {
    console.error('Test failed to setup:', err.message);
  } finally {
    process.exit();
  }
}

testAdminSecurity();
