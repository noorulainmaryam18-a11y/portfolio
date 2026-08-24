const express = require('express');
const rateLimit = require('express-rate-limit');

const app = express();

app.use(express.json());

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: 'Too many requests. Please try again later.'
  }
});

// ---------- Validation patterns ----------

const NAME_PATTERN = /^[A-Za-z\s]{2,50}$/;
const GMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
const DIAL_CODE_PATTERN = /^\+\d{1,4}$/;
const PK_MOBILE_PATTERN = /^3\d{9}$/;
const GENERIC_PHONE_PATTERN = /^\d{7,12}$/;

// ---------- Validation function ----------

function validateContactPayload(body) {
  const errors = {};

  const {
    name,
    email,
    countryCode,
    phone,
    subject,
    message
  } = body || {};

  // Name validation
  if (!name || !name.trim()) {
    errors.name = 'Name is required';
  } else if (!NAME_PATTERN.test(name.trim())) {
    errors.name = 'Only alphabets and spaces are allowed';
  }

  // Email validation
  if (!email || !email.trim()) {
    errors.email = 'Email is required';
  } else if (!GMAIL_PATTERN.test(email.trim())) {
    errors.email =
      'Only a valid Gmail address is allowed, e.g. name@gmail.com';
  }

  // Phone validation
  if (!phone || !phone.trim()) {
    errors.phone = 'Phone number is required';
  } else {
    const parts = phone.trim().split(/\s+/);
    const code = countryCode || parts[0];

    const digits = (
      parts.length > 1
        ? parts.slice(1).join('')
        : phone.replace(code, '')
    ).replace(/\D/g, '');

    if (!DIAL_CODE_PATTERN.test(code)) {
      errors.phone = 'Invalid country code';
    } else if (!digits) {
      errors.phone = 'Phone number is required';
    } else if (code === '+92') {
      if (!PK_MOBILE_PATTERN.test(digits)) {
        errors.phone =
          'Enter a valid Pakistani mobile number, e.g. +92 3001234567';
      }
    } else if (!GENERIC_PHONE_PATTERN.test(digits)) {
      errors.phone =
        'Enter a valid phone number (7–12 digits)';
    }
  }

  // Message validation
  if (!message || !message.trim()) {
    errors.message = 'Message is required';
  } else if (message.trim().length < 10) {
    errors.message =
      'Message should be at least 10 characters';
  }

  // Subject is optional
  const cleanSubject = subject
    ? String(subject).trim().slice(0, 150)
    : '';

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
    cleanSubject
  };
}

// ---------- Phone normalization ----------

function normalizePhone(countryCode, phone) {
  const parts = phone.trim().split(/\s+/);
  const code = countryCode || parts[0];

  const digits = (
    parts.length > 1
      ? parts.slice(1).join('')
      : phone.replace(code, '')
  ).replace(/\D/g, '');

  return `${code} ${digits}`;
}

// ---------- Contact handler ----------

const handleContact = (req, res) => {
  const { errors, isValid, cleanSubject } =
    validateContactPayload(req.body);

  if (!isValid) {
    const firstError = Object.values(errors)[0];

    return res.status(400).json({
      success: false,
      error: firstError,
      fieldErrors: errors
    });
  }

  const {
    name,
    email,
    countryCode,
    phone,
    message
  } = req.body;

  const entry = {
    id:
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 8),

    name: name.trim(),
    email: email.trim(),
    phone: normalizePhone(countryCode, phone),
    subject: cleanSubject,
    message: message.trim(),
    submittedAt: new Date().toISOString()
  };

  console.log('New contact submission:', entry);

  return res.status(201).json({
    success: true,
    message: 'Message received. Thank you!'
  });
};

// ---------- Routes ----------

// Vercel function health check
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Contact API is running'
  });
});

// Contact form routes
app.post('/', contactLimiter, handleContact);
app.post('/api/contact', contactLimiter, handleContact);

// 404 fallback
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found'
  });
});

// IMPORTANT: No app.listen() here
module.exports = app;