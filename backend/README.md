# Portfolio Contact Form — Backend

Ye simple Node.js + Express backend hai jo portfolio ke contact form ka data
receive, validate, aur save karta hai.

## Setup

```bash
cd backend
npm install
npm start
```

Server `http://localhost:5000` par chalega. `index.html` already isi URL par
POST request bhejta hai (`/api/contact`).

## Validation (server-side, frontend se match karti hai)

- **Name** — sirf alphabets aur spaces (`A-Z a-z`, 2–50 characters).
- **Email** — sirf `@gmail.com` address allowed.
- **Phone** — country code dropdown se select hota hai, format hamesha
  `+CODE<space>NUMBER` hota hai (e.g. `+92 3001234567`). Pakistan (`+92`) ke
  liye number `3XXXXXXXXX` pattern follow karta hai; باقی countries ke liye
  generic 7–12 digit check hai.
- **Message** — required, kam se kam 10 characters.

Agar validation fail ho to backend `400` status ke sath error return karta
hai; frontend wo error message user ko dikha deta hai.

## Data storage

Har submission `backend/submissions.json` file mein append hoti hai (id,
name, email, phone, subject, message, timestamp, ip). Ye demo/local setup ke
liye theek hai. Production ke liye isko MongoDB/PostgreSQL/MySQL se replace
kar sakte hain — `writeSubmission()` aur `readSubmissions()` functions
`server.js` mein hain, unhi ko database calls se replace karna hoga.

Submissions dekhne ke liye (development only — production mein protect/
remove karein):

```
GET http://localhost:5000/api/contact
```

## Optional: Email notification (nodemailer)

Agar chahti hain ke har submission par aapko email mil jaye, `nodemailer`
install karke `server.js` mein `writeSubmission(entry)` ke baad ye add karein:

```bash
npm install nodemailer
```

```js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,       // your gmail address
    pass: process.env.GMAIL_APP_PASSWORD // Gmail App Password, not your normal password
  }
});

transporter.sendMail({
  from: process.env.GMAIL_USER,
  to: 'noorulainmaryam18@gmail.com',
  subject: `New portfolio message: ${entry.subject || 'No subject'}`,
  text: `From: ${entry.name} (${entry.email}, ${entry.phone})\n\n${entry.message}`
}).catch(err => console.error('Email send failed:', err));
```

`GMAIL_USER` aur `GMAIL_APP_PASSWORD` ko environment variables ke tor par set
karein (ya `.env` file + `dotenv` package use karein) — kabhi bhi password
ko code mein hardcode na karein.

## Deploying

Kisi bhi Node hosting (Render, Railway, a VPS, etc.) par deploy kar sakte
hain. Deploy karne ke baad `index.html` mein `BACKEND_URL` ko apne live
backend URL se update kar dein.
