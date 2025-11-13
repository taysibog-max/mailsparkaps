# 🚀 QUICK START GUIDE

## ⚡ Get Automation Running in 5 Minutes

### 📋 **Prerequisites**

- ✅ Firebase project with Realtime Database
- ✅ Brevo account with API key
- ✅ OpenAI account with API key
- ✅ Shopify or WooCommerce store (optional for testing)

---

## 🔧 **Step 1: Install Dependencies**

```bash
cd dashboard
npm install
```

✅ OpenAI package is already installed

---

## 🔐 **Step 2: Configure Environment Variables**

Create `dashboard/.env.local`:

```env
# Firebase Admin
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com

# Brevo
BREVO_API_KEY=your-brevo-api-key
SENDER_EMAIL=mahmutbegoviic.almin@gmail.com

# OpenAI
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4o-mini

# Security
WEBHOOK_SECRET=generate_random_string_here
CRON_SECRET=generate_another_random_string

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Need help?** See `ENVIRONMENT_VARIABLES.md` for detailed instructions.

---

## 🚀 **Step 3: Start Development Server**

```bash
npm run dev
```

Server runs on: **http://localhost:3000**

---

## 🧪 **Step 4: Test Email Sending**

Open a new terminal and run:

```bash
curl -X POST http://localhost:3000/api/brevo/send-email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "YOUR_EMAIL@example.com",
    "subject": "🎉 Test Email from Automailer",
    "htmlContent": "<h1>Hello!</h1><p>Your automation system is working!</p>"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "messageId": "...",
  "message": "Email sent successfully"
}
```

✅ **Check your inbox!**

---

## 🔄 **Step 5: Test Automation Flow**

### **5.1: Create Test Campaign in Firebase**

Go to [Firebase Console](https://console.firebase.google.com/) → Realtime Database

Create this structure:

```
/users/test_user/campaigns/test_campaign_001
{
  "name": "Test Abandoned Cart Campaign",
  "status": "active",
  "subject": "Complete Your Purchase!",
  "metadata": {
    "campaignType": "abandoned_cart"
  },
  "sender": {
    "name": "Test Store",
    "email": "test@yourdomain.com"
  },
  "emailsSent": 0
}
```

### **5.2: Simulate Abandoned Cart Event**

```bash
curl -X POST http://localhost:3000/api/webhooks/shopify \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Topic: checkouts/create" \
  -H "X-Shopify-Shop-Domain: test-store.myshopify.com" \
  -d '{
    "token": "test_cart_123",
    "email": "YOUR_EMAIL@example.com",
    "customer": {
      "first_name": "John",
      "email": "YOUR_EMAIL@example.com"
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
    "currency": "USD",
    "created_at": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
  }'
```

### **5.3: Check Firebase**

Event should be stored at:
```
/events/test-store/cart_abandoned/shopify_...
```

### **5.4: Manually Trigger CRON**

```bash
curl "http://localhost:3000/api/cron/check-abandoned-carts?manual=true"
```

**Note:** Carts must be 30+ minutes old. To test immediately, modify the timestamp in Firebase or adjust `CART_ABANDONED_THRESHOLD` in the CRON file.

### **5.5: Check Results**

1. **Email sent?** Check your inbox for AI-generated abandoned cart email
2. **Firebase updated?** Check `/users/test_user/sent_emails/`
3. **Campaign stats?** Check `/users/test_user/campaigns/test_campaign_001/emailsSent`

---

## 📊 **Step 6: Monitor in Real-Time**

Open your browser console while testing:

```
http://localhost:3000
```

Watch the server logs in terminal for:
```
[Shopify Webhook] Received: checkouts/create
[Shopify Webhook] ✅ Event stored: cart_abandoned shopify_...
[Automation] Processing event: cart_abandoned for user: test-store
[OpenAI] Generating email content for: abandoned_cart
[OpenAI] ✅ Email content generated
[Brevo] Sending email to: YOUR_EMAIL@example.com
[Brevo] ✅ Email sent successfully. Message ID: ...
[Automation] ✅ Email sent successfully
```

---

## 🎯 **What You Just Built**

✅ **Brevo Email Sending** - Transactional emails via API  
✅ **OpenAI Email Generation** - AI-powered personalized content  
✅ **Webhook Integration** - Shopify & WooCommerce support  
✅ **Automation Engine** - Triggers emails based on events  
✅ **CRON Jobs** - Scheduled checks every 15 minutes  
✅ **Duplicate Prevention** - Never send the same email twice  
✅ **Firebase Storage** - All events and sends tracked  
✅ **Campaign Analytics** - Track performance  

---

## 🔗 **Webhook URLs for Production**

Once deployed to Vercel, configure these webhooks:

### **Shopify:**
```
URL: https://yourdomain.com/api/webhooks/shopify
Event: Checkouts Create
Format: JSON
```

### **WooCommerce:**
```
URL: https://yourdomain.com/api/webhooks/woocommerce
Topic: woocommerce_cart_abandoned
Format: JSON
```

---

## 📚 **Learn More**

- 📖 **Full Documentation**: `AUTOMATION_COMPLETE.md`
- 🔐 **Environment Setup**: `ENVIRONMENT_VARIABLES.md`
- 🔧 **Automation Plan**: `AUTOMATION_PLAN.md`

---

## 🆘 **Troubleshooting**

### **"OpenAI API key not configured"**
→ Check `.env.local` has `OPENAI_API_KEY`

### **"Brevo API key not configured"**
→ Check `.env.local` has `BREVO_API_KEY`

### **"Firebase credentials missing"**
→ Check all `FIREBASE_*` variables in `.env.local`

### **"Email not sent"**
→ Check Brevo dashboard for errors  
→ Verify sender email is verified in Brevo

### **"Webhook signature invalid"**
→ Check `WEBHOOK_SECRET` matches your store config

---

## 🎉 **You're Ready!**

Your fully automated email system is now live!

**Next Steps:**
1. Deploy to Vercel for production
2. Configure real store webhooks
3. Create more campaigns in Firebase
4. Monitor analytics and optimize

**Happy Automating! 🚀✨**
