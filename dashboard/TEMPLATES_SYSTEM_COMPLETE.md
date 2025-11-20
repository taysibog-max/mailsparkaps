# ✅ Templates System - COMPLETE

## 🎯 Overview

Kompletno integrisana sistema za email template-e koja koristi:
- **Brevo API** - za sync postojećih template-a
- **Firebase Realtime Database** - za čuvanje template-a po korisniku
- **OpenAI API** - za generisanje custom template-a sa AI-jem

---

## 📦 Šta je Napravljeno?

### 1. **Backend API Endpoints**

#### `POST /api/templates/sync`
- Povlači sve template-e sa Brevo API-ja
- Čuva ih u Firebase Realtime Database pod `email_templates/{userId}`
- Vraća broj sync-ovanih template-a

**Request:**
```javascript
POST /api/templates/sync
Headers: {
  Authorization: Bearer <firebase-id-token>
}
```

**Response:**
```json
{
  "success": true,
  "count": 12,
  "templates": [...]
}
```

---

#### `GET /api/templates/list`
- Vraća sve template-e za trenutnog korisnika
- Povlači podatke iz Firebase Realtime Database

**Request:**
```javascript
GET /api/templates/list
Headers: {
  Authorization: Bearer <firebase-id-token>
}
```

**Response:**
```json
{
  "success": true,
  "templates": [
    {
      "id": "brevo_123",
      "brevoTemplateId": 123,
      "name": "Welcome Email",
      "subject": "Welcome to our store!",
      "htmlContent": "...",
      "isActive": true,
      "sender": {
        "name": "Your Store",
        "email": "noreply@example.com"
      },
      "source": "brevo",
      "createdAt": 1234567890,
      "updatedAt": 1234567890,
      "syncedAt": 1234567890
    }
  ]
}
```

---

#### `DELETE /api/templates/delete?id={templateId}`
- Briše template iz Firebase Realtime Database
- Samo vlasnik može obrisati svoj template

**Request:**
```javascript
DELETE /api/templates/delete?id=brevo_123
Headers: {
  Authorization: Bearer <firebase-id-token>
}
```

**Response:**
```json
{
  "success": true,
  "message": "Template deleted successfully"
}
```

---

#### `POST /api/templates/create`
- Generiše novi template sa OpenAI API-jem
- Čuva u Firebase Realtime Database

**Request:**
```javascript
POST /api/templates/create
Headers: {
  Authorization: Bearer <firebase-id-token>
}
Body: {
  "name": "Black Friday Sale",
  "campaignType": "abandoned_cart",
  "senderName": "Your Store",
  "senderEmail": "noreply@example.com",
  "customerData": {
    "storeName": "Your Store"
  }
}
```

**Response:**
```json
{
  "success": true,
  "template": {
    "id": "custom_1234567890_abc123",
    "name": "Black Friday Sale",
    "subject": "Don't miss out on Black Friday deals!",
    "htmlContent": "...",
    "isActive": true,
    "source": "custom",
    "generatedWithAI": true,
    ...
  }
}
```

---

### 2. **Firebase Realtime Database Struktura**

```
email_templates/
  {userId}/
    brevo_123/
      id: "brevo_123"
      brevoTemplateId: 123
      name: "Welcome Email"
      subject: "Welcome to our store!"
      htmlContent: "..."
      isActive: true
      sender:
        name: "Your Store"
        email: "noreply@example.com"
      source: "brevo"
      createdAt: 1234567890
      updatedAt: 1234567890
      syncedAt: 1234567890
    
    custom_1234567890_abc123/
      id: "custom_1234567890_abc123"
      name: "Black Friday Sale"
      subject: "..."
      htmlContent: "..."
      isActive: true
      sender:
        name: "Your Store"
        email: "noreply@example.com"
      source: "custom"
      campaignType: "abandoned_cart"
      generatedWithAI: true
      createdAt: 1234567890
      updatedAt: 1234567890
```

**Key Points:**
- ✅ Svi template-i su po user-u (`email_templates/{userId}`)
- ✅ Persist nakon logout-a (u Firebase-u ostaju)
- ✅ Brevo template-i imaju `brevoTemplateId`
- ✅ Custom template-i imaju `generatedWithAI: true`
- ✅ Svaki template ima `source` (brevo | custom)

---

### 3. **Frontend - Templates Page**

#### Features:

**1. Template Grid**
- Prikazuje sve template-e (Brevo + Custom)
- Card layout sa preview
- Badge pokazuje da li je Active
- Source badge (Brevo ili AI)

**2. Sync Button**
- "Sync from Brevo" button
- Povlači sve Brevo template-e
- Loading state sa spinner
- Success/Error notifications

**3. Create Button**
- "Create with AI" button
- Otvara modal za kreiranje
- OpenAI generiše subject i content
- Čuva u Firebase

**4. Delete Button**
- Trash icon na svakom template-u
- Confirmation dialog
- Briše iz Firebase
- UI update

**5. Preview Modal**
- "Preview" button
- Prikazuje HTML content u iframe-u
- Subject i sender info

**6. Empty State**
- Kada nema template-a
- Call-to-action buttons
- Objašnjenje kako da sync ili create

---

### 4. **OpenAI Integration**

Koristi postojeći `/lib/openai.js` za generisanje email content-a:

```javascript
const { subject, body } = await generateEmailContent(campaignType, customerData);
```

**Supported Campaign Types:**
- `abandoned_cart` - Abandoned Cart Recovery
- `welcome_email` - Welcome Email
- `post_purchase` - Post Purchase Thank You
- `review_request` - Review Request
- `reactivation` - Reactivation Campaign

---

## 🎨 UI/UX Features

### Empty State
```
┌─────────────────────────────────────────────┐
│       📧 (Purple gradient icon)             │
│                                             │
│          No Templates Yet                   │
│                                             │
│ Sync your Brevo templates or create custom │
│ ones with AI to get started                │
│                                             │
│ [Sync from Brevo] [Create with AI]         │
└─────────────────────────────────────────────┘
```

### Template Card
```
┌─────────────────────────────────────────────┐
│ 📧 Welcome Email           [Active]         │
│ From Brevo                                  │
│                                             │
│ Subject:                                    │
│ Welcome to our store!                       │
│                                             │
│ Sender: Your Store                          │
│ Created: Jan 1, 2024                        │
│                                             │
│ [👁️ Preview]                    [🗑️]        │
└─────────────────────────────────────────────┘
```

### Create Modal
```
┌─────────────────────────────────────────────┐
│ ⚡ Create Template with AI          [✕]    │
│ Generate email content using OpenAI         │
│                                             │
│ Template Name *                             │
│ [Black Friday Sale.....................]    │
│                                             │
│ Campaign Type *                             │
│ [Abandoned Cart              ▼]             │
│                                             │
│ Sender Name                                 │
│ [Your Store........................]        │
│                                             │
│ Sender Email                                │
│ [noreply@example.com...............]        │
│                                             │
│              [Cancel] [⚡ Create Template]  │
└─────────────────────────────────────────────┘
```

---

## 🔧 Technical Implementation

### Firebase Admin Update

Updated `lib/firebaseAdmin.js` to support Realtime Database:

```javascript
export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
export const adminDatabase = admin.database(); // ← NEW
```

Dodao `databaseURL` u initialization:

```javascript
admin.initializeApp({
  credential: admin.credential.cert({...}),
  databaseURL: `https://${projectId}-default-rtdb.firebaseio.com`,
});
```

---

## 🚀 How to Use

### 1. **Sync Brevo Templates**

```javascript
// Frontend
await apiPost('/api/templates/sync', {});

// Backend
// Fetches from: https://api.brevo.com/v3/smtp/templates
// Saves to: email_templates/{userId}/brevo_{templateId}
```

### 2. **Load Templates**

```javascript
// Frontend
const response = await apiGet('/api/templates/list');
const templates = response.templates;

// Backend
// Fetches from: email_templates/{userId}
// Returns array of templates
```

### 3. **Delete Template**

```javascript
// Frontend
await fetch(`/api/templates/delete?id=${templateId}`, {
  method: 'DELETE',
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

// Backend
// Deletes: email_templates/{userId}/{templateId}
```

### 4. **Create Custom Template**

```javascript
// Frontend
await apiPost('/api/templates/create', {
  name: 'Black Friday Sale',
  campaignType: 'abandoned_cart',
  senderName: 'Your Store',
  senderEmail: 'noreply@example.com',
});

// Backend
// 1. Calls OpenAI API to generate content
// 2. Saves to: email_templates/{userId}/custom_{timestamp}_{random}
```

---

## 📊 Data Flow

### Sync Flow:
```
Frontend Click "Sync from Brevo"
       ↓
POST /api/templates/sync
       ↓
Fetch from Brevo API
       ↓
Save to Firebase Realtime DB
       ↓
Return count + templates
       ↓
Frontend refreshes list
```

### Create Flow:
```
Frontend Click "Create with AI"
       ↓
Fill modal form
       ↓
POST /api/templates/create
       ↓
OpenAI generates content
       ↓
Save to Firebase Realtime DB
       ↓
Return template data
       ↓
Frontend shows in grid
```

### Delete Flow:
```
Frontend Click delete icon
       ↓
Confirm dialog
       ↓
DELETE /api/templates/delete?id=...
       ↓
Remove from Firebase Realtime DB
       ↓
Success response
       ↓
Frontend removes from UI
```

---

## 🔐 Security

### Firebase Rules (Preporučeno)

```json
{
  "rules": {
    "email_templates": {
      "$userId": {
        ".read": "$userId === auth.uid",
        ".write": "$userId === auth.uid"
      }
    }
  }
}
```

**Ovo osigurava da:**
- ✅ User može čitati samo svoje template-e
- ✅ User može pisati samo svoje template-e
- ✅ Admin ima access preko Firebase Admin SDK

---

## 🎯 Testing

### 1. **Test Sync**

```bash
# Otvori Templates page
http://localhost:3000/dashboard/templates

# Klikni "Sync from Brevo"
# Provjeri konzolu:
[Template Sync] Syncing Brevo templates for user: xxx
[Template Sync] Found 12 templates from Brevo
[Template Sync] ✅ Saved 12 templates to Firebase

# Provjeri Firebase Console:
# Database → Realtime Database → email_templates/{userId}
```

### 2. **Test Create**

```bash
# Klikni "Create with AI"
# Popuni formu:
- Name: "Black Friday Sale"
- Type: "Abandoned Cart"
- Sender: "My Store"
- Email: "noreply@mystore.com"

# Klikni "Create Template"

# Provjeri konzolu:
[Template Create] Creating template: Black Friday Sale
[AI] Generating email for campaign: abandoned_cart
[Template Create] ✅ Template created successfully

# Template se pojavljuje u grid-u
```

### 3. **Test Delete**

```bash
# Klikni trash icon na template-u
# Confirm dialog

# Provjeri konzolu:
[Template Delete] Deleting template: xxx
[Template Delete] ✅ Template deleted successfully

# Template nestaje iz UI-a
```

---

## 🐛 Troubleshooting

### Problem: Templates se ne učitavaju

**Solution:**
```bash
# 1. Provjeri Firebase Realtime Database URL
console.log(admin.database().ref().toString());
# Should be: https://{projectId}-default-rtdb.firebaseio.com

# 2. Provjeri Firebase Console
# Database → Realtime Database → email_templates

# 3. Provjeri network tab
# GET /api/templates/list should return 200
```

### Problem: Sync ne radi

**Solution:**
```bash
# 1. Provjeri BREVO_API_KEY u .env
echo $BREVO_API_KEY

# 2. Test Brevo API manually:
curl -X GET https://api.brevo.com/v3/smtp/templates \
  -H "api-key: your-brevo-api-key"

# 3. Provjeri konzolu za error messages
```

### Problem: OpenAI generation fails

**Solution:**
```bash
# 1. Provjeri OPENAI_API_KEY u .env
echo $OPENAI_API_KEY

# 2. Provjeri da li openai.js exportuje generateEmailContent
# lib/openai.js

# 3. Test direktno:
const { generateEmailContent } = require('./lib/openai');
const result = await generateEmailContent('abandoned_cart', {});
console.log(result);
```

---

## 📝 Summary

### Backend:
- ✅ 4 API endpoints (sync, list, create, delete)
- ✅ Firebase Realtime Database integration
- ✅ Brevo API integration
- ✅ OpenAI API integration
- ✅ User-based data isolation

### Frontend:
- ✅ Templates grid page
- ✅ Sync button (Brevo)
- ✅ Create button (AI)
- ✅ Delete button
- ✅ Preview modal
- ✅ Empty state
- ✅ Loading states
- ✅ Success/Error notifications

### Database:
- ✅ Firebase Realtime Database
- ✅ Structure: `email_templates/{userId}/{templateId}`
- ✅ Persist across sessions
- ✅ User isolation

### Security:
- ✅ Firebase Auth required
- ✅ User can only access own templates
- ✅ Admin SDK for backend operations

---

## 🎉 Result

**Perfect integration!** 🚀

- ✅ Brevo templates sync-uju automatski
- ✅ Custom templates kreiraju se sa AI-jem
- ✅ Sve se čuva u Firebase Realtime DB
- ✅ Po user-u (persist nakon logout-a)
- ✅ Mogućnost brisanja
- ✅ Beautiful UI/UX
- ✅ Real-time updates

**Ready for production!** 💪








