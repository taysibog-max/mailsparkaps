export default function HowToCreateShopifyToken() {
  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-zinc-900/60 p-5 text-sm text-neutral-200">
      <h3 className="text-base font-semibold text-white mb-3">How to Generate Your Shopify Admin API Token</h3>
      <ol className="list-decimal list-inside space-y-2 text-neutral-300">
        <li>Open Shopify Admin → Settings → Apps and sales channels</li>
        <li>Click “Develop apps”</li>
        <li>Create a new app</li>
        <li>
          Under “Admin API access scopes”, enable:
          <ul className="list-disc list-inside ml-4 mt-1 space-y-1 text-neutral-400">
            <li>read_orders</li>
            <li>read_checkouts</li>
            <li>read_customers</li>
          </ul>
        </li>
        <li>Click “Install App”</li>
        <li>Copy the Admin API Access Token and paste it into MailSpark.</li>
      </ol>
    </div>
  );
}



