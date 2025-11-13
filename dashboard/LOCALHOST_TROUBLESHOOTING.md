# 🔧 Localhost Troubleshooting - Rješavanje Problema

## 🎯 Problem: "This site can't be reached" ili "ERR_CONNECTION_REFUSED"

### ✅ Šta je urađeno:
1. **Ugašeni svi konfliktni serveri** (nodemon, backend, stare Next.js instance)
2. **Oslobođeni portovi** 3000, 3001, 3002, 3010
3. **Pokrenut dashboard server**
4. **Otvorila browser na http://localhost:3000**

## 🔍 Ako i dalje ne radi, pokušajte:

### 1. **Ručno otvorite browser:**
```
http://localhost:3000
http://localhost:3001  
http://localhost:3002
```

### 2. **Provjerite da li server radi:**
```bash
cd dashboard
npm run dev
```

**Trebali biste vidjeti:**
```
▲ Next.js 14.2.33
- Local: http://localhost:3000 (ili 3001, 3002)
✓ Ready in X.Xs
```

### 3. **Ako port 3000 ne radi, pokušajte:**
- **http://localhost:3001**
- **http://localhost:3002**

### 4. **Ako i dalje ne radi, restartajte terminal:**
```bash
# Ugašite sve servere
pkill -f "next dev"
pkill -f "nodemon" 
pkill -f "node"

# Idite u dashboard folder
cd /Users/Melisa/Desktop/automailer/dashboard

# Pokrenite server
npm run dev
```

### 5. **Provjerite firewall/proxy:**
- **macOS Firewall:** System Preferences → Security & Privacy → Firewall
- **Antivirus:** Provjerite da li blokira localhost
- **VPN:** Ako koristite VPN, isključite ga privremeno

### 6. **Alternativni pristup:**
```bash
# Pokrenite na specifičnom portu
npx next dev -p 3000

# Ili
npm run dev -- -p 3000
```

## 🎯 Očekivani Rezultat:

Kada server radi, trebali biste vidjeti:
- ✅ **Next.js loading poruku** u browseru
- ✅ **Dashboard interface** (ili sign-in stranicu)
- ✅ **Nema "This site can't be reached" greške**

## 🔥 Ako dashboard radi, sljedeći korak:

1. **Otvorite Developer Console (F12)**
2. **Pokrenite dijagnostiku:**
```javascript
window.diagnostics.fullDiagnostics()
```

3. **Omogućite Firebase servise** ako su potrebni:
   - [Firebase Authentication](https://console.firebase.google.com/project/automailer-8d125/authentication/providers)
   - [Firestore Database](https://console.firebase.google.com/project/automailer-8d125/firestore)

## 📞 Ako i dalje ne radi:

**Kopirajte i pošaljite mi:**
1. **Terminal output** od `npm run dev`
2. **Browser error poruku** (F12 → Console)
3. **URL koji pokušavate otvoriti**

**Dashboard treba raditi na jednom od ovih URL-ova:**
- http://localhost:3000
- http://localhost:3001  
- http://localhost:3002

## 🚀 Finalni Status:

**Svi serveri su ugašeni i samo dashboard radi!**
**Browser je otvoren na http://localhost:3000**

**Ako vidite "This site can't be reached", pokušajte:**
1. **Refresh stranice (Ctrl+R ili Cmd+R)**
2. **Otvori http://localhost:3001 ili 3002**
3. **Restartaj terminal i pokreni `npm run dev`**
