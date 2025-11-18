# 🔐 **KAKO PODESITI ENVIRONMENT VARIABLES**

## ❌ **PROBLEM:**

Greška: **"Failed to generate email content with AI"**

**Razlog:** Environment variables nisu konfigurisane u `.env.local` fajlu.

---

## ✅ **REŠENJE (5 MINUTA):**

### **KORAK 1: Kreiraj `.env.local` fajl**

U `dashboard/` folderu, kreiraj novi fajl: `.env.local`

```
dashboard/
├── pages/
├── components/
├── lib/
├── .env.local  ← Kreiraj ovde
└── package.json
```

### **KORAK 2: Kopiraj ovaj template:**

```env
# ========================================
# FIREBASE ADMIN SDK
# ========================================
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com

# ========================================
# FIREBASE CLIENT (FRONTEND)
# ========================================
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef

# ========================================
# BREVO API
# ========================================
BREVO_API_KEY=xkeysib-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-xxxxxxxxxxxx
SENDER_EMAIL=noreply@yourdomain.com

# ========================================
# OPENAI API
# ========================================
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ========================================
# WEBHOOKS & SECURITY
# ========================================
WEBHOOK_SECRET=your_secure_webhook_secret
CRON_SECRET=your_secure_cron_secret

# ========================================
# Internal API calls (server-to-server)
# ========================================
# Optional explicit base URL for internal fetch() calls.
# If not set, the app will use:
#   INTERNAL_API_BASE_URL → NEXT_PUBLIC_APP_URL → https://${VERCEL_URL} → http://localhost:3000
INTERNAL_API_BASE_URL=

# If your Vercel project has Password Protection enabled,
# set the bypass token so internal calls (webhooks/CRON) don't get 401.
# You can find it in: Vercel → Project → Settings → Protection → Bypass token
VERCEL_PROTECTION_BYPASS=
# (Also supported aliases if you prefer)
PROTECTION_BYPASS_TOKEN=
VERCEL_BYPASS_TOKEN=

# ========================================
# APP CONFIGURATION
# ========================================
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 🔑 **KAKO DOBITI API KLJUČEVE:**

### **1. OpenAI API Key** (za AI generisanje emailova)

**Gde dobiti:**
1. Idi na: https://platform.openai.com/api-keys
2. Login sa OpenAI nalogom
3. Klikni **"Create new secret key"**
4. Kopiraj key (počinje sa `sk-proj-...`)
5. Dodaj u `.env.local`:
   ```
   OPENAI_API_KEY=sk-proj-tvoj-key-ovde
   ```

**Cena:** ~$0.002 po email generaciji (gpt-4o-mini)

---

### **2. Brevo API Key** (za slanje emailova)

**Gde dobiti:**
1. Idi na: https://app.brevo.com/
2. Login ili kreiraj besplatan nalog
3. Idi na **Settings** → **SMTP & API**
4. Klikni **"Create a new API key"**
5. Kopiraj key (počinje sa `xkeysib-...`)
6. Dodaj u `.env.local`:
   ```
   BREVO_API_KEY=xkeysib-tvoj-key-ovde
   SENDER_EMAIL=tvoj@email.com
   ```

**Cena:** Besplatan do 300 emailova/dan

---

### **3. Firebase Credentials** (baza podataka)

**Gde dobiti:**

#### **Admin SDK:**
1. Idi na: https://console.firebase.google.com/
2. Otvori svoj projekat
3. Idi na **Project Settings** (⚙️) → **Service Accounts**
4. Klikni **"Generate New Private Key"**
5. Download JSON file
6. Otvori JSON i kopiraj vrednosti:
   ```json
   {
     "project_id": "your-project-id",
     "client_email": "firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com",
     "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   }
   ```
7. Dodaj u `.env.local`:
   ```
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   FIREBASE_DATABASE_URL=https://your-project-id-default-rtdb.firebaseio.com
   ```

#### **Client SDK (Frontend):**
1. Idi na **Project Settings** → **General**
2. Scroll do **Your apps** → Web app
3. Kopiraj config values:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   ```

**Cena:** Besplatan Spark plan (dovoljan za testiranje)

---

### **4. Webhook & CRON Secrets** (bezbednost)

**Generiši random string:**

**PowerShell:**
```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

**Bash:**
```bash
openssl rand -hex 32
```

**Dodaj u `.env.local`:**
```
WEBHOOK_SECRET=generisani_random_string_1
CRON_SECRET=generisani_random_string_2
```

---

## ⚠️ **VAŽNE NAPOMENE:**

### **1. FIREBASE_PRIVATE_KEY Format:**

✅ **Dobro:**
```
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQ...tvoj key...\n-----END PRIVATE KEY-----\n"
```

❌ **Loše:**
```
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvQ...
-----END PRIVATE KEY-----"
```

**Zadrži `\n` karaktere!** Oni su potrebni.

### **2. Ne Komituj `.env.local`:**

Dodaj u `.gitignore`:
```
.env.local
.env
```

### **3. Production vs Development:**

- **Development:** `.env.local` (ne komituj)
- **Production (Vercel):** Dodaj u Vercel dashboard → Settings → Environment Variables

---

## 🔄 **KORAK 3: Restartuj Server**

Nakon što dodaš API ključeve:

1. **Zaustavi trenutni server:**
   - Pritisni **Ctrl+C** u terminalu

2. **Očisti cache (opciono):**
   ```bash
   rm -rf .next
   ```

3. **Pokreni ponovo:**
   ```bash
   npm run dev
   ```

4. **Proveri terminal output:**
   ```
   ✓ Ready in 5s
   - Local: http://localhost:3000
   ```

   Trebalo bi da **nestane** ovih poruka:
   ```
   [Firebase] Missing Firebase credentials  ← Trebalo bi da nestane
   [SMTP] environment variables not set     ← Trebalo bi da nestane
   ```

---

## ✅ **Proveri Da Li Radi:**

### **Test 1: OpenAI**

1. Otvori Dashboard → Templates
2. Klikni **"Create with AI"**
3. Odaberi **"Abandoned Cart"**
4. Klikni **"Generate with AI"**

**Očekivano:** Email sadržaj se generiše ✅

**Ako ne radi:**
- Proveri: `OPENAI_API_KEY=sk-proj-...` u `.env.local`
- Proveri terminal za greške

### **Test 2: Brevo**

Nakon što se generiše email, klikni **"Create Template"**.

**Očekivano:** Template se čuva u Firebase ✅

### **Test 3: Firebase**

Otvori Firebase Console → Realtime Database

**Očekivano:** Vidiš novi template u `/users/{uid}/email_templates/` ✅

---

## 🎯 **Završni Checklist:**

- [ ] `.env.local` fajl kreiran
- [ ] `OPENAI_API_KEY` dodat
- [ ] `BREVO_API_KEY` dodat
- [ ] Firebase credentials dodati (Admin + Client)
- [ ] Server restartovan
- [ ] Test: AI generisanje radi
- [ ] Test: Firebase čuvanje radi
- [ ] Test: Brevo slanje radi (opciono)

---

## 🆘 **Ako Nešto Ne Radi:**

### **Greška: "OPENAI_API_KEY not configured"**

**Rešenje:**
1. Proveri da li `.env.local` postoji u `dashboard/` folderu
2. Proveri da key počinje sa `sk-proj-`
3. Restartuj server (Ctrl+C pa `npm run dev`)

### **Greška: "Firebase credentials missing"**

**Rešenje:**
1. Proveri da li su svi `FIREBASE_*` variables dodati
2. Proveri da `FIREBASE_PRIVATE_KEY` ima `\n` karaktere
3. Proveri da key ima navodnik `"..."`

### **Greška: "Brevo API error"**

**Rešenje:**
1. Proveri da key počinje sa `xkeysib-`
2. Proveri u Brevo dashboard da je key active
3. Proveri da nisi prešao 300 emailova/dan (free limit)

---

## 📞 **Support:**

- Firebase: https://firebase.google.com/support
- Brevo: https://help.brevo.com/
- OpenAI: https://help.openai.com/

---

**Kada sve radi, možeš nastaviti sa testiranjem! 🎉**







