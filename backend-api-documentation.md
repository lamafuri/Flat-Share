# FlatShare — Backend API Documentation

Base URL: `http://localhost:5000/api`

All authenticated endpoints require a JWT token either via:
- **httpOnly Cookie** named `token` (preferred), OR
- **Authorization Header**: `Authorization: Bearer <token>`

---

## Table of Contents

1. [Authentication](#authentication)
2. [Users](#users)
3. [Groups](#groups)
4. [Expenses](#expenses)
5. [Reports](#reports)

---

## Authentication

### POST `/auth/register`
Register a new user. Sends a 6-digit OTP to the provided email.

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
  "message": "Registration successful. Please verify your email.",
  "userId": "6579abc123def456"
}
```

**Error Responses:**
- `400` — Missing fields or email already registered
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
- `400` — Invalid or expired OTP
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
- `403` — Email not verified

---

### POST `/auth/forgot-password`
Send a password reset OTP to the user's email.

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
  "message": "Password reset OTP sent to your email"
}
```

**Error Responses:**
- `404` — No account with that email

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
- `400` — Invalid or expired OTP

---

### POST `/auth/resend-otp`
Resend OTP for email verification or password reset.

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
  "message": "OTP resent successfully"
}
```

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
Search for registered users by name or email (for inviting to groups).

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
    "invitations": [],
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
    "members": [...],
    "invitations": [
      {
        "user": { "_id": "...", "fullName": "Dawa Sherpa" },
        "email": "dawa@example.com",
        "status": "pending",
        "invitedAt": "2024-01-16T08:00:00.000Z"
      }
    ]
  }
}
```

**Error Responses:**
- `403` — Not a member of this group
- `404` — Group not found

---

### POST `/groups/:id/invite`
Invite a user to the group by user ID or email. Admin only.

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
  "message": "Invitation sent successfully"
}
```

**Error Responses:**
- `400` — User already a member or already invited
- `403` — Only admin can invite members
- `404` — User not found

---

### GET `/groups/invitations/mine`
Get all pending group invitations for the current user.

**Auth Required:** Yes

**Response `200`:**
```json
{
  "success": true,
  "invitations": [
    {
      "groupId": "6579group123",
      "groupName": "Kirtipur Flat",
      "country": "Nepal",
      "admin": { "_id": "...", "fullName": "Furi Lama", "email": "furi@example.com" },
      "invitedAt": "2024-01-16T08:00:00.000Z"
    }
  ]
}
```

---

### POST `/groups/:id/respond-invite`
Accept or reject a group invitation.

**Auth Required:** Yes

**Request Body:**
```json
{
  "action": "accept"
}
```
> `action`: `"accept"` | `"reject"`

**Response `200`:**
```json
{
  "success": true,
  "message": "Joined the group!"
}
```

**Error Responses:**
- `404` — No pending invitation found

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
    { "itemName": "Tomatoes", "price": 120 },
    { "itemName": "Cooking Oil", "price": 350 },
    { "itemName": "Rice", "price": 2485 }
  ],
  "date": "2024-01-15"
}
```
> `date` is optional — defaults to today. Format: `YYYY-MM-DD`.
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
Get all previously generated reports for a group.

**Auth Required:** Yes (must be a group member)

**Response `200`:**
```json
{
  "success": true,
  "reports": [
    {
      "_id": "6579rep789",
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
otp         { code, expiresAt, purpose: 'verify'|'reset' }
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
invitations  [{ user: ref:User, email, status: 'pending'|'accepted'|'rejected', invitedAt }]
createdAt    Date
```

### Expense
```
_id          ObjectId
group        ref: Group
user         ref: User
items        [{ itemName: String, price: Number }]
date         Date
nepaliDate   { year, month, day, monthName, fullDate }
totalAmount  Number (auto-calculated sum of items)
createdAt    Date
```

### Report
```
_id                   ObjectId
group                 ref: Group
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
