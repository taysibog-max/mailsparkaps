# ✅ AUTOMATION SYSTEM - COMPLETE IMPLEMENTATION

## 🎉 What's Been Built

**Full-stack email automation backend** that automatically:
- Detects cart abandonments, orders, and customer signups
- Generates personalized emails using OpenAI
- Sends emails via Brevo API
- Prevents duplicate emails
- Tracks all events and email sends

---

## 📁 Files Created

### **1. API Endpoints**

#### `/pages/api/brevo/send-email.js`
- Sends transactional emails via Brevo
- POST endpoint accepting `{ to, subject, htmlContent }`
- Returns Brevo message ID

#### `/pages/api/webhooks/shopify.js`
- Receives Shopify webhooks
- Verifies HMAC signature
- Stores events in Firebase
- Triggers automation

#### `/pages/api/webhooks/woocommerce.js`
- Receives WooCommerce webhooks
- Verifies signature
- Stores events in Firebase
- Triggers automation

#### `/pages/api/automation/trigger.js`
- Triggered by webhooks or CRON
- Checks for active campaigns
- Generates email with OpenAI
- Sends email via Brevo
- Prevents duplicates
- Updates statistics

#### `/pages/api/cron/check-abandoned-carts.js`
- Runs every 15 minutes (Vercel CRON)
- Checks for carts older than 30 minutes
- Triggers abandoned cart emails
- Returns processing statistics

### **2. Helper Libraries**

#### `/lib/automationHelpers.js`
- `generateEmailContent()` - OpenAI email generation
- `wasEmailSent()` - Duplicate prevention check
- `markEmailAsSent()` - Mark email as sent
- `getActiveCampaign()` - Get active campaign for user
- `sendAutomatedEmail()` - Send email via Brevo

### **3. Configuration**

#### `/vercel.json`
- Vercel CRON configuration
- Runs `/api/cron/check-abandoned-carts` every 15 minutes

#### `/ENVIRONMENT_VARIABLES.md`
- Complete environment variables documentation
- How to get API keys
- Security best practices

---

## 🔄 How It Works

### **Flow 1: Webhook-Triggered Automation**

```
1. Customer abandons cart on Shopify/WooCommerce
   ↓
2. Store sends webhook to /api/webhooks/shopify or /woocommerce
   ↓
3. Webhook verifies signature, stores event in Firebase
   Firebase: /events/{userId}/cart_abandoned/{eventId}
   ↓
4. Webhook triggers /api/automation/trigger
   ↓
5. Automation checks:
   - Was email already sent? (duplicate prevention)
   - Is there an active "Abandoned Cart" campaign?
   ↓
6. If yes:
   a) Generate personalized email with OpenAI
   b) Send email via Brevo
   c) Mark as sent in Firebase
   d) Update campaign statistics
   ↓
7. Customer receives email! ✅
```

### **Flow 2: CRON-Triggered Automation**

```
1. Vercel CRON runs every 15 minutes
   GET /api/cron/check-abandoned-carts
   ↓
2. CRON checks Firebase for cart_abandoned events
   ↓
3. For each cart:
   - Skip if already processed
   - Skip if less than 30 minutes old
   - Trigger automation for carts 30+ minutes old
   ↓
4. For each eligible cart:
   POST /api/automation/trigger
   ↓
5. Same automation flow as above
   ↓
6. Returns statistics: { processed, skipped, errors }
```

---

## 🗄️ Firebase Database Structure

```
Firebase Realtime Database
├── users/
│   └── {userId}/
│       ├── campaigns/
│       │   └── {campaignId}/
│       │       ├── name: "Abandoned Cart"
│       │       ├── status: "active"
│       │       ├── metadata:
│       │       │   └── campaignType: "abandoned_cart"
│       │       ├── sender: { name, email }
│       │       ├── emailsSent: 0
│       │       └── lastEmailSent: timestamp
│       │
│       ├── sent_emails/
│       │   └── {eventId}_{campaignType}/
│       │       ├── eventId: "cart_123"
│       │       ├── campaignType: "abandoned_cart"
│       │       ├── sentAt: timestamp
│       │       ├── to: "customer@email.com"
│       │       └── status: "sent"
│       │
│       └── email_templates/
│           └── {templateId}/
│               ├── name: "Abandoned Cart Template"
│               ├── subject: "Complete Your Purchase"
│               └── htmlContent: "<html>..."
│
└── events/
    └── {userId}/
        ├── cart_abandoned/
        │   └── {eventId}/
        │       ├── cartId: "cart_123"
        │       ├── customerEmail: "user@email.com"
        │       ├── customerName: "John Doe"
        │       ├── items: [...]
        │       ├── platform: "shopify" | "woocommerce"
        │       ├── createdAt: timestamp
        │       ├── processedAt: timestamp | null
        │       └── emailSent: boolean
        │
        ├── order_created/
        │   └── {eventId}/
        │       └── ... (similar structure)
        │
        └── customer_created/
            └── {eventId}/
                └── ... (similar structure)
```

---

## 🚀 Setup Instructions

### **Step 1: Install Dependencies**

```bash
cd dashboard
npm install openai
```

### **Step 2: Configure Environment Variables**

Create `.env.local` in `dashboard/` folder:

```env
# Firebase Admin
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com

# Brevo
BREVO_API_KEY=xkeysib-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENDER_EMAIL=noreply@yourdomain.com

# OpenAI
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Security
WEBHOOK_SECRET=your_secure_secret_here
CRON_SECRET=your_secure_cron_secret_here

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

See `ENVIRONMENT_VARIABLES.md` for detailed setup instructions.

### **Step 3: Start Development Server**

```bash
npm run dev
```

Server runs on `http://localhost:3000`

---

## 🧪 Testing

### **Test 1: Send Email Manually**

```bash
curl -X POST http://localhost:3000/api/brevo/send-email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "your-email@example.com",
    "subject": "Test Email from Automailer",
    "htmlContent": "<h1>Hello!</h1><p>This is a test email.</p>"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "messageId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "message": "Email sent successfully"
}
```

### **Test 2: Simulate Shopify Webhook**

```bash
curl -X POST http://localhost:3000/api/webhooks/shopify \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Topic: checkouts/create" \
  -H "X-Shopify-Shop-Domain: your-store.myshopify.com" \
  -d '{
    "token": "test_cart_123",
    "email": "customer@example.com",
    "customer": {
      "first_name": "John",
      "email": "customer@example.com"
    },
    "line_items": [
      {
        "id": 1,
        "product_id": 101,
        "title": "Test Product",
        "quantity": 2,
        "price": "29.99"
      }
    ],
    "total_price": "59.98",
    "currency": "USD"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "eventId": "shopify_1697471234567_abc123",
  "eventType": "cart_abandoned",
  "message": "Webhook received and processed"
}
```

### **Test 3: Manual CRON Trigger**

```bash
curl "http://localhost:3000/api/cron/check-abandoned-carts?manual=true"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Abandoned cart check complete",
  "processed": 0,
  "skipped": 0,
  "errors": 0,
  "timestamp": "2025-10-16T12:00:00.000Z"
}
```

### **Test 4: Full End-to-End Test**

1. **Create an active campaign** in Firebase:
   ```
   /users/test_user/campaigns/test_campaign_1
   {
     "name": "Test Abandoned Cart",
     "status": "active",
     "metadata": { "campaignType": "abandoned_cart" },
     "sender": { "name": "Test Store", "email": "test@example.com" }
   }
   ```

2. **Send a webhook** (use Test 2 above)

3. **Wait for automation to trigger** (or trigger manually)

4. **Check Firebase** for:
   - Event stored in `/events/test_user/cart_abandoned/`
   - Email marked as sent in `/users/test_user/sent_emails/`
   - Campaign stats updated

5. **Check your email inbox** for the automated email

---

## 📊 Campaign Type Mapping

| Event Type | Campaign Type | When Triggered |
|------------|---------------|----------------|
| `cart_abandoned` | `abandoned_cart` | Cart older than 30 minutes |
| `order_created` | `post_purchase` | Immediately after order |
| `customer_created` | `welcome_email` | Immediately after signup |
| N/A | `review_request` | Manual trigger (future) |
| N/A | `reactivation` | Manual trigger (future) |

---

## 🔒 Security Features

✅ **HMAC Signature Verification** (Shopify/WooCommerce)  
✅ **Duplicate Email Prevention** (Firebase tracking)  
✅ **CRON Secret Protection** (Prevents unauthorized access)  
✅ **Webhook Secret Validation**  
✅ **Firebase Security Rules** (User-scoped data)  

---

## 🎨 OpenAI Email Generation

The system uses OpenAI's `gpt-4o-mini` model to generate personalized emails.

**Prompt Structure:**
- **System Prompt**: Sets the role (e.g., "cart recovery expert")
- **User Prompt**: Includes customer name, cart items, campaign goals
- **Output**: JSON with `{ subject, htmlContent }`

**Example Generated Email:**

**Subject:** "John, Your Cart Is Waiting! 🛒"

**Body:**
```html
<html>
<body style="font-family: Arial, sans-serif; padding: 20px;">
  <h1>Hi John!</h1>
  <p>We noticed you left some items in your cart:</p>
  <ul>
    <li>Test Product (2x) - $59.98</li>
  </ul>
  <p>Complete your purchase now and get free shipping!</p>
  <a href="https://your-store.com/checkout/cart_123" 
     style="background: #007bff; color: white; padding: 15px 30px; 
            text-decoration: none; border-radius: 5px; display: inline-block;">
    Complete Your Purchase
  </a>
</body>
</html>
```

---

## 📈 Monitoring & Analytics

### **Check Campaign Statistics**

```javascript
// Firebase path
/users/{userId}/campaigns/{campaignId}
{
  "emailsSent": 150,
  "lastEmailSent": 1697471234567,
  "openRate": 45.5,
  "clickRate": 12.3
}
```

### **View Sent Emails Log**

```javascript
// Firebase path
/users/{userId}/sent_emails/
{
  "cart_123_abandoned_cart": {
    "sentAt": 1697471234567,
    "to": "customer@email.com",
    "status": "sent"
  }
}
```

---

## 🚀 Production Deployment

### **Vercel Deployment**

1. Push code to GitHub
2. Connect to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

Vercel will automatically:
- Set up CRON jobs (from `vercel.json`)
- Run `/api/cron/check-abandoned-carts` every 15 minutes

### **Webhook URLs**

Configure in your store admin:

**Shopify:**
- URL: `https://yourdomain.com/api/webhooks/shopify`
- Topic: `checkouts/create`
- Format: JSON

**WooCommerce:**
- URL: `https://yourdomain.com/api/webhooks/woocommerce`
- Topic: `Cart Abandoned`
- Format: JSON

---

## ✅ Features Summary

| Feature | Status |
|---------|--------|
| Brevo Email Sending | ✅ Done |
| OpenAI Email Generation | ✅ Done |
| Shopify Webhooks | ✅ Done |
| WooCommerce Webhooks | ✅ Done |
| Automation Trigger | ✅ Done |
| Duplicate Prevention | ✅ Done |
| CRON Job (15 min) | ✅ Done |
| Firebase Integration | ✅ Done |
| Campaign Tracking | ✅ Done |
| Security (HMAC/Secrets) | ✅ Done |

---

## 🎯 Next Steps

Want to extend the system? Here are ideas:

1. **SMS notifications** (Twilio integration)
2. **Review request automation** (7 days after delivery)
3. **Reactivation campaigns** (30 days inactive)
4. **A/B testing** (test different email variants)
5. **Advanced analytics dashboard**
6. **Segment targeting** (VIP customers, etc.)

---

## 🆘 Troubleshooting

### **Emails not sending?**
- Check `BREVO_API_KEY` is valid
- Check Brevo dashboard for errors
- Verify sender email is verified in Brevo

### **Webhooks not working?**
- Check `WEBHOOK_SECRET` matches your store config
- Verify webhook URL is publicly accessible
- Check Firebase for stored events

### **CRON not running?**
- Vercel CRON only works in production
- Use manual trigger for local testing: `?manual=true`
- Check Vercel logs for CRON execution

### **OpenAI errors?**
- Check `OPENAI_API_KEY` is valid
- Verify you have API credits
- Check OpenAI usage dashboard

---

## 📞 Support

- Firebase Console: https://console.firebase.google.com/
- Brevo Dashboard: https://app.brevo.com/
- OpenAI Platform: https://platform.openai.com/
- Vercel Dashboard: https://vercel.com/dashboard

---

**🎉 AUTOMATION IS COMPLETE AND READY TO USE!**








