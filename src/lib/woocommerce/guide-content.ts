export const WOO_CORE_TOPICS = [
  "order.created",
  "order.updated",
  "product.updated",
] as const;

export function getWebhookDeliveryUrl(tenantId: number | string): string {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || "https://framebooks.com";
  return `${baseUrl.replace(/\/+$/, "")}/api/integrations/woocommerce/webhook/${tenantId}`;
}

export interface WizardStepContent {
  step: number;
  id: string;
  title: string;
  shortDesc: string;
  fullInstruction: string;
  instructions?: string[];
  moreHelp?: string;
  wpPath?: string;
  importantNote?: string;
  checkLabel: string;
}

export interface TroubleshootingItem {
  id: string;
  errorCode: string;
  title: string;
  symptom: string;
  fix: string;
  wpPath?: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export const WOO_GUIDE_CONTENT = {
  locale: "en",
  title: "Connect WooCommerce",
  subtitle: "Two-way stock and order synchronization for Framebooks POS.",

  steps: [
    {
      step: 1,
      id: "prerequisites",
      title: "Permalinks & HTTPS",
      shortDesc: "Enable clean URLs and SSL",
      wpPath: "Settings > Permalinks",
      instructions: [
        "Confirm your site loads over https://",
        "Set permalinks to 'Post name' and save",
      ],
      moreHelp: "The WooCommerce REST API returns 404 errors if permalinks are set to Plain (?p=123).",
      fullInstruction: "Ensure your store uses HTTPS and set permalinks to 'Post name' in Settings > Permalinks.",
      checkLabel: "Permalinks & HTTPS ready",
    },
    {
      step: 2,
      id: "stock_management",
      title: "Stock Tracking",
      shortDesc: "Enable inventory and SKUs",
      wpPath: "WooCommerce > Settings > Products > Inventory",
      instructions: [
        "Check 'Enable stock management' and save",
        "Assign a unique SKU to each product and variation",
      ],
      moreHelp: "Products without unique SKUs cannot be synchronized.",
      fullInstruction: "Check 'Enable stock management' in WooCommerce and ensure every product has a unique SKU.",
      checkLabel: "Stock tracking enabled",
    },
    {
      step: 3,
      id: "api_keys",
      title: "Generate API Keys",
      shortDesc: "Create Read/Write REST keys",
      wpPath: "WooCommerce > Settings > Advanced > REST API",
      instructions: [
        "Click 'Add key' with Permissions set to Read/Write",
        "Copy the Consumer key and Consumer secret",
      ],
      moreHelp: "WooCommerce shows the secret only once. If lost, generate a new key.",
      fullInstruction: "Create a key with Read/Write access in WooCommerce REST API settings, then copy both keys.",
      checkLabel: "Read/Write keys generated",
    },
    {
      step: 4,
      id: "enter_credentials",
      title: "Connect Store",
      shortDesc: "Enter store URL and keys",
      instructions: [
        "Enter your store URL, Consumer key, and Secret",
        "Click 'Test connection' to verify access",
      ],
      moreHelp: "Your keys are encrypted and stored safely. We never share or expose your secrets.",
      fullInstruction: "Enter your store URL and keys below, then test the connection.",
      checkLabel: "Store connected",
    },
    {
      step: 5,
      id: "webhooks",
      title: "Verify Webhooks",
      shortDesc: "Automatic order and stock sync",
      wpPath: "WooCommerce > Settings > Advanced > Webhooks",
      instructions: [
        "Webhooks register automatically on connection",
        "Confirm all 3 webhooks show Active status",
      ],
      moreHelp: "If blocked by a firewall, add the webhooks manually in WordPress using the delivery URL below.",
      fullInstruction: "Webhooks register automatically on connection. If blocked, paste the delivery URL manually.",
      checkLabel: "Webhooks active",
    },
    {
      step: 6,
      id: "sync_options",
      title: "Map Products",
      shortDesc: "Link existing inventory by SKU",
      instructions: [
        "Open the SKU Review Wizard",
        "Confirm matched products and initial stock winner",
      ],
      moreHelp: "Existing stock is never overwritten without your confirmation.",
      fullInstruction: "Open the SKU Review Wizard to link products and choose the initial stock winner.",
      checkLabel: "Products mapped",
    },
  ] as WizardStepContent[],

  troubleshooting: [
    {
      id: "auth_failed",
      errorCode: "401 / AUTH_FAILED",
      title: "Invalid API Keys (401)",
      symptom: "Consumer key or secret rejected.",
      fix: "Verify keys in WooCommerce > Settings > Advanced > REST API and ensure Permissions are Read/Write.",
      wpPath: "WooCommerce > Settings > Advanced > REST API",
    },
    {
      id: "rest_no_route",
      errorCode: "404 / NOT_FOUND",
      title: "REST API Not Found (404)",
      symptom: "API endpoint returned 404.",
      fix: "In WordPress, open Settings > Permalinks, choose 'Post name', and click Save Changes.",
      wpPath: "WordPress Admin > Settings > Permalinks",
    },
    {
      id: "ssl_error",
      errorCode: "SSL_ERROR",
      title: "SSL Certificate Error",
      symptom: "HTTPS connection failed.",
      fix: "Install a valid SSL certificate on your store domain. Self-signed certificates are rejected.",
    },
    {
      id: "firewall_blocked",
      errorCode: "403 / TIMEOUT / BLOCKED",
      title: "Blocked by Firewall (403)",
      symptom: "Request timed out or blocked.",
      fix: "Allow REST API calls to /wp-json/wc/v3/ in Cloudflare, Wordfence, or your security plugin.",
    },
    {
      id: "missing_skus",
      errorCode: "MISSING_DUPLICATE_SKUS",
      title: "Missing or Duplicate SKUs",
      symptom: "Products cannot be matched.",
      fix: "Add unique SKUs to each product and variation under Product Data > Inventory.",
      wpPath: "WooCommerce > Products > Edit Product > Inventory",
    },
    {
      id: "manage_stock_disabled",
      errorCode: "MANAGE_STOCK_DISABLED",
      title: "Stock Tracking Disabled",
      symptom: "Stock changes do not sync.",
      fix: "Enable 'Manage stock' in WooCommerce > Settings > Products > Inventory and on individual products.",
      wpPath: "WooCommerce > Settings > Products > Inventory",
    },
  ] as TroubleshootingItem[],

  faqs: [
    {
      id: "find_keys",
      question: "Where do I find my API keys?",
      answer: "In WordPress, go to WooCommerce > Settings > Advanced > REST API, click Add key, and choose Read/Write.",
    },
    {
      id: "disconnect_anytime",
      question: "What happens if I disconnect?",
      answer: "Disconnecting deletes your stored API keys and webhooks. Existing SKU mappings and POS stock are preserved.",
    },
    {
      id: "stock_behavior",
      question: "How does POS stock update online?",
      answer: "When an item sells at the counter, Framebooks updates the stock count in WooCommerce immediately.",
    },
    {
      id: "conflict_winner",
      question: "Which side wins if stock changes simultaneously?",
      answer: "Your Sync Settings policy sets the winner (Framebooks or WooCommerce). All changes appear in the sync log.",
    },
  ] as FaqItem[],
};
