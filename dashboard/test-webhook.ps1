# Test Webhook Script (PowerShell)
# Šalje test webhook na tvoj lokalni server

Write-Host ""
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host "🧪 SLANJE TEST WEBHOOK-A..." -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host ""

$webhookUrl = "http://localhost:3000/api/webhooks/shopify"

Write-Host "📧 Slanje na: $webhookUrl" -ForegroundColor White
Write-Host ""

$headers = @{
    "Content-Type" = "application/json"
    "X-Shopify-Topic" = "checkouts/create"
    "X-Shopify-Shop-Domain" = "test-store.myshopify.com"
}

$body = @{
    token = "test_cart_12345"
    email = "test@example.com"
    customer = @{
        first_name = "Marko"
        last_name = "Marković"
        email = "test@example.com"
    }
    phone = "+38163123456"
    line_items = @(
        @{
            id = 1
            product_id = 101
            title = "Test Proizvod - Nike patike"
            quantity = 2
            price = "99.99"
        }
    )
    total_price = "199.98"
    currency = "EUR"
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri $webhookUrl -Method Post -Headers $headers -Body $body
    
    Write-Host ""
    Write-Host "════════════════════════════════════════════════════" -ForegroundColor Magenta
    Write-Host "✅ WEBHOOK USPEŠNO POSLAT!" -ForegroundColor Green
    Write-Host "════════════════════════════════════════════════════" -ForegroundColor Magenta
    Write-Host ""
    
    Write-Host "📋 Odgovor servera:" -ForegroundColor Yellow
    $response | ConvertTo-Json -Depth 10 | Write-Host -ForegroundColor White
    Write-Host ""
    
    Write-Host "════════════════════════════════════════════════════" -ForegroundColor Magenta
    Write-Host "📊 SLEDEĆI KORACI:" -ForegroundColor Yellow
    Write-Host "════════════════════════════════════════════════════" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "1. ⏱️  Sačekaj 2 minuta" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "2. 🚀 Pokreni CRON (u novom terminalu):" -ForegroundColor Cyan
    Write-Host "   curl 'http://localhost:3000/api/cron/check-abandoned-carts?manual=true'" -ForegroundColor White
    Write-Host ""
    Write-Host "   ILI:" -ForegroundColor Gray
    Write-Host "   Invoke-RestMethod -Uri 'http://localhost:3000/api/cron/check-abandoned-carts?manual=true'" -ForegroundColor White
    Write-Host ""
    Write-Host "3. 🔍 Proveri Firebase Console:" -ForegroundColor Cyan
    Write-Host "   → /events/test-store/cart_abandoned/" -ForegroundColor Gray
    Write-Host "   → /users/test-store/contacts/test_example_com/" -ForegroundColor Gray
    Write-Host "   → /users/test-store/sent_emails/" -ForegroundColor Gray
    Write-Host ""
    Write-Host "4. 📧 Proveri email inbox:" -ForegroundColor Cyan
    Write-Host "   → test@example.com" -ForegroundColor Gray
    Write-Host ""
    Write-Host "5. 🖥️  Proveri Dashboard:" -ForegroundColor Cyan
    Write-Host "   → http://localhost:3000/dashboard/contacts" -ForegroundColor Gray
    Write-Host ""
    Write-Host "════════════════════════════════════════════════════" -ForegroundColor Magenta
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "════════════════════════════════════════════════════" -ForegroundColor Magenta
    Write-Host "❌ GREŠKA!" -ForegroundColor Red
    Write-Host "════════════════════════════════════════════════════" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "Greška: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Proveri:" -ForegroundColor Yellow
    Write-Host "  • Da li Next.js server radi na http://localhost:3000?" -ForegroundColor White
    Write-Host "  • Da li je /api/webhooks/shopify endpoint dostupan?" -ForegroundColor White
    Write-Host ""
}

Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")







