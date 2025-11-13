# 🎨 CampaignModal Component - Brevo Style Campaign Editor

## ✅ Šta Je Kreirano

Kreirao sam **CampaignModal** komponentu koja izgleda **identično kao Brevo-ov campaign editor** sa dark theme-om i kompletnom funkcionalnostom.

---

## 📦 Fajlovi

### 1. `components/CampaignModal.jsx` ✅
Potpuno nova komponenta sa:
- **Dark theme** identičan Brevo-u
- **WYSIWYG HTML editor** (React Quill)
- **Sve input polja** (Subject, Sender Name, Sender Email)
- **Trigger timing dropdown** (30min, 1h, 24h, 48h, 7d)
- **"Send once per user" checkbox**
- **Progress bar** tokom kreiranja
- **Success/Error alerts**
- **Toast notifications**
- **Campaign statistics display** (nakon aktivacije)

### 2. `pages/api/brevo/campaign-stats.js` ✅
Nova API ruta za dohvatanje statistike kampanja:
- `GET /api/brevo/campaign-stats?id={campaignId}`
- Povlači statistiku direktno iz Brevo API-ja
- Vraća: sent, opens, clicks, openRate, clickRate

### 3. `pages/dashboard/campaigns/index.js` ✅
Ažurirana glavna Campaigns stranica:
- Dodat **"Create Campaign"** dugme na svakoj kartici
- Integrisan **CampaignModal**
- **Settings** dugme za konfiguraciju (postojeće)

---

## 🎯 Funkcionalnosti

### UI Komponente
✅ **Dark theme** (`bg-[#1a1d29]`, `#0f1117`) - identično Brevo-u  
✅ **Rounded inputs** sa border-om  
✅ **Ikone** (Lucide React) za svako polje  
✅ **Gradient buttons** (Save Draft + Activate Campaign)  
✅ **Click outside to close** modal  
✅ **Smooth animations** (slide-in toast)  
✅ **Custom scrollbar** styling  

### Form Fields
✅ **Campaign Name** - auto-generated sa datumom  
✅ **Subject Line** - sa Mail ikonom  
✅ **Sender Name** - sa User ikonom  
✅ **Sender Email** - sa AtSign ikonom + email validacija  
✅ **Trigger Timing** - dropdown (immediate, 30min, 1h, 24h, 48h, 7d)  
✅ **Send Once Per User** - checkbox  
✅ **Email Body** - React Quill WYSIWYG editor sa dark theme-om  

### Akcije
✅ **Save Draft** - kreira kampanju kao draft u Brevo-u  
✅ **Activate Campaign** - kreira i odmah aktivira kampanju  
✅ **Validacija** - sva obavezna polja + email format  
✅ **Progress bar** - vizuelni feedback tokom slanja  
✅ **Toast notifications** - success poruke  
✅ **Auto-close** - zatvara se nakon 2 sekunde  
✅ **Campaign stats** - prikazuje statistiku nakon aktivacije  

---

## 🔌 Brevo API Integracija

### POST `/api/brevo/create-campaign`
**Payload:**
```json
{
  "name": "Campaign Name",
  "subject": "Email Subject",
  "sender": {
    "name": "Sender Name",
    "email": "sender@email.com"
  },
  "htmlContent": "<p>HTML body</p>",
  "recipients": {
    "listIds": [1]
  },
  "type": "classic",
  "status": "active" | "draft",
  "metadata": {
    "campaignType": "Abandoned Cart",
    "triggerDelay": "30min",
    "sendOncePerUser": true
  }
}
```

### GET `/api/brevo/campaign-stats?id={id}`
**Response:**
```json
{
  "stats": {
    "sent": 100,
    "opens": 45,
    "clicks": 12,
    "openRate": 45.0,
    "clickRate": 12.0,
    "unsubscribed": 2,
    "bounced": 1
  }
}
```

---

## 🚀 Kako Koristiti

### 1. Otvori Campaigns stranicu
```
http://localhost:3001/dashboard/campaigns
```

### 2. Klikni "Create Campaign" na bilo kojoj kartici
- **Abandoned Cart** → Otvara modal sa "Abandoned Cart" kampanjom
- **Welcome Email** → Otvara modal sa "Welcome Email" kampanjom
- itd...

### 3. Popuni formu
- **Campaign Name** (auto-populated)
- **Subject Line** (obavezno)
- **Sender Name** (obavezno)
- **Sender Email** (obavezno, validiran)
- **Trigger Timing** (odaberi delay)
- **Send Once Per User** (checkbox)
- **Email Content** (WYSIWYG editor)

### 4. Klikni dugme
- **Save Draft** → Čuva kao draft u Brevo-u
- **Activate Campaign** → Kreira i odmah aktivira

### 5. Success!
- Toast notifikacija se pojavljuje
- Modal se automatski zatvara nakon 2s
- Kampanje se refreshuju
- Statistika se prikazuje (ako je aktivirana)

---

## 🎨 Design Detalji

### Boje (Identično Brevo-u)
```css
Background: #1a1d29 (modal)
Background: #0f1117 (inputs, editor)
Border: #374151 (gray-700)
Text: white
Placeholder: #6b7280 (gray-500)
Primary: Blue-Purple gradient (#3b82f6 → #9333ea)
```

### React Quill Dark Theme
```css
Toolbar: #0f1117
Container: #0f1117
Buttons: #9ca3af (hover: white)
Editor text: white
Placeholder: #6b7280
```

### Animations
- **Modal fade-in** (backdrop blur)
- **Toast slide-in** (from right)
- **Progress bar** (gradient pink→fuchsia→purple)

---

## 📊 Statistika (Nakon Aktivacije)

Ako korisnik klikne "Activate Campaign", modal automatski:
1. Kreira kampanju u Brevo-u
2. Čeka 2 sekunde
3. Poziva `/api/brevo/campaign-stats?id={id}`
4. Prikazuje statistiku u modalu:
   - **Sent** (broj poslanih)
   - **Opens** (broj otvaranja)
   - **Clicks** (broj klikova)
   - **Open Rate** (%)

---

## 🧪 Testiranje

### 1. Testiraj otvaranje modala
```
Klikni "Create Campaign" → Modal se otvara ✅
```

### 2. Testiraj validaciju
```
Ostavi prazna polja → Klikni "Activate" → Error poruka ✅
Unesi pogrešan email → Error poruka ✅
```

### 3. Testiraj save draft
```
Popuni formu → Klikni "Save Draft" → Progress bar → Success toast ✅
```

### 4. Testiraj activate
```
Popuni formu → Klikni "Activate Campaign" → Progress bar → Success → Stats display ✅
```

### 5. Testiraj WYSIWYG editor
```
Piši text → Bold, italic, underline → Add link → Add image ✅
```

### 6. Testiraj click outside
```
Klikni van modala → Modal se zatvara ✅
```

---

## ✨ Dodatne Funkcionalnosti

### Auto-populated Campaign Name
```javascript
campaignName = "Abandoned Cart - 10/15/2025"
```

### Email Validacija
```javascript
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
```

### Progress Bar Stages
```javascript
0%   → Start
30%  → Validation passed
50%  → API request sent
80%  → Response received
100% → Success
```

### Toast Auto-dismiss
```javascript
setTimeout(() => toast.remove(), 3000);
```

---

## 🔥 Brevo-Style Features

✅ **Dark theme** identičan Brevo dashboard-u  
✅ **Rounded inputs** sa ikonicama  
✅ **Gradient buttons** (blue→purple)  
✅ **Progress bar** tokom akcija  
✅ **Toast notifications** umjesto alert-a  
✅ **Campaign stats** display  
✅ **WYSIWYG editor** sa toolbar-om  
✅ **Smooth animations**  
✅ **Click outside to close**  
✅ **Clean borders & spacing**  

---

## 📝 Dependencies

```json
{
  "react-quill": "^2.0.0",
  "lucide-react": "^0.x.x",
  "next": "^14.2.33"
}
```

---

## 🎉 Rezultat

Sada imaš **potpuno funkcionalan Campaign Editor** koji:
1. Izgleda identično kao Brevo
2. Direktno kreira kampanje u Brevo-u preko API-ja
3. Ima WYSIWYG HTML editor
4. Prikazuje statistiku nakon aktivacije
5. Ima sve input polja iz zahtjeva
6. Koristi dark theme sa clean design-om

**Server je pokrenut na `http://localhost:3001` - testiraj sada!** 🚀

