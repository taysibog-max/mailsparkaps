import JSZip from 'jszip';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${req.headers['x-forwarded-proto']||'http'}://${req.headers.host}`;
    const php = `<?php
/**
 * Plugin Name: Automailer Abandoned Cart
 * Description: Sends abandoned cart pings to Automailer app without adding theme scripts.
 * Version: 1.0.0
 * Author: Automailer
 */

if (!defined('ABSPATH')) { exit; }

// Default app URL (can be changed in Settings → Automailer)
if (!get_option('automailer_app_url')) {
  add_option('automailer_app_url', '${appUrl}');
}

add_action('admin_menu', function(){
  add_options_page('Automailer', 'Automailer', 'manage_options', 'automailer', function(){
    if (!current_user_can('manage_options')) return;
    if (isset($_POST['automailer_app_url'])) {
      check_admin_referer('automailer_save');
      update_option('automailer_app_url', esc_url_raw($_POST['automailer_app_url']));
      echo '<div class="updated"><p>Saved.</p></div>';
    }
    $url = esc_attr(get_option('automailer_app_url'));
    echo '<div class="wrap"><h1>Automailer</h1><form method="post">';
    wp_nonce_field('automailer_save');
    echo '<p><label>App URL (https): <input type="url" name="automailer_app_url" value="'.$url.'" class="regular-text" required></label></p>';
    submit_button('Save');
    echo '</form><p>Endpoint used: <code>'.$url.'/api/cart-tracking</code></p></div>';
  });
});

// Add Settings link on Plugins page
add_filter('plugin_action_links_' . plugin_basename(__FILE__), function($links){
  $url = admin_url('options-general.php?page=automailer');
  $links[] = '<a href="'.esc_url($url).'">Settings</a>';
  return $links;
});

/**
 * Send cart snapshot on checkout updates (non-blocking)
 */
function automailer_send_cart_ping() {
  if (!function_exists('WC')) return;
  $cart = WC()->cart;
  if (!$cart) return;
  $email = isset($_POST['billing_email']) ? sanitize_email($_POST['billing_email']) : '';
  if (empty($email)) return; // no email yet
  $items = array();
  foreach ($cart->get_cart() as $ci) {
    $p = $ci['data'];
    $items[] = array(
      'name' => wp_strip_all_tags($p->get_name()),
      'quantity' => intval($ci['quantity']),
      'price' => floatval($p->get_price())
    );
  }
  $body = array(
    'cart_id' => 'woo_' . wp_get_session_token(),
    'user_email' => $email,
    'user_name' => sanitize_text_field(isset($_POST['billing_first_name'])?$_POST['billing_first_name']:'') . ' ' . sanitize_text_field(isset($_POST['billing_last_name'])?$_POST['billing_last_name']:''),
    'cart_items' => $items,
    'page_url' => esc_url_raw(wp_get_referer()),
    'is_abandoned' => true
  );
  $endpoint = trailingslashit(get_option('automailer_app_url')) . 'api/cart-tracking';
  wp_remote_post($endpoint, array(
    'timeout' => 3,
    'blocking' => false,
    'headers' => array('Content-Type' => 'application/json'),
    'body' => wp_json_encode($body)
  ));
}

// Fire often during checkout input changes
add_action('woocommerce_after_checkout_validation', 'automailer_send_cart_ping', 99, 0);
add_action('woocommerce_checkout_update_order_review', 'automailer_send_cart_ping', 99, 0);
`;

    const readme = `=== Automailer Abandoned Cart ===\n\nSends abandoned cart pings to Automailer app. Configure App URL in Settings → Automailer.\n`;

    const zip = new JSZip();
    const folder = zip.folder('automailer-woo');
    folder.file('automailer-woo.php', php);
    folder.file('readme.txt', readme);
    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=automailer-woo.zip');
    res.status(200).send(buf);
  } catch (e) {
    res.status(500).json({ error: 'Failed to build zip', details: e.message });
  }
}


