# 🤖 OpenAI Email Generation Integration

## ✅ Status: COMPLETE

OpenAI integracija je uspješno implementirana za automatsko generisanje email sadržaja za sve vrste kampanja.

---

## 📋 Funkcionalnosti

### ✨ AI Email Generation

- **Automatsko generisanje** subject i body emaila
- **Personalizacija** po tipu kampanje
- **Podrška za sve kampanje:**
  - Abandoned Cart
  - Welcome Email
  - Post Purchase
  - Review Request
  - Reactivation

### 🎯 Features

1. ✅ **Generate with AI** dugme u CampaignModal-u
2. ✅ Loading state tokom generisanja
3. ✅ Error handling sa jasnim porukama
4. ✅ Regenerate opcija
5. ✅ Firebase spremanje (opcionalno)
6. ✅ Personalizirani emailovi

---

## 🚀 Setup

### 1. Dodajte OpenAI API Key

U `dashboard/.env` dodajte:

```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxx
```

**Kako dobiti API key:**
1. Idite na [platform.openai.com](https://platform.openai.com/)
2. Sign up / Login
3. API Keys → Create new secret key
4. Kopirajte key u `.env`

### 2. Restart Dashboard Servera

```bash
cd dashboard
npm run dev
```

---

## 📖 Kako Koristiti

### U Dashboard-u:

1. **Otvorite Campaign Modal**
   - Idite na `/dashboard/campaigns`
   - Kliknite na bilo koju kampanju

2. **Unesite Sender Info**
   - Unesite "Sender Name" (obavezno za AI)
   - Unesite "Sender Email"

3. **Generate with AI**
   - Kliknite na **"Generate with AI"** dugme
   - Čekajte 2-5 sekundi
   - AI automatski popunjava Subject i Body

4. **Edit & Send**
   - Možete editovati AI-generisan sadržaj
   - Kliknite "Regenerate with AI" za novi sadržaj
   - Aktivirajte kampanju

---

## 🎨 Primjer Generisanog Emaila

### Abandoned Cart Email

**Input:**
- Campaign Type: `abandoned_cart`
- Sender Name: `Vaša Prodavnica`

**Output:**
```
Subject: Ne zaboravite vašu korpu! 🛒

Body:
Zdravo,

Primjetili smo da ste ostavili proizvode u vašoj korpi. 
Ne propustite fantastične proizvode koje ste odabrali!

[Lista proizvoda]

Završite kupovinu u sljedećih 24h i osigurajte svoje artikle.

[ Završite kupovinu → ]

Lijep pozdrav,
Vaša Prodavnica
```

---

## 🔧 Tehnička Implementacija

### Fajlovi:

1. **`/lib/openai.js`**
   - OpenAI klijent inicijalizacija
   - `generateEmailContent()` funkcija
   - Prompt building logic
   - Response parsing

2. **`/pages/api/ai/generate-email.js`**
   - API endpoint za generisanje
   - Auth verifikacija
   - Firebase spremanje
   - Error handling

3. **`/components/CampaignModal.jsx`**
   - UI za AI generisanje
   - Loading states
   - Error display
   - Regenerate funkcionalnost

### API Endpoint:

```
POST /api/ai/generate-email
```

**Headers:**
```json
{
  "Authorization": "Bearer <firebase-token>",
  "Content-Type": "application/json"
}
```

**Body:**
```json
{
  "campaignType": "abandoned_cart",
  "customerData": {
    "name": "kupče",
    "storeName": "Vaša Prodavnica",
    "productName": "proizvod"
  },
  "saveToCampaign": false
}
```

**Response:**
```json
{
  "success": true,
  "subject": "Ne zaboravite vašu korpu!",
  "body": "<p>Zdravo...</p>",
  "generatedAt": "2025-10-15T18:00:00.000Z",
  "model": "gpt-4o-mini"
}
```

---

## 🎯 Campaign Types

| Type | Prompt Focus | Tone |
|------|--------------|------|
| `abandoned_cart` | Remind + urgency | Friendly, encouraging |
| `welcome_email` | Welcome + intro | Warm, professional |
| `post_purchase` | Thank you + info | Grateful, informative |
| `review_request` | Ask for review | Kind, encouraging |
| `reactivation` | Comeback offer | Enthusiastic, special offer |

---

## ⚙️ Konfiguracija

### AI Model

Default: `gpt-4o-mini` (brži i jeftiniji)

Za promjenu, editujte `dashboard/lib/openai.js`:

```javascript
model: 'gpt-4o-mini', // ili 'gpt-4', 'gpt-5'
```

### Prompt Customization

Editujte `buildPrompt()` funkciju u `lib/openai.js` za custom prompts.

### Firebase Auto-Save

U API pozivu, postavite `saveToCampaign: true` za automatsko spremanje u Firebase.

---

## 🐛 Troubleshooting

### Problem: "OPENAI_API_KEY not configured"

**Rješenje:**
```bash
# Dodajte u dashboard/.env
OPENAI_API_KEY=sk-proj-xxxxx
```

### Problem: "AI generisanje nije uspjelo"

**Moguća Rješenja:**
1. Provjerite API key
2. Provjerite OpenAI kredit
3. Provjerite network konekciju
4. Pogledajte browser konzolu

### Problem: "quota exceeded"

**Rješenje:**
- Dodajte kredit na OpenAI account
- Sačekajte reset (za free tier)

---

## 💡 Best Practices

1. **Uvijek pregledajte AI sadržaj** prije slanja
2. **Personalizirajte** customer data za bolje rezultate
3. **Testirajte emailove** sa test addressama
4. **Regenerirajte** ako sadržaj nije zadovoljavajući

---

## 📊 Cost Estimate

**Model:** `gpt-4o-mini`

- **Input:** ~150 tokens per request
- **Output:** ~300 tokens per request
- **Cost:** ~$0.002 per email generation

**100 kampanja = ~$0.20**

---

## 🔐 Security

- ✅ Firebase Auth verifikacija
- ✅ Server-side API calls only
- ✅ API key stored in `.env` (never exposed)
- ✅ Error messages ne otkrivaju API key

---

## 📝 Future Improvements

- [ ] Bulk generation za više recipijenata
- [ ] A/B testing sa različitim verzijama
- [ ] Personalizacija sa customer name/email
- [ ] Template library sa saved prompts
- [ ] Analytics za AI-generated vs manual emails

---

## ✅ Testing

### Manual Test:

1. Otvorite dashboard
2. Kreirajte novu kampanju
3. Unesite sender info
4. Kliknite "Generate with AI"
5. Provjerite generated subject i body

### Expected Behavior:

- ✅ Loading spinner tokom generisanja
- ✅ Toast notification nakon uspjeha
- ✅ Subject i body se popunjavaju
- ✅ Sparkles ikona pokazuje AI-generated content
- ✅ "Regenerate" dugme omogućava novi sadržaj

---

**Integration Complete! 🎉**

Za dodatnu pomoć, provjerite:
- OpenAI dokumentaciju: https://platform.openai.com/docs
- Firebase dokumentaciju: https://firebase.google.com/docs








