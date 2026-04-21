# FlatShare 🏠

A clean, production-ready expense-sharing web app for people living together in a flat or house. Track grocery and household purchases, add flat rent, and auto-generate a clear bill for every member.

---

## Features

- 🔐 **Auth** — Register, email OTP verification, login, forgot password
- 🏠 **Groups** — Create flat groups, invite members by name/email, accept/reject invitations
- 🛒 **Inventory** — Each member adds their grocery & household purchases (pre-populated Nepali items list + "Other")
- 📅 **Nepali Calendar** — Dates shown in Bikram Sambat (BS) for Nepal groups
- 🧾 **Auto Bill** — Admin enters flat rent → system calculates everyone's share using the exact formula:
  - `Total Cost = Flat Rent + All Expenses`
  - `Actual Split = Total Cost ÷ Members`
  - `Optimized Split = Round to nearest 10`
  - `To Pay = Optimized Split − Person's Expenses`
- 🖨️ **Print** — Clean printable report with itemized breakdown per person

---

## Tech Stack

| Layer     | Tech                                          |
|-----------|-----------------------------------------------|
| Frontend  | React 18 + Vite + Tailwind CSS + React Router |
| Backend   | Node.js + Express + MongoDB + Mongoose        |
| Auth      | JWT (httpOnly cookies) + bcryptjs             |
| Email     | Nodemailer (Gmail)                            |

---

## Project Structure

```
flatshare/
├── backend/
│   ├── models/          # Mongoose schemas
│   ├── routes/          # Express route handlers
│   ├── middleware/       # JWT auth middleware
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
- Gmail account (for OTP emails)

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

# Gmail: use an App Password (not your regular password)
# Go to: myaccount.google.com → Security → App Passwords
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_16_char_app_password

CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

> **Gmail App Password Setup:**
> 1. Enable 2-Step Verification on your Google account
> 2. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
> 3. Create an app password for "Mail"
> 4. Use that 16-character password as `EMAIL_PASS`

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

### Inviting Members
1. Open your group → click **Invite**
2. Search by name or type an email
3. Invitee gets a pending invitation they can accept/reject

### Adding Expenses
1. Click **Add Expenses** inside a group
2. Select items from the dropdown (common Nepali household items included)
3. Enter price for each item
4. All members can view each other's expenses in **All Members** tab

### Generating a Report (Admin only)
1. Go to **Report** tab inside the group
2. Enter the flat rent for this billing cycle
3. Optionally filter by date range
4. Click **Generate Report** — the bill appears instantly
5. Click **Print** for a printable version

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

## Build for Production

```bash
# Build frontend
cd flatshare/frontend
npm run build
# Output in dist/

# Set NODE_ENV=production in backend .env
# Serve frontend dist/ via nginx or Express static
```
