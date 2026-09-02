/**
 * Contact form backend for Noor-ul-Ain Maryam's portfolio.
 *
 * - Validates name (alphabets only), email (must be @gmail.com),
 *   phone (country code + digits, e.g. "+92 3001234567"), and message.
 * - Re-validates everything server-side (never trust the frontend alone).
 * - Stores each submission as a row in Supabase (table: contact_submissions).
 *
 * Run:
 *   cd backend
 *   npm install
 *   npm start
 *
 * Server listens on http://localhost:5000
 */

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 5000;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(cors());
app.use(express.json());

// Basic abuse protection: max 10 submissions per IP every 15 minutes
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many requests. Please try again later.' }
});

// ---------- Validation helpers (mirrors the frontend rules) ----------
const NAME_PATTERN = /^[A-Za-z\s]{2,50}$/;
const GMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
const DIAL_CODE_PATTERN = /^\+\d{1,4}$/;
const PK_MOBILE_PATTERN = /^3\d{9}$/;
const GENERIC_PHONE_PATTERN = /^\d{7,12}$/;

function validateContactPayload(body) {
  const errors = {};
  const { name, email, countryCode, phone, subject, message } = body || {};

  // Name — alphabets and spaces only
  if (!name || !name.trim()) {
    errors.name = 'Name is required';
  } else if (!NAME_PATTERN.test(name.trim())) {
    errors.name = 'Only alphabets and spaces are allowed';
  }

  // Email — must be a Gmail address
  if (!email || !email.trim()) {
    errors.email = 'Email is required';
  } else if (!GMAIL_PATTERN.test(email.trim())) {
    errors.email = 'Only a valid Gmail address is allowed, e.g. name@gmail.com';
  }

  // Phone — "countryCode" like "+92" and "phone" formatted as "+92 3001234567"
  if (!phone || !phone.trim()) {
    errors.phone = 'Phone number is required';
  } else {
    const parts = phone.trim().split(/\s+/);
    const code = countryCode || parts[0];
    const digits = (parts.length > 1 ? parts.slice(1).join('') : phone.replace(code, '')).replace(/\D/g, '');

    if (!DIAL_CODE_PATTERN.test(code)) {
      errors.phone = 'Invalid country code';
    } else if (!digits) {
      errors.phone = 'Phone number is required';
    } else if (code === '+92') {
      if (!PK_MOBILE_PATTERN.test(digits)) {
        errors.phone = 'Enter a valid Pakistani mobile number, e.g. +92 3001234567';
      }
    } else if (!GENERIC_PHONE_PATTERN.test(digits)) {
      errors.phone = 'Enter a valid phone number (7–12 digits)';
    }
  }

  // Message
  if (!message || !message.trim()) {
    errors.message = 'Message is required';
  } else if (message.trim().length < 10) {
    errors.message = 'Message should be at least 10 characters';
  }

  // Subject is optional — light sanitation only
  const cleanSubject = subject ? String(subject).trim().slice(0, 150) : '';

  return { errors, isValid: Object.keys(errors).length === 0, cleanSubject };
}

function normalizePhone(countryCode, phone) {
  const parts = phone.trim().split(/\s+/);
  const code = countryCode || parts[0];
  const digits = (parts.length > 1 ? parts.slice(1).join('') : phone.replace(code, '')).replace(/\D/g, '');
  return `${code} ${digits}`; // always exactly one space after the dial code
}

// Serve static files from the backend folder itself
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// ---------- Routes ----------
app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', time: new Date().toISOString() });
});

app.post('/api/contact', contactLimiter, async (req, res) => {
  const { errors, isValid, cleanSubject } = validateContactPayload(req.body);

  if (!isValid) {
    const firstError = Object.values(errors)[0];
    return res.status(400).json({ success: false, error: firstError, fieldErrors: errors });
  }

  const { name, email, countryCode, phone } = req.body;

  const entry = {
    name: name.trim(),
    email: email.trim(),
    phone: normalizePhone(countryCode, phone),
    subject: cleanSubject,
    message: req.body.message.trim(),
    submitted_at: new Date().toISOString()
  };

  try {
    const { error } = await supabase.from('contact_submissions').insert([entry]);

    if (error) {
      console.error('Supabase INSERT error:', error);
      return res.status(500).json({ success: false, error: 'Could not save your message. Please try again.' });
    }
  } catch (err) {
    console.error('Failed to save submission:', err);
    return res.status(500).json({ success: false, error: 'Could not save your message. Please try again.' });
  }

  return res.status(201).json({ success: true, message: 'Message received. Thank you!' });
});

// Simple admin endpoint to view submissions
app.get('/api/contact', async (req, res) => {
  // Prevent caching so the admin panel always sees fresh data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    const { data, error } = await supabase
      .from('contact_submissions')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('Supabase GET error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({ success: true, submissions: data || [] });
  } catch (err) {
    console.error('Contact GET error:', err);
    return res.status(500).json({ success: false, error: 'Could not fetch messages.' });
  }
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`✓ Contact backend running at http://localhost:${PORT}`);
});