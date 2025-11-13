/**
 * Provjeri Firebase environment varijable
 */

export function checkFirebaseEnv() {
  const required = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID'
  ];

  const missing = [];
  const present = [];

  required.forEach(key => {
    if (process.env[key]) {
      present.push(key);
    } else {
      missing.push(key);
    }
  });

  return {
    allPresent: missing.length === 0,
    missing,
    present,
    config: {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '***' : 'MISSING',
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'MISSING',
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'MISSING',
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'MISSING',
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ? '***' : 'MISSING',
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ? '***' : 'MISSING'
    }
  };
}

// Log u konzoli
export function logFirebaseEnv() {
  const env = checkFirebaseEnv();
  console.log('🔧 Firebase Environment Check:', env);
  
  if (!env.allPresent) {
    console.error('❌ Missing Firebase environment variables:', env.missing);
    console.log('📝 Create a .env.local file with:');
    env.missing.forEach(key => {
      console.log(`${key}=your_value_here`);
    });
  } else {
    console.log('✅ All Firebase environment variables present');
  }
  
  return env;
}
