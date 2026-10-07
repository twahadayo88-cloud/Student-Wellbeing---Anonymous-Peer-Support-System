const AppError = require('../src/utils/AppError');

// Mock dependencies
jest = { fn: () => {} };

const mockAuthService = require('../src/modules/auth/auth.service');
mockAuthService.findUserByEmail = async () => null;
mockAuthService.registerUser = async (email, password) => ({
  id: 1,
  email,
  anonymous_id: 'Anon123',
  role: 'student'
});

const mockLogger = require('../src/utils/logger');
mockLogger.audit = () => {};

// Mock validation to bypass auth.validation.js interference
const mockValidation = require('../src/modules/auth/auth.validation');
mockValidation.validateRegister = () => ({ isValid: true, errors: [] });

// Import controller AFTER mocks
const { register } = require('../src/modules/auth/auth.controller');

async function testDomain(email, allowedDomain, shouldSucceed) {
  // Mock env.config directly since auth.controller requires it
  const mockEnv = require('../src/config/env.config');
  mockEnv.allowedEmailDomain = allowedDomain;
  const req = { body: { email, password: 'Password123!' }, ip: '127.0.0.1' };
  const res = {
    status: (code) => {
      res.statusCode = code;
      return res;
    },
    json: (data) => {
      res.data = data;
    }
  };

  let error = null;
  const next = (err) => { error = err; };
  try {
    await register(req, res, next);
  } catch (err) {
    error = err;
  }

  if (shouldSucceed) {
    if (error) {
      console.error(`❌ FAILED: Expected success for ${email} with domain ${allowedDomain}, got error: ${error.message}`);
    } else {
      console.log(`✅ PASSED: Successfully registered ${email} with domain ${allowedDomain}`);
    }
  } else {
    if (error && error.message.includes('Registration is restricted to')) {
      console.log(`✅ PASSED: Successfully rejected ${email} with domain ${allowedDomain}. Error: ${error.message}`);
    } else {
      console.error(`❌ FAILED: Expected rejection for ${email} with domain ${allowedDomain}, but succeeded or got wrong error: ${error ? error.message : 'No error'}`);
    }
  }
}

async function runTests() {
  console.log('Testing Domain Restriction Logic...\n');
  
  // Test 1: Non-matching domain
  await testDomain('user@gmail.com', '@youruniversity.edu.pk', false);
  
  // Test 2: Matching domain
  await testDomain('student@youruniversity.edu.pk', '@youruniversity.edu.pk', true);
  
  // Test 3: Matching domain with different case
  await testDomain('STUDENT@YOURUNIVERSITY.EDU.PK', '@youruniversity.edu.pk', true);
  
  // Test 4: Empty allowed domain (should allow everything if configured empty)
  await testDomain('user@gmail.com', '', true);
}

runTests().catch(console.error);
