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

const NAME_PATTERN = /^[A-Za-z\s]{2,50}$/;
const GMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
const DIAL_CODE_PATTERN = /^\+\d{1,4}$/;
const PK_MOBILE_PATTERN = /^3\d{9}$/;
const GENERIC_PHONE_PATTERN = /^\d{7,12}$/;

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

  if (!name || !name.trim()) {
    errors.name = 'Name is required';
  } else if (!NAME_PATTERN.test(name.trim())) {
    errors.name = 'Only alphabets and spaces are allowed';
  }

  if (!email || !email.trim()) {
    errors.email = 'Email is required';
  } else if (!GMAIL_PATTERN.test(email.trim())) {
    errors.email =
      'Only a valid Gmail address is allowed, e.g. name@gmail.com';
  }

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

  if (!message || !message.trim()) {
    errors.message = 'Message is required';
  } else if (message.trim().length < 10) {
    errors.message = 'Message should be at least 10 characters';
  }

  const cleanSubject = subject
    ? String(subject).trim().slice(0, 150)
    : '';

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
    cleanSubject
  };
}

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

app.post('/api/contact', contactLimiter, (req, res) => {
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

  const { name, email, countryCode, phone } = req.body;

  const entry = {
    id:
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 8),

    name: name.trim(),
    email: email.trim(),
    phone: normalizePhone(countryCode, phone),
    subject: cleanSubject,
    message: req.body.message.trim(),
    submittedAt: new Date().toISOString()
  };

  console.log('New contact submission:', entry);

  return res.status(201).json({
    success: true,
    message: 'Message received. Thank you!'
  });
});

module.exports = app;