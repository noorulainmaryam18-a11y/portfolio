/**
 * Contact form backend for Noor-ul-Ain Maryam's portfolio.
 *
 * - Validates name (alphabets only), email (must be @gmail.com),
 *   phone (country code + digits, e.g. "+92 3001234567"), and message.
 * - Re-validates everything server-side (never trust the frontend alone).
 * - Stores each submission as a row in submissions.json (simple file-based
 *   storage — swap this out for MongoDB/PostgreSQL/MySQL later if needed).
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
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const SUBMISSIONS_FILE = path.join(__dirname, 'submissions.json');

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

    // Enforce "+CODE<one space>DIGITS" formatting rule
    if (!errors.phone && phone.trim() !== `${code} ${digits}`) {
      // Not fatal — we just normalize it below — but flagged here for clarity.
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

function readSubmissions() {
  if (!fs.existsSync(SUBMISSIONS_FILE)) return [];
  try {
    const raw = fs.readFileSync(SUBMISSIONS_FILE, 'utf-8');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeSubmission(entry) {
  const all = readSubmissions();
  all.push(entry);
  fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(all, null, 2), 'utf-8');
}

// ---------- Routes ----------
app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', time: new Date().toISOString() });
});

app.post('/api/contact', contactLimiter, (req, res) => {
  const { errors, isValid, cleanSubject } = validateContactPayload(req.body);

  if (!isValid) {
    const firstError = Object.values(errors)[0];
    return res.status(400).json({ success: false, error: firstError, fieldErrors: errors });
  }

  const { name, email, countryCode, phone } = req.body;

  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    name: name.trim(),
    email: email.trim(),
    phone: normalizePhone(countryCode, phone),
    subject: cleanSubject,
    message: req.body.message.trim(),
    submittedAt: new Date().toISOString(),
    ip: req.ip
  };

  try {
    writeSubmission(entry);
  } catch (err) {
    console.error('Failed to save submission:', err);
    return res.status(500).json({ success: false, error: 'Could not save your message. Please try again.' });
  }

  // Optional: send an email notification here with nodemailer.
  // See README.md for a ready-to-uncomment example.

  return res.status(201).json({ success: true, message: 'Message received. Thank you!' });
});

// Simple admin endpoint to view submissions (protect this in production!)
app.get('/api/contact', (req, res) => {
  res.json({ success: true, submissions: readSubmissions() });
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`✓ Contact backend running at http://localhost:${PORT}`);
});
