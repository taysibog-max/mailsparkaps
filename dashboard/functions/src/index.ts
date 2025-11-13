import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const firestore = admin.firestore();

type AbandonedCart = {
  email?: string;
  items?: any[];
  lastUpdate?: admin.firestore.Timestamp;
  recovered?: boolean;
  emailSent?: boolean;
  emailEvents?: number;
};

async function sendBrevoEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.BREVO_API_KEY || functions.config().brevo?.api_key;
  if (!apiKey) throw new Error('BREVO_API_KEY not set');
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'accept': 'application/json', 'api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ sender: { name: 'Recovery', email: process.env.SENDER_EMAIL || 'noreply@example.com' }, to: [{ email: to }], subject, htmlContent: html }),
  });
  if (!res.ok) {
    const data = await res.text();
    throw new Error(`Brevo send failed: ${res.status} ${data}`);
  }
}

export const processAbandonedCarts = functions.pubsub.schedule('every 60 minutes').onRun(async () => {
  const now = admin.firestore.Timestamp.now();
  const oneHourAgo = admin.firestore.Timestamp.fromMillis(Date.now() - 60 * 60 * 1000);

  const storesSnap = await firestore.collection('stores').get();
  const tasks: Promise<any>[] = [];
  storesSnap.forEach((storeDoc) => {
    const cartsRef = storeDoc.ref.collection('abandoned_carts');
    const p = cartsRef.where('recovered', '==', false).get().then(async (carts) => {
      for (const cart of carts.docs) {
        const data = cart.data() as AbandonedCart;
        const lastUpdate = data.lastUpdate || now;
        const email = data.email || '';
        const emailEvents = Number(data.emailEvents || 0);
        if (!email) continue;

        const shouldSend = lastUpdate.toMillis() <= oneHourAgo.toMillis() && emailEvents < 3;
        if (!shouldSend) continue;

        // Stop sending if recovered by order
        const ordersSnap = await storeDoc.ref.collection('orders')
          .where('email', '==', email).orderBy('createdAt', 'desc').limit(1).get();
        if (!ordersSnap.empty) {
          await cart.ref.set({ recovered: true }, { merge: true });
          continue;
        }

        const subject = emailEvents === 0 ? 'You left something behind' : emailEvents === 1 ? 'Still there?' : 'Last reminder';
        const html = `<p>Hi, you left items in your cart.</p>`;
        try {
          await sendBrevoEmail(email, subject, html);
          await cart.ref.set({ emailSent: true, emailEvents: emailEvents + 1 }, { merge: true });
        } catch (e) {
          console.error('Failed to send email for cart', cart.id, e);
        }
      }
    });
    tasks.push(p);
  });
  await Promise.all(tasks);
  return null;
});




