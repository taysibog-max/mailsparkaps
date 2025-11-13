const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: 'automailer-8d125',
      clientEmail: 'firebase-adminsdk-fbsvc@automailer-8d125.iam.gserviceaccount.com',
      privateKey: require('/Users/Melisa/Desktop/automailer-8d125-firebase-adminsdk-fbsvc-ab75f85523.json').private_key
    }),
    databaseURL: 'https://automailer-8d125-default-rtdb.firebaseio.com'
  });
}

console.log('🔧 Postavljam security rules...\n');

const rules = {
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    },
    "stores": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
};

const https = require('https');
const { GoogleAuth } = require('google-auth-library');
const serviceAccount = require('/Users/Melisa/Desktop/automailer-8d125-firebase-adminsdk-fbsvc-ab75f85523.json');

async function setRules() {
  try {
    const auth = new GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/firebase']
    });
    
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    
    const postData = JSON.stringify(rules);
    
    const options = {
      hostname: 'automailer-8d125-default-rtdb.firebaseio.com',
      path: '/.settings/rules.json?access_token=' + accessToken.token,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ Security rules postavljeni!');
          console.log('\nPravila:');
          console.log('- Korisnici mogu da čitaju/pišu samo svoje podatke');
          console.log('- Store-ovi su zaštićeni autentifikacijom\n');
        } else {
          console.log('Status:', res.statusCode);
          console.log('Response:', data);
        }
      });
    });
    
    req.on('error', (e) => {
      console.error('Error:', e.message);
    });
    
    req.write(postData);
    req.end();
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

setRules();

