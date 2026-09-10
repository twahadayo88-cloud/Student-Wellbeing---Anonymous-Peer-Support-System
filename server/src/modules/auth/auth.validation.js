function validateRegister(body) {
  const errors = [];

  if (!body.email || typeof body.email !== 'string') {
    errors.push('Email is required');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const sanitizedEmail = body.email.toLowerCase();
    
    // Configurable University domain restrictions
    const configDomains = ['.edu.pk', '.edu', '.ac.uk', '.ac.pk']; 
    const blockedDomains = ['@gmail.com', '@yahoo.com', '@hotmail.com', '@outlook.com', '@live.com'];

    if (!emailRegex.test(sanitizedEmail)) {
      errors.push('Invalid email format');
    } else {
      const isBlocked = blockedDomains.some(domain => sanitizedEmail.endsWith(domain));
      if (isBlocked) {
        errors.push('Personal email addresses are not allowed. Please use your university email.');
      } else {
        const isUniversityEmail = configDomains.some(domain => sanitizedEmail.endsWith(domain));
        if (!isUniversityEmail) {
          errors.push(`Registration is restricted to authorized university domains (${configDomains.join(', ')})`);
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
