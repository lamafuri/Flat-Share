# FlatShare 🏠

A clean, production-ready expense-sharing web app for people living together in a flat or house. Track grocery and household purchases, add flat rent, and auto-generate a clear bill for every member.

---

## Features

- 🔐 **Auth** — Register, email OTP verification, login, forgot password
- 🏠 **Groups** — Create flat groups; the admin adds and removes members by name or email
- 🛒 **Inventory** — Each member adds their grocery & household purchases (pre-populated Nepali items list + "Other")
- 💸 **Personal Expenses** — Track your own day-to-day spending by category, month by month (BS calendar)
- 📊 **Expense Insights** — Charts of your personal spending plus what you paid in groups, over this month, last month, 3/6 months, this year or a custom range, compared with the previous period
- 📅 **Nepali Calendar** — Dates shown in Bikram Sambat (BS) for Nepal groups
- 🧾 **Auto Bill** — Admin enters flat rent → system calculates everyone's share using the exact formula:
  - `Total Cost = Flat Rent + All Expenses`
  - `Actual Split = Total Cost ÷ Members`
  - `Optimized Split = Round to nearest 10`
  - `To Pay = Optimized Split − Person's Expenses`
- 📄 **Saved Reports & PDF** — Every report is saved with the time it was generated; reopen it any time and download it as `{group name}.pdf`, with an itemized breakdown per person

---

## Tech Stack

| Layer     | Tech                                          |
|-----------|-----------------------------------------------|
| Frontend  | React 18 + Vite + Tailwind CSS + React Router |
| Charts    | Recharts                                      |
| Calendar  | nepali-date-converter (Bikram Sambat tables)  |
| Backend   | Node.js + Express + MongoDB + Mongoose        |
| Auth      | JWT (httpOnly cookies) + bcryptjs             |
| Email     | Brevo transactional email API             |

---

## Project Structure

```
flatshare/
├── backend/
│   ├── models/          # Mongoose schemas
│   ├── routes/          # Express route handlers
│   ├── middleware/      # JWT auth, rate limiting
│   ├── utils/           # Email, JWT helpers, Nepali date
│   ├── server.js
│   ├── package.json
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── components/  # Layout, modals, ReportView
    │   ├── pages/       # All page components
    │   ├── context/     # AuthContext
    │   └── utils/       # Axios instance, items list
    ├── index.html
    ├── vite.config.js
    └── tailwind.config.js
```

---

## Setup & Run

### Prerequisites
- Node.js v18+
- MongoDB (local or Atlas)
- [Brevo](https://www.brevo.com) account (for OTP emails, free plan is enough; optional for local development)

---

### 1. Clone & Install

```bash
# Install backend deps
cd flatshare/backend
npm install

# Install frontend deps
cd ../frontend
npm install
```

---

### 2. Configure Environment

```bash
# In flatshare/backend/
cp .env.example .env
```

Edit `.env`:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/flatshare
JWT_SECRET=change_this_to_a_long_random_string
JWT_EXPIRES_IN=7d

# Brevo transactional email (leave empty locally to print OTP codes to the console)
BREVO_API_KEY=your_brevo_api_key
EMAIL_FROM=your_verified_sender@example.com
EMAIL_FROM_NAME=FlatShare App

# Frontend origin(s) allowed by CORS; comma-separate multiple origins
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

> **Brevo Setup:**
> 1. Create a free account at [brevo.com](https://www.brevo.com)
> 2. Go to **Senders, Domains & Dedicated IPs → Senders**, add the address you want to send from and confirm it from your inbox. Use it as `EMAIL_FROM`
> 3. Go to **SMTP & API → API Keys**, generate a key and use it as `BREVO_API_KEY`
>
> Emails are sent over Brevo's HTTPS API, not SMTP. Many hosts, including Render's free tier, block outbound SMTP ports.
>
> In development (`NODE_ENV=development`) with no Brevo settings, OTP codes are printed to the backend console instead of being emailed.

---

### 3. Start Backend

```bash
cd flatshare/backend
npm run dev
# Server runs at http://localhost:5000
```

### 4. Start Frontend

```bash
cd flatshare/frontend
npm run dev
# App runs at http://localhost:5173
```

---

## Usage Guide

### Creating a Group
1. Register & verify your email
2. Click **New Group** on the dashboard
3. Enter group name & select country (Nepal uses BS calendar)
4. You're automatically the Admin

### Adding Members
1. Open your group → **⋯ → Manage Members** (admin only)
2. Search by name or type an email, then tap **Add**
3. They join the group immediately; remove members from the same screen

### Tracking Personal Expenses
1. Open **Dashboard → Personal**
2. Tap **Add Expense**, enter the amount, pick a category and (optionally) a description, date and note
3. Browse months with the arrows; tap an expense to edit or delete it (deletes can be undone)

### Viewing Expense Insights
1. Open **Expenses** from the navigation (or the card on your Profile)
2. Choose a time range (months follow the Bikram Sambat calendar) and whether to include personal spending, group spending or both
3. See your total and daily average, how it compares with the previous period, spending over time, your spending pace, where the money went, and every transaction

> Group spending in insights counts only the items **you** added in your groups — what you paid, not your share of the final bill.

### Adding Group Expenses
1. Click **Add Expenses** inside a group
2. Select items from the dropdown (common Nepali household items included)
3. Enter price for each item
4. All members can view each other's expenses in **All Members** tab

### Generating a Report (Admin only)
1. Go to **Report** tab inside the group
2. Enter the flat rent for this billing cycle
3. Optionally filter by date range
4. Click **Generate Report** — the bill appears instantly and is saved
5. Click **Download PDF** to save it as `{group name}.pdf` (or **Print**)
6. Past reports are listed under **Saved Reports** with the time they were generated; tap one to reopen or download it again

---

## Calculation Logic (matches screenshot)

```
Example:
  Flat Rent         = Rs 14,000
  Furi Lama         = Rs 2,955
  AD Sherpa         = Rs 1,960
  Dawa Sherpa       = Rs 4,870
  Ang Yangdi        = Rs 500
  Ang Chhiri        = Rs 0
  Noowang           = Rs 0
  ─────────────────────────────
  Total Expenses    = Rs 10,285
  Total Cost        = Rs 24,285
  Members (N)       = 6
  Actual Split      = Rs 4,047.5
  Optimized Split   = Rs 4,050  (rounded to nearest 10)
  ─────────────────────────────
  Furi Lama To Pay  = 4050 - 2955 = Rs 1,095
  AD Sherpa To Pay  = 4050 - 1960 = Rs 2,090
  Dawa Sherpa To Pay= 4050 - 4870 = Rs -820 (gets money back)
  Ang Yangdi To Pay = 4050 - 500  = Rs 3,550
  Ang Chhiri To Pay = 4050 - 0    = Rs 4,050
  Noowang To Pay    = 4050 - 0    = Rs 4,050
```

---

## MongoDB Atlas (Cloud) Setup

If you prefer cloud MongoDB:

1. Go to [mongodb.com/atlas](https://mongodb.com/atlas) and create a free cluster
2. Under **Database Access**, add a user with read/write permissions
3. Under **Network Access**, allow your IP (or `0.0.0.0/0` for dev)
4. Click **Connect** → **Connect your application** → copy the URI
5. Replace `MONGODB_URI` in your `.env`:

```env
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/flatshare?retryWrites=true&w=majority
```

---

## Deployment

The backend is deployed on **Render** and the frontend on **Vercel**.

### Backend (Render web service)
- **Root directory:** `backend`
- **Build command:** `npm install`
- **Start command:** `npm start`
- **Environment variables:**

| Variable          | Value                                                  |
|-------------------|--------------------------------------------------------|
| `MONGODB_URI`     | MongoDB Atlas connection string                        |
| `JWT_SECRET`      | Long random string                                     |
| `JWT_EXPIRES_IN`  | `7d`                                                   |
| `BREVO_API_KEY`   | Brevo API key                                          |
| `EMAIL_FROM`      | Sender address verified in Brevo                       |
| `EMAIL_FROM_NAME` | `FlatShare App` (optional)                             |
| `CLIENT_URL`      | Vercel URL, no trailing slash (comma-separate several) |
| `NODE_ENV`        | `production`                                           |

### Frontend (Vercel)
- **Root directory:** `frontend`
- **Framework preset:** Vite
- **Environment variable:** `VITE_API_URL` = the Render service URL (e.g. `https://your-api.onrender.com`)

`vercel.json` rewrites all routes to `index.html` so client-side routes work on refresh.

> Render's free tier sleeps after inactivity, so the first request can take up to a minute. The app pings the API on load and shows a notice while it wakes up.

### Troubleshooting OTP emails
Check the Render logs after registering. Delivery failures are logged as `Failed to send verify OTP email: ...`.

| Log / symptom                                    | Fix                                                                                               |
|--------------------------------------------------|---------------------------------------------------------------------------------------------------|
| `BREVO_API_KEY or EMAIL_FROM is not set` on boot | Add both variables in Render and redeploy                                                         |
| `Brevo API responded with 401` (`Key not found`) | The API key is wrong or was deleted; generate a new one                                           |
| `401` mentioning an unrecognised IP address       | In Brevo **Security → Authorized IPs**, authorize the IP or deactivate IP blocking for API keys |
| `400` about the sender                           | `EMAIL_FROM` must exactly match a verified sender in Brevo                                        |
| Request succeeds but the email is in spam        | Expected when sending from a free address (e.g. Gmail); authenticate your own domain in Brevo    |
