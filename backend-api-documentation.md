# FlatShare — Backend API Documentation

Base URL: `http://localhost:5000/api`

All authenticated endpoints require a JWT token either via:
- **httpOnly Cookie** named `token` (preferred), OR
- **Authorization Header**: `Authorization: Bearer <token>`

### Rate Limits
Authentication endpoints are rate limited per client. Exceeding a limit returns
`429 Too Many Requests` with standard `RateLimit` / `RateLimit-Policy` headers:

| Endpoints                                         | Limit                                              |
|---------------------------------------------------|----------------------------------------------------|
| `login`, `verify-email`, `reset-password`         | 30 requests / 15 min per client                    |
| `register`, `forgot-password`, `resend-otp`       | 5 requests / hour per client + email address, and 30 / hour per client overall |

```json
{
  "success": false,
  "message": "Too many attempts. Please try again in a few minutes."
}
```

---

## Table of Contents

1. [Authentication](#authentication)
2. [Users](#users)
3. [Groups](#groups)
4. [Expenses](#expenses)
5. [Personal Expenses](#personal-expenses)
6. [Insights](#insights)
7. [Reports](#reports)

---

## Authentication

### POST `/auth/register`
Register a new user. Sends a 6-digit OTP to the provided email.

If the email belongs to an account that was never verified, the registration replaces that account's name and password and sends a fresh OTP, so users whose first code never arrived are not locked out.

**Auth Required:** No

**Request Body:**
```json
{
  "fullName": "Furi Lama",
  "email": "furi@example.com",
  "password": "secret123"
}
```

**Response `201`:**
```json
{
  "success": true,
  "emailSent": true,
  "message": "Registration successful. Please check your email for the verification code.",
  "userId": "6579abc123def456"
}
```
> If the verification email could not be delivered, the account is still created and the response has `"emailSent": false` with the message `"Account created, but we could not send the verification email. Please request a new code."`. Clients should prompt the user to request a new code via `/auth/resend-otp`.

**Error Responses:**
- `400` — Missing fields or email already registered (verified account)
- `500` — Server error

---

### POST `/auth/verify-email`
Verify email address with the 6-digit OTP. Returns JWT token on success.

**Auth Required:** No

**Request Body:**
```json
{
  "email": "furi@example.com",
  "otp": "482910"
}
```

**Response `200`:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "6579abc123def456",
    "fullName": "Furi Lama",
    "email": "furi@example.com",
    "isVerified": true
  }
}
```

**Error Responses:**
- `400` — Invalid, expired or locked OTP (see [OTP error codes](#otp-error-codes))
- `404` — User not found

---

### POST `/auth/login`
Login with email and password.

**Auth Required:** No

**Request Body:**
```json
{
  "email": "furi@example.com",
  "password": "secret123"
}
```

**Response `200`:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "6579abc123def456",
    "fullName": "Furi Lama",
    "email": "furi@example.com",
    "isVerified": true
  }
}
```

**Error Responses:**
- `401` — Invalid credentials
- `403` — Email not verified (`"code": "EMAIL_NOT_VERIFIED"`); only returned when the password is correct

---

### POST `/auth/forgot-password`
Send a password reset OTP to the user's email. The response is the same whether or not an account exists, so the endpoint cannot be used to check which emails are registered.

**Auth Required:** No

**Request Body:**
```json
{
  "email": "furi@example.com"
}
```

**Response `200`:**
```json
{
  "success": true,
  "message": "If an account exists for that email, a reset code has been sent."
}
```

**Error Responses:**
- `400` — Email is required
- `429` — Rate limit exceeded
- `503` — The email could not be delivered (`"code": "EMAIL_DELIVERY_FAILED"`)

---

### POST `/auth/reset-password`
Reset password using the OTP received via email.

**Auth Required:** No

**Request Body:**
```json
{
  "email": "furi@example.com",
  "otp": "193847",
  "newPassword": "newSecret456"
}
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Password reset successful. Please log in."
}
```

**Error Responses:**
- `400` — Missing fields, or invalid, expired or locked OTP (see [OTP error codes](#otp-error-codes))

#### OTP error codes
OTP failures include a machine-readable `code` alongside the message:

| Code            | Meaning                                                        |
|-----------------|----------------------------------------------------------------|
| `OTP_INVALID`   | The submitted code is wrong                                    |
| `OTP_EXPIRED`   | The code is older than 10 minutes                              |
| `OTP_NOT_FOUND` | No active code for this purpose — request a new one            |
| `OTP_LOCKED`    | 5 incorrect attempts were made; the code has been discarded    |

```json
{
  "success": false,
  "code": "OTP_LOCKED",
  "message": "Too many incorrect attempts. Please request a new code."
}
```

---

### POST `/auth/resend-otp`
Resend OTP for email verification or password reset. A code is only sent when the account exists (and, for `verify`, is not yet verified), but the response is always the same.

**Auth Required:** No

**Request Body:**
```json
{
  "email": "furi@example.com",
  "purpose": "verify"
}
```
> `purpose`: `"verify"` | `"reset"`

**Response `200`:**
```json
{
  "success": true,
  "message": "If this email needs a code, a new one has been sent."
}
```

**Error Responses:**
- `400` — Email is required, or invalid `purpose`
- `429` — Rate limit exceeded
- `503` — The email could not be delivered (`"code": "EMAIL_DELIVERY_FAILED"`)

---

### POST `/auth/logout`
Logout and clear the auth cookie.

**Auth Required:** Yes

**Response `200`:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### GET `/auth/me`
Get the currently authenticated user.

**Auth Required:** Yes

**Response `200`:**
```json
{
  "success": true,
  "user": {
    "_id": "6579abc123def456",
    "fullName": "Furi Lama",
    "email": "furi@example.com",
    "isVerified": true,
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### PUT `/auth/profile`
Update the current user's profile (name only).

**Auth Required:** Yes

**Request Body:**
```json
{
  "fullName": "Furi Lama Updated"
}
```

**Response `200`:**
```json
{
  "success": true,
  "user": {
    "_id": "6579abc123def456",
    "fullName": "Furi Lama Updated",
    "email": "furi@example.com"
  }
}
```

---

## Users

### GET `/users/search?q=<query>`
Search for registered users by name or email (for adding members to groups).

**Auth Required:** Yes

**Query Params:**
- `q` — Search string (min 2 characters)

**Example:** `GET /users/search?q=dawa`

**Response `200`:**
```json
{
  "success": true,
  "users": [
    {
      "_id": "6579def789abc123",
      "fullName": "Dawa Sherpa",
      "email": "dawa@example.com"
    }
  ]
}
```

> **Note:** Returns max 10 results. Excludes the requesting user.

---

## Groups

### GET `/groups`
Get all groups the current user is a member of or admin of.

**Auth Required:** Yes

**Response `200`:**
```json
{
  "success": true,
  "groups": [
    {
      "_id": "6579group123",
      "name": "Kirtipur Flat",
      "country": "Nepal",
      "admin": {
        "_id": "6579abc123def456",
        "fullName": "Furi Lama",
        "email": "furi@example.com"
      },
      "members": [
        {
          "user": {
            "_id": "6579abc123def456",
            "fullName": "Furi Lama",
            "email": "furi@example.com"
          },
          "joinedAt": "2024-01-15T10:30:00.000Z"
        }
      ],
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### POST `/groups`
Create a new group. The creator automatically becomes the admin and first member.

**Auth Required:** Yes

**Request Body:**
```json
{
  "name": "Kirtipur Flat",
  "country": "Nepal"
}
```
> `country`: `"Nepal"` | `"India"` | `"Other"`

**Response `201`:**
```json
{
  "success": true,
  "group": {
    "_id": "6579group123",
    "name": "Kirtipur Flat",
    "country": "Nepal",
    "admin": { "_id": "...", "fullName": "Furi Lama", "email": "furi@example.com" },
    "members": [{ "user": { "_id": "...", "fullName": "Furi Lama" }, "joinedAt": "..." }],
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `400` — Group name required

---

### GET `/groups/:id`
Get details of a single group. Only accessible by group members.

**Auth Required:** Yes

**Response `200`:**
```json
{
  "success": true,
  "group": {
    "_id": "6579group123",
    "name": "Kirtipur Flat",
    "country": "Nepal",
    "admin": { "_id": "...", "fullName": "Furi Lama" },
    "members": [...]
  }
}
```

**Error Responses:**
- `403` — Not a member of this group
- `404` — Group not found

---

### POST `/groups/:id/add-member`
Add a registered user to the group by user ID or email. They become a member immediately. Admin only.

**Auth Required:** Yes (Admin only)

**Request Body (by user ID):**
```json
{
  "userId": "6579def789abc123"
}
```

**Request Body (by email):**
```json
{
  "email": "dawa@example.com"
}
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Dawa Sherpa added to the group",
  "group": { "...": "group with admin and members populated" }
}
```

**Error Responses:**
- `400` — User is already a member of this group
- `403` — Only admin can add members
- `404` — Group not found, or user not found

---

### DELETE `/groups/:id/members/:userId`
Remove a member from the group. Admin only.

**Auth Required:** Yes (Admin only)

**Response `200`:**
```json
{
  "success": true,
  "message": "Member removed"
}
```

**Error Responses:**
- `403` — Only admin can remove members

---

## Expenses

### POST `/expenses/group/:groupId`
Add one or more expense items for the current user in a group.

**Auth Required:** Yes (must be a group member)

**Request Body:**
```json
{
  "items": [
    { "itemName": "Tomatoes", "price": 120, "category": "vegetables" },
    { "itemName": "Cooking Oil", "price": 350, "category": "essentials" },
    { "itemName": "Rice", "price": 2485, "category": "essentials" }
  ],
  "date": "2024-01-15"
}
```
> `date` is optional — defaults to today. Format: `YYYY-MM-DD`.
> `category` is optional per item and defaults to `other`. One of `drinks`, `dairy`, `vegetables`, `fruits`, `essentials`, `instant`, `household`, `cleaning`, `other`; anything else returns `400`.
> For Nepal groups, Nepali BS date is auto-calculated and stored.

**Response `201`:**
```json
{
  "success": true,
  "expense": {
    "_id": "6579exp456",
    "group": "6579group123",
    "user": {
      "_id": "6579abc123def456",
      "fullName": "Furi Lama",
      "email": "furi@example.com"
    },
    "items": [
      { "itemName": "Tomatoes", "price": 120 },
      { "itemName": "Cooking Oil", "price": 350 },
      { "itemName": "Rice", "price": 2485 }
    ],
    "date": "2024-01-15T00:00:00.000Z",
    "nepaliDate": {
      "year": 2080,
      "month": 10,
      "day": 1,
      "monthName": "Poush",
      "fullDate": "2080 Poush 01"
    },
    "totalAmount": 2955,
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `400` — At least one item required
- `403` — Not a member of this group

---

### GET `/expenses/group/:groupId`
Get all expenses for a group (all members). Read-only for all members.

**Auth Required:** Yes (must be a group member)

**Response `200`:**
```json
{
  "success": true,
  "expenses": [
    {
      "_id": "6579exp456",
      "user": { "_id": "...", "fullName": "Furi Lama", "email": "furi@example.com" },
      "items": [
        { "itemName": "Tomatoes", "price": 120 }
      ],
      "date": "2024-01-15T00:00:00.000Z",
      "nepaliDate": { "fullDate": "2080 Poush 01", ... },
      "totalAmount": 120,
      "createdAt": "..."
    }
  ]
}
```

---

### GET `/expenses/group/:groupId/mine`
Get only the current user's expenses in a group.

**Auth Required:** Yes (must be a group member)

**Response `200`:**
```json
{
  "success": true,
  "expenses": [ /* same structure as above, only current user's */ ]
}
```

---

### DELETE `/expenses/:id`
Delete a specific expense. Only the expense owner can delete it.

**Auth Required:** Yes

**Response `200`:**
```json
{
  "success": true,
  "message": "Expense deleted"
}
```

**Error Responses:**
- `403` — Not authorized to delete this expense
- `404` — Expense not found

---

## Personal Expenses

Expenses a user tracks for themselves, outside any group. Users can only see and change their own entries; another user's expense id returns `404`.

`date` values are calendar days sent as `YYYY-MM-DD` and stored at 12:00 UTC, so they fall on the same day in every timezone.

Categories: `food`, `groceries`, `transport`, `bills`, `shopping`, `health`, `education`, `entertainment`, `other`.

### GET `/personal-expenses`
List the current user's personal expenses, newest first.

**Auth Required:** Yes

**Query Parameters (all optional):**
| Param      | Description                                   |
|------------|-----------------------------------------------|
| `from`     | First day to include (`YYYY-MM-DD`)           |
| `to`       | Last day to include (`YYYY-MM-DD`)            |
| `category` | Only this category                            |
| `limit`    | Page size, 1–200 (default 50)                 |
| `skip`     | Number of entries to skip (default 0)         |

**Response `200`:**
```json
{
  "success": true,
  "expenses": [
    {
      "_id": "6aa8d90f4990e56196b1459d",
      "user": "6aa8d90a4990e56196b1458a",
      "title": "Momo lunch",
      "amount": 250,
      "category": "food",
      "date": "2026-09-15T12:00:00.000Z",
      "note": "with friends",
      "createdAt": "2026-09-15T05:35:11.919Z",
      "updatedAt": "2026-09-15T05:35:11.919Z"
    }
  ],
  "total": 1,
  "totalAmount": 250
}
```
> `total` and `totalAmount` cover every entry matching the filters, not just the returned page.

**Error Responses:**
- `400` — Invalid `from`/`to` date or category

---

### POST `/personal-expenses`
Add a personal expense.

**Auth Required:** Yes

**Request Body:**
```json
{
  "title": "Momo lunch",
  "amount": 250,
  "category": "food",
  "date": "2026-09-15",
  "note": "with friends"
}
```
> `title` (max 100 chars), `amount` (> 0) and `date` are required. `category` defaults to `other`; `note` is optional (max 500 chars). Amounts are rounded to 2 decimals.

**Response `201`:**
```json
{
  "success": true,
  "expense": { "_id": "...", "title": "Momo lunch", "amount": 250, "category": "food", "date": "2026-09-15T12:00:00.000Z", "note": "with friends" }
}
```

**Error Responses:**
- `400` — Validation error (message describes the field)

---

### PUT `/personal-expenses/:id`
Replace a personal expense. Takes the same body and validation as `POST`.

**Auth Required:** Yes (owner only)

**Response `200`:**
```json
{ "success": true, "expense": { "_id": "...", "title": "Momo dinner", "amount": 300 } }
```

**Error Responses:**
- `400` — Validation error
- `404` — Expense not found (or not yours)

---

### DELETE `/personal-expenses/:id`
Delete a personal expense.

**Auth Required:** Yes (owner only)

**Response `200`:**
```json
{ "success": true, "message": "Expense deleted" }
```

**Error Responses:**
- `404` — Expense not found (or not yours)

---

## Insights

### GET `/insights/expenses?from=YYYY-MM-DD&to=YYYY-MM-DD`
The current user's spending in a date range, combining their personal expenses with the items **they** bought in groups. Other members' group expenses are never included.

**Auth Required:** Yes

**Query Parameters:**
| Param  | Description                                  |
|--------|----------------------------------------------|
| `from` | First day of the range (required)            |
| `to`   | Last day of the range (required, max 3 years after `from`) |

> Group expense dates are instants, while clients group by their local calendar day. The query is widened by 14 hours on each side so no day is cut off in any timezone. **Clients should drop entries whose local day falls outside the requested range.**

**Response `200`:**
```json
{
  "success": true,
  "entries": [
    {
      "id": "6aa8d90f4990e56196b1459d",
      "source": "personal",
      "title": "Bus fare",
      "amount": 35,
      "category": "transport",
      "note": "",
      "date": "2026-09-14T12:00:00.000Z"
    },
    {
      "id": "6aa8da114990e56196b14601-0",
      "source": "group",
      "title": "LPG Gas",
      "amount": 1900,
      "category": "household",
      "date": "2026-09-10T00:00:00.000Z",
      "expenseId": "6aa8da114990e56196b14601",
      "groupId": "6aa8da0f4990e56196b145f2",
      "groupName": "Kirtipur Flat"
    }
  ]
}
```
> Entries are sorted newest first. Group expenses are returned one entry per item.

**Error Responses:**
- `400` — Missing/invalid dates, `from` after `to`, or range longer than 3 years

---

## Reports

### POST `/reports/group/:groupId/generate`
Generate a bill report for the group. **Admin only.**

Calculates:
- `Total Cost = Flat Rent + Sum of all member expenses`
- `Actual Divided Cost = Total Cost / Number of Members`
- `Optimized Divided Cost = ceil(Actual / 10) * 10` (rounds up to nearest 10)
- `To Pay (per person) = Optimized Divided Cost − Person's Total Expense`
  - Positive → person owes this amount
  - Negative → person should receive this amount back

**Auth Required:** Yes (Admin only)

**Request Body:**
```json
{
  "flatRent": 14000,
  "startDate": "2024-01-01",
  "endDate": "2024-01-31"
}
```
> `startDate` and `endDate` are optional. If omitted, all expenses in the group are included.

**Response `201`:**
```json
{
  "success": true,
  "report": {
    "_id": "6579rep789",
    "group": "6579group123",
    "groupName": "Kirtipur Flat",
    "country": "Nepal",
    "generatedBy": "6579abc123def456",
    "flatRent": 14000,
    "billingPeriod": {
      "startDate": "2024-01-01T00:00:00.000Z",
      "endDate": "2024-01-31T00:00:00.000Z",
      "startNepaliDate": "2080 Poush 17",
      "endNepaliDate": "2080 Magh 17",
      "label": "Poush 2080"
    },
    "totalExpenses": 10285,
    "totalCost": 24285,
    "actualDividedCost": 4047.5,
    "optimizedDividedCost": 4050,
    "memberCount": 6,
    "breakdown": [
      {
        "user": "6579abc123def456",
        "fullName": "Furi Lama",
        "totalExpense": 2955,
        "toPay": 1095,
        "items": [
          {
            "date": "2024-01-15T00:00:00.000Z",
            "nepaliDate": "2080 Poush 01",
            "itemName": "Rice",
            "price": 2485
          },
          {
            "date": "2024-01-15T00:00:00.000Z",
            "nepaliDate": "2080 Poush 01",
            "itemName": "Tomatoes",
            "price": 120
          }
        ]
      },
      {
        "fullName": "Dawa Sherpa",
        "totalExpense": 4870,
        "toPay": -820,
        "items": [...]
      }
    ],
    "createdAt": "2024-01-31T18:00:00.000Z"
  }
}
```

**Error Responses:**
- `400` — Valid flat rent required
- `403` — Only admin can generate reports

---

### GET `/reports/group/:groupId`
List a group's saved reports, newest first. Returns summary fields only (no `breakdown` or `expenses`); fetch `GET /reports/:id` for the full report.

**Auth Required:** Yes (must be a group member)

**Response `200`:**
```json
{
  "success": true,
  "reports": [
    {
      "_id": "6579rep789",
      "groupName": "Kirtipur Flat",
      "flatRent": 14000,
      "totalCost": 24285,
      "optimizedDividedCost": 4050,
      "memberCount": 6,
      "billingPeriod": { "label": "Poush 2080", ... },
      "generatedBy": { "_id": "...", "fullName": "Furi Lama" },
      "createdAt": "2024-01-31T18:00:00.000Z"
    }
  ]
}
```

---

### GET `/reports/:id`
Get the full details of a single report.

**Auth Required:** Yes (must be a group member)

**Response `200`:**
```json
{
  "success": true,
  "report": {
    /* full report object as shown in generate response */
  }
}
```

**Error Responses:**
- `403` — Access denied (not a member)
- `404` — Report not found

---

## Error Response Format

All errors follow this consistent format:

```json
{
  "success": false,
  "message": "Human-readable error description"
}
```

## Common HTTP Status Codes

| Code | Meaning                        |
|------|--------------------------------|
| 200  | Success                        |
| 201  | Resource created               |
| 400  | Bad request / validation error |
| 401  | Not authenticated              |
| 403  | Forbidden (no permission)      |
| 404  | Resource not found             |
| 500  | Internal server error          |

---

## Data Models

### User
```
_id         ObjectId
fullName    String (required, max 100)
email       String (required, unique, lowercase)
password    String (hashed, min 6 chars)
isVerified  Boolean (default: false)
otp         { code, expiresAt, purpose: 'verify'|'reset', attempts }
createdAt   Date
updatedAt   Date
```

### Group
```
_id          ObjectId
name         String (required, max 100)
country      String ('Nepal'|'India'|'Other')
admin        ref: User
members      [{ user: ref:User, joinedAt: Date }]
createdAt    Date
```

### Expense
```
_id          ObjectId
group        ref: Group
user         ref: User
items        [{ itemName: String, price: Number, category: 'drinks'|'dairy'|'vegetables'|'fruits'|'essentials'|'instant'|'household'|'cleaning'|'other' }]
             (items saved before categories existed have no category)
date         Date
nepaliDate   { year, month, day, monthName, fullDate }
totalAmount  Number (auto-calculated sum of items)
createdAt    Date
```

### PersonalExpense
```
_id          ObjectId
user         ref: User
title        String (required, max 100)
amount       Number (> 0)
category     'food'|'drinks'|'transport'|'health'|'clothes'|'social'|'tech'|'groceries'|'bills'|'shopping'|'education'|'entertainment'|'other'
date         Date (calendar day at 12:00 UTC)
note         String (max 500)
createdAt    Date
updatedAt    Date
```

### Report
```
_id                   ObjectId
group                 ref: Group
groupName             String (group name when generated; kept if the group is renamed)
generatedBy           ref: User
flatRent              Number
billingPeriod         { startDate, endDate, startNepaliDate, endNepaliDate, label }
totalExpenses         Number
totalCost             Number
actualDividedCost     Number
optimizedDividedCost  Number
memberCount           Number
breakdown             [{ user, fullName, totalExpense, toPay, items:[{date,nepaliDate,itemName,price}] }]
expenses              [ref: Expense]
createdAt             Date
```
