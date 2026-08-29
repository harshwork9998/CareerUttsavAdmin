# Career Uttsav Admin

Next.js admin and API for Career Uttsav events, partners, and student registrations.

## Setup

```bash
npm install
copy .env.local.example .env.local   # Windows
# cp .env.local.example .env.local   # macOS/Linux
```

Fill in secrets in `.env.local`, then:

```bash
npm run dev
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `RESEND_API_KEY` | For email | Resend API key |
| `RESEND_FROM_EMAIL` | For email | Verified sender |
| `PHONE_VERIFICATION_TOKEN_SECRET` | Recommended | Hashes opaque `verificationToken` values after OTP verify (not MSG91 OTPs) |
| `OTP_PROVIDER` | Optional | `msg91` (default) or `mock` (local only) |
| `MSG91_AUTH_KEY` | When `msg91` | MSG91 auth key — **server only, never expose to the browser** |
| `MSG91_TEMPLATE_ID` | When `msg91` | MSG91 OTP Template ID from the MSG91 OTP section (not the DLT Template ID) |

Legacy `OTP_HASH_SECRET` is still accepted as a fallback for token hashing. Remove Twilio variables (`TWILIO_*`, `SMS_PROVIDER`) if present — they are unused.

### Local mock OTP

For development without MSG91:

```env
OTP_PROVIDER=mock
```

- Mock is **refused in production** (`NODE_ENV=production` / `VERCEL_ENV=production`).
- Fixed OTP for mock only: **`123456`**
- Send responses may include `debugCode` in mock mode only.

### Production MSG91

```env
OTP_PROVIDER=msg91
MSG91_AUTH_KEY=your_auth_key
MSG91_TEMPLATE_ID=your_template_id
PHONE_VERIFICATION_TOKEN_SECRET=long-random-secret
```

Missing MSG91 config with provider `msg91` returns **503** from OTP endpoints.

## OTP flow (student registration)

1. `POST /api/send-otp` — MSG91 Send OTP (or Retry on resend)
2. `POST /api/verify-otp` — MSG91 Verify OTP; returns `verificationToken`
3. `POST /api/registrations` — public student submit includes `phoneVerificationToken`

MSG91 generates and verifies the SMS OTP. This app does **not** store OTP codes. After verify it issues a one-time `verificationToken` (stored hashed) for registration.

### Rate limits

- Max **3** sends/resends per phone per **15 minutes**
- Min **60 seconds** between send/resend
- Max **5** verify attempts per challenge

### Example: send OTP

```bash
curl -X POST http://localhost:3002/api/send-otp \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"9876543210\",\"purpose\":\"student_registration\"}"
```

### Example: verify OTP

```bash
curl -X POST http://localhost:3002/api/verify-otp \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"9876543210\",\"purpose\":\"student_registration\",\"code\":\"123456\"}"
```

Phone may be sent as `9876543210`, `919876543210`, or `+91 98765 43210`. Invalid numbers are rejected.

## MSG91 dashboard setup (manual)

1. Create / log in to [MSG91](https://control.msg91.com/).
2. Copy **Auth Key** → `MSG91_AUTH_KEY`.
3. Create an **OTP template** in the MSG91 OTP section and copy its **OTP Template ID** → `MSG91_TEMPLATE_ID`. (This is separate from the DLT Template ID.)
4. Ensure the template supports Send / Verify / Retry OTP APIs.
5. Test with a real Indian mobile after switching `OTP_PROVIDER=msg91`.

## Tests

```bash
npm test
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | ESLint |
| `npm test` | Vitest |
