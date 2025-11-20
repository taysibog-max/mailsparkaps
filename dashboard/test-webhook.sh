#!/bin/bash

# Test Webhook Script
# Šalje test webhook na tvoj lokalni server

echo ""
echo "════════════════════════════════════════════════════"
echo "🧪 SLANJE TEST WEBHOOK-A..."
echo "════════════════════════════════════════════════════"
echo ""

# Test data
WEBHOOK_URL="http://localhost:3000/api/webhooks/shopify"

echo "📧 Slanje na: $WEBHOOK_URL"
echo ""

# Send webhook
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Topic: checkouts/create" \
  -H "X-Shopify-Shop-Domain: test-store.myshopify.com" \
  -d '{
    "token": "test_cart_12345",
    "email": "test@example.com",
    "customer": {
      "first_name": "Marko",
      "last_name": "Marković",
      "email": "test@example.com"
    },
    "phone": "+38163123456",
    "line_items": [
      {
        "id": 1,
        "product_id": 101,
        "title": "Test Proizvod - Nike patike",
        "quantity": 2,
        "price": "99.99"
      }
    ],
    "total_price": "199.98",
    "currency": "EUR"
  }'

echo ""
echo ""
echo "════════════════════════════════════════════════════"
echo "✅ WEBHOOK POSLAT!"
echo "════════════════════════════════════════════════════"
echo ""
echo "📊 Sledeći koraci:"
echo ""
echo "1. ⏱️  Sačekaj 2 minuta"
echo ""
echo "2. 🚀 Pokreni CRON:"
echo "   curl 'http://localhost:3000/api/cron/check-abandoned-carts?manual=true'"
echo ""
echo "3. 🔍 Proveri Firebase Console:"
echo "   /events/test-store/cart_abandoned/"
echo "   /users/test-store/contacts/test_example_com/"
echo ""
echo "4. 📧 Proveri email inbox: test@example.com"
echo ""
echo "════════════════════════════════════════════════════"
echo ""








