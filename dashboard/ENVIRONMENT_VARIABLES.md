# 🔐 Environment Variables Configuration

## Required Environment Variables

Copy these to your `.env.local` file:

```env
# =====================================
# Firebase Admin SDK
# =====================================
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com

# =====================================
# Firebase Client SDK (Frontend)
# =====================================
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef

# =====================================
# Shopify App Credentials
# =====================================
SHOPIFY_API_KEY=your-shopify-api-key
SHOPIFY_API_SECRET=your-shopify-api-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Encryption & OAuth State
SHOPIFY_TOKEN_ENCRYPTION_KEY=32-byte-hex-or-base64-key
SHOPIFY_OAUTH_STATE_SECRET=state-signing-secret

# =====================================
# Brevo API
# =====================================
BREVO_API_KEY=xkeysib-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-xxxxxxxxxxxx
SENDER_EMAIL=noreply@yourdomain.com

# =====================================
# OpenAI API
# =====================================
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# =====================================
# Webhooks Security
# =====================================
WEBHOOK_SECRET=your_secure_webhook_secret_here

# =====================================
# CRON Jobs Security
# =====================================
CRON_SECRET=your_secure_cron_secret_here

# =====================================
# App Configuration
# =====================================
# NEXT_PUBLIC_APP_URL=http://localhost:3000 (defined above)
# Production: https://yourdomain.com
```

## How to Get These Values

### Firebase Admin SDK

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** → **Service Accounts**
4. Click **Generate New Private Key**
5. Download the JSON file
6. Extract values:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (keep the `\n` characters)
7. Database URL: `https://{PROJECT_ID}-default-rtdb.firebaseio.com`

### Firebase Client SDK

1. Go to **Project Settings** → **General**
2. Scroll to **Your apps**
3. Select your web app or create one
4. Copy the config values

### Brevo API Key

1. Go to [Brevo Dashboard](https://app.brevo.com/)
2. Navigate to **Settings** → **SMTP & API**
3. Click **Create a new API key**
4. Copy the key (starts with `xkeysib-`)

### OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Navigate to **API Keys**
3. Click **Create new secret key**
4. Copy the key (starts with `sk-`)

### Webhook Secret

Generate a random secure string:

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using OpenSSL
openssl rand -hex 32
```

### CRON Secret

Same as webhook secret, generate a different random string for security.

## Important Notes

⚠️ **FIREBASE_PRIVATE_KEY**: Keep the `\n` characters in the private key. They are necessary for proper parsing.

✅ **Good:**
```
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANB...your key...\n-----END PRIVATE KEY-----\n"
```

❌ **Bad:**
```
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvQIBADANB...your key...
-----END PRIVATE KEY-----"
```

## Testing Configuration

After setting up environment variables, test your configuration:

```bash
# Start development server
npm run dev

# Test Brevo email sending
curl -X POST http://localhost:3000/api/brevo/send-email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "subject": "Test Email",
    "htmlContent": "<p>This is a test email</p>"
  }'

# Test CRON (manual trigger)
curl http://localhost:3000/api/cron/check-abandoned-carts?manual=true
```

## Production Deployment

When deploying to Vercel/Production:

1. Add all environment variables in Vercel dashboard
2. Update `NEXT_PUBLIC_APP_URL` to your production domain
3. Make sure to deploy Vercel CRON configuration (vercel.json)

## Security Best Practices

- ✅ Never commit `.env` or `.env.local` files
- ✅ Use different API keys for development and production
- ✅ Rotate keys periodically
- ✅ Use Vercel's encrypted environment variables
- ✅ Enable Firebase security rules
- ✅ Restrict Brevo API key permissions to email sending only

