function validateRegister(body) {
  const errors = [];

  if (!body.email || typeof body.email !== 'string') {
    errors.push('Email is required');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const sanitizedEmail = body.email.toLowerCase();
    
    const env = require('../../config/env.config');
    const allowedDomain = env.allowedEmailDomain;
    const defaultDomains = ['.edu.pk', '.edu', '.ac.uk', '.ac.pk']; 
    const blockedDomains = ['@gmail.com', '@yahoo.com', '@hotmail.com', '@outlook.com', '@live.com'];

    if (!emailRegex.test(sanitizedEmail)) {
      errors.push('Invalid email format');
    } else {
      const isBlocked = blockedDomains.some(domain => sanitizedEmail.endsWith(domain));
      if (isBlocked) {
        errors.push('Personal email addresses are not allowed. Please use your university email.');
      } else {
        if (allowedDomain) {
           const cleanAllowed = allowedDomain.startsWith('@') ? allowedDomain : '@' + allowedDomain;
           if (!sanitizedEmail.endsWith(cleanAllowed)) {
             errors.push(`Registration is restricted to the authorized university domain (${allowedDomain})`);
           }
        } else {
           const isUniversityEmail = defaultDomains.some(domain => sanitizedEmail.endsWith(domain));
           if (!isUniversityEmail) {
             errors.push(`Registration is restricted to authorized university domains (${defaultDomains.join(', ')})`);
           }
        }
      }
    }
  }

  if (!body.password || typeof body.password !== 'string') {
    errors.push('Password is required');
  } else {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(body.password)) {
      errors.push('Password must be at least 8 characters and include uppercase, lowercase, number, and special character');
    }
  }

  return { isValid: errors.length === 0, errors };
}

function validateLogin(body) {
  const errors = [];

  if (!body.email || typeof body.email !== 'string') {
    errors.push('Email is required');
  } else {
     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
     if (!emailRegex.test(body.email)) {
       errors.push('Invalid email format');
     }
  }

  if (!body.password || typeof body.password !== 'string') {
    errors.push('Password is required');
  }

  return { isValid: errors.length === 0, errors };
}

module.exports = { validateRegister, validateLogin };
