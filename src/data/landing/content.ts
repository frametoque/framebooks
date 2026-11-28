export const navigation = [
  { name: 'Features', href: '/#features' },
  { name: 'Pricing', href: '/#pricing' },
  { name: 'POS', href: '/#pos' },
  { name: 'Guide', href: '/guide' },
  { name: 'FAQ', href: '/#faq' },
  { name: 'Contact', href: '/#contact' },
];

export const footerProductLinks = [
  { name: 'Features', href: '/#features' },
  { name: 'Pricing', href: '/#pricing' },
  { name: 'POS', href: '/#pos' },
  { name: 'Guide', href: '/guide' },
];

export const footerLegalLinks = [
  { name: 'Privacy Policy', href: '/privacy' },
  { name: 'Terms of Service', href: '/terms' },
  { name: 'Cookie Policy', href: '/cookies' },
  { name: 'Refund Policy', href: '/refund' },
];

export const kpis = [
  { label: 'Built-in modules', value: '11' },
  { label: 'Checkout speed', value: 'Instant' },
  { label: 'Native currency', value: 'LKR-first' },
  { label: 'Security architecture', value: 'Bank-grade' },
];

export const features = [
  { title: 'Income tracking', description: 'Every rupee earned. Linked directly to your invoices.', icon: 'MdCallReceived' },
  { title: 'Expense management', description: 'Know where money goes by account and category.', icon: 'MdCallMade' },
  { title: 'Multi-account banking', description: 'All your bank and cash ledgers in one clear view.', icon: 'MdAccountBalance' },
  { title: 'Invoicing', description: 'Clean, professional invoices. Sent in seconds, paid faster.', icon: 'MdInsertDriveFile' },
  { title: 'Quotations', description: 'Crisp estimates that convert to invoices with one tap.', icon: 'MdInsertDriveFile' },
  { title: 'Client directory', description: 'Every client, balance, and purchase history at your fingertips.', icon: 'MdGroup' },
  { title: 'Inventory', description: 'Live stock levels and total valuation across every shelf.', icon: 'MdInventory' },
  { title: 'Point of Sale', description: 'Sub-second barcode scanning, live stock sync, and receipt printing.', icon: 'MdPointOfSale' },
  { title: 'Financial reports', description: 'Instant P&L and cash flow. No accounting jargon.', icon: 'MdTrendingUp' },
];

export const modulesData = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    description: 'Real-time revenue, profit, and cash runway at a glance.',
    align: 'left'
  },
  {
    id: 'invoices-quotations',
    title: 'Invoices & Quotations',
    description: 'Professional billing and estimates that convert to invoices with automated payment tracking.',
    align: 'right'
  },
  {
    id: 'income-expenses',
    title: 'Income & Expenses',
    description: 'Categorized cash flow tracking without spreadsheet chaos.',
    align: 'left'
  },
  {
    id: 'accounts',
    title: 'Account Ledgers',
    description: 'Unified balances across bank accounts, petty cash, and cards.',
    align: 'right'
  },
  {
    id: 'clients',
    title: 'Clients',
    description: 'Complete customer directory with contact info and lifetime revenue.',
    align: 'left'
  },
  {
    id: 'assets',
    title: 'Assets',
    description: 'Track internal company property, equipment, and furniture with serials and warranties.',
    align: 'right'
  },
  {
    id: 'stock',
    title: 'Stock',
    description: 'Real-time retail inventory with barcode scanning, reorder alerts, and POS sync.',
    align: 'left',
    badge: 'Available with POS'
  },
  {
    id: 'team',
    title: 'Team & Roles',
    description: 'Granular permissions for cashiers, managers, and accountants.',
    align: 'right'
  },
  {
    id: 'security',
    title: 'Security & Privacy',
    description: 'Bank-grade encryption, biometric passkeys, and privacy blur.',
    align: 'left'
  }
];

export const workflowSteps = [
  { num: '01', title: 'Quote with confidence', icon: 'MdInsertDriveFile' },
  { num: '02', title: 'Bill with a tap', icon: 'MdAutorenew' },
  { num: '03', title: 'Collect and reconcile', icon: 'MdAccountBalanceWallet' },
  { num: '04', title: 'Watch the books balance', icon: 'MdTrendingUp' },
];

export const securityFeatures = [
  'Granular roles and permission controls',
  'Frictionless team invitations',
  'Tamper-evident audit trails',
  'Touch ID & Face ID biometric passkeys',
  'Privacy blur for public environments',
  'Smart notifications and payment reminders',
  'One-click data export to CSV',
  'Bank-grade AES data encryption'
];

export const plans = [
  {
    name: 'Free',
    description: 'Everything you need to get your business off the ground.',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      { label: 'Invoices Limit', value: '50', icon: 'MdCallMade' },
      { label: 'Quotations Limit', value: '50', icon: 'MdCallMade' },
      { label: 'Income Limit', value: '100', icon: 'MdCallMade' },
      { label: 'Expense Limit', value: '100', icon: 'MdCallMade' },
      { label: 'Client Limit', value: '50', icon: 'MdGroup' },
      { label: 'Bank Accounts', value: '2', icon: 'MdAccountBalance' },
      { label: 'Team Members', value: 'No', icon: 'MdGroup' },
      { label: 'Customized Invoices & Quotations', value: 'No', icon: 'MdCheck' },
      { label: 'Customize Workspace Appearance', value: 'No', icon: 'MdCheck' },
      { label: 'Inventory Management', value: 'No', icon: 'MdCheck' },
      { label: 'Advanced Reports', value: 'No', icon: 'MdCheck' },
      { label: 'Invoice Branding', value: 'Framebooks Footer', icon: 'MdCheck' },
      { label: 'Security Level', value: 'Standard', icon: 'MdCheck' },
    ],
    highlight: false,
    badge: null
  },
  {
    name: 'Pro',
    description: 'Uncapped capability for growing businesses and retail counters.',
    monthlyPrice: 2600,
    yearlyPrice: 26000,
    features: [
      { label: 'Invoices Limit', value: 'Unlimited', icon: 'MdCallMade' },
      { label: 'Quotations Limit', value: 'Unlimited', icon: 'MdCallMade' },
      { label: 'Income Limit', value: 'Unlimited', icon: 'MdCallMade' },
      { label: 'Expense Limit', value: 'Unlimited', icon: 'MdCallMade' },
      { label: 'Client Limit', value: 'Unlimited', icon: 'MdGroup' },
      { label: 'Bank Accounts', value: '2', icon: 'MdAccountBalance' },
      { label: 'Team Members', value: 'No', icon: 'MdGroup' },
      { label: 'Customized Invoices & Quotations', value: 'No', icon: 'MdCheck' },
      { label: 'Customize Workspace Appearance', value: 'Yes', icon: 'MdCheck' },
      { label: 'Invoice Watermark', value: 'Removed (Clean)', icon: 'MdCheck' },
      { label: 'Advanced Reports', value: 'Yes', icon: 'MdCheck' },
      { label: 'Security Level', value: 'High + 2FA', icon: 'MdCheck' },
    ],
    highlight: false,
    badge: 'POPULAR'
  },
  {
    name: 'Pro Plus',
    description: 'The ultimate operating system for established businesses and teams.',
    monthlyPrice: 5200,
    yearlyPrice: 52000,
    features: [
      { label: 'Invoices Limit', value: 'Unlimited', icon: 'MdCallMade' },
      { label: 'Quotations Limit', value: 'Unlimited', icon: 'MdCallMade' },
      { label: 'Income Limit', value: 'Unlimited', icon: 'MdCallMade' },
      { label: 'Expense Limit', value: 'Unlimited', icon: 'MdCallMade' },
      { label: 'Client Limit', value: 'Unlimited', icon: 'MdGroup' },
      { label: 'Bank Accounts', value: 'Unlimited', icon: 'MdAccountBalance' },
      { label: 'Team Members', value: 'Unlimited', icon: 'MdGroup' },
      { label: 'Customized Invoices & Quotations', value: 'Yes', icon: 'MdCheck' },
      { label: 'Customize Workspace Appearance', value: 'Yes', icon: 'MdCheck' },
      { label: 'Custom Invoice Layout Builder', value: 'Yes', icon: 'MdCheck' },
      { label: 'Custom Invoice Fields', value: 'Unlimited', icon: 'MdCheck' },
      { label: 'Inventory Management', value: 'Yes', icon: 'MdCheck' },
      { label: 'Advanced Reports', value: 'Yes', icon: 'MdCheck' },
      { label: 'Security Level', value: 'High + Audit Logs', icon: 'MdCheck' },
    ],
    highlight: true,
    badge: null
  }
];

export const posFeatures = [
  {
    title: 'Fast QR and Barcode Scanning',
    description: 'Laser, Bluetooth, or your device camera. Scan any barcode or QR code instantly to keep checkout moving during the biggest rush.',
    icon: 'MdQrCodeScanner',
  },
  {
    title: 'Live Inventory & WooCommerce Sync',
    description: 'Every sale updates inventory across your registers and WooCommerce store in real time. Counter sales and web orders stay in perfect harmony with zero overselling.',
    icon: 'SiWoocommerce',
  },
  {
    title: 'External Printer and Cash Drawer Support',
    description: 'Works with standard thermal printers and cash drawers. Clean typography, customizable headers, and instant drawer kicks.',
    icon: 'MdPrint',
  },
  {
    title: 'Manager PIN protection',
    description: 'Cashiers ring up sales quickly. Special discounts, price overrides, and cash drawer opens require a manager PIN.',
    icon: 'MdLockOutline',
  },
  {
    title: 'Offline Support',
    description: 'Keep ringing up sales even when the internet drops. Transactions queue locally and sync automatically the moment your connection restores.',
    icon: 'MdWifiOff',
    badge: 'Coming Soon',
  },
  {
    title: 'Any screen is your register',
    description: 'Mac, PC, iPad, or smartphone. Ring up sales at the counter, on the shop floor, or on the go with automatic cloud sync.',
    icon: 'MdPhoneIphone',
  },
];

export const comparison = [
  { feature: 'Invoices', free: '50', pro: 'Unlimited', proPlus: 'Unlimited' },
  { feature: 'Quotations', free: '50', pro: 'Unlimited', proPlus: 'Unlimited' },
  { feature: 'Income/Expenses', free: '100 each', pro: 'Unlimited', proPlus: 'Unlimited' },
  { feature: 'Clients', free: '50', pro: 'Unlimited', proPlus: 'Unlimited' },
  { feature: 'Bank Accounts', free: '2', pro: '2', proPlus: 'Unlimited' },
  { feature: 'Team Members', free: 'No', pro: 'No', proPlus: 'Unlimited' },
  { feature: 'Customize Workspace Appearance', free: 'No', pro: 'Yes', proPlus: 'Yes' },
  { feature: 'Customized Invoices & Quotations', free: 'No', pro: 'No', proPlus: 'Yes' },
  { feature: 'Custom Invoice', free: 'No', pro: 'No', proPlus: 'Yes (Bespoke Designer)' },
  { feature: 'Invoice Watermark', free: 'Generated by Framebooks', pro: 'None (Clean)', proPlus: 'None (Clean)' },
  { feature: 'Custom Invoice Fields', free: 'No', pro: 'No', proPlus: 'Unlimited' },
  { feature: 'Inventory Management', free: 'No', pro: 'No', proPlus: 'Yes' },
  { feature: 'Point of Sale (POS) Add-on', free: 'No', pro: 'Available Add-on (LKR 3,000/mo)', proPlus: 'Available Add-on (LKR 3,000/mo)' },
  { feature: 'Advanced Reports', free: 'No', pro: 'Yes', proPlus: 'Yes' },
  { feature: 'Security Level', free: 'Standard', pro: 'High + 2FA', proPlus: 'Max + Audit Logs' },
];

export const faqs = [
  {
    q: 'Who is Framebooks designed for?',
    a: 'Any Sri Lankan business that wants their money, inventory, and sales in one place — retailers, agencies, studios, contractors, and growing brands.'
  },
  {
    q: 'Does it work natively in Sri Lankan Rupees?',
    a: 'Down to the cent. LKR is native across all formatting, ledgers, tax totals, and financial summaries.'
  },
  {
    q: 'How does the Point of Sale work?',
    a: 'It turns any computer, tablet, or phone into a fast checkout register. Scan barcodes, print receipts, open cash drawers, and update inventory live.'
  },
  {
    q: 'Do I need special hardware to use the POS?',
    a: 'None at all. Framebooks works with standard USB and Bluetooth barcode scanners, thermal receipt printers, and cash drawers you already own.'
  },
  {
    q: 'Can I use the POS on mobile phones or tablets?',
    a: 'Yes. Take orders on the sales floor with an iPad or smartphone, scan barcodes using your built-in camera, and close sales anywhere in your store.'
  },
  {
    q: 'How does stock synchronize between the counter and warehouse?',
    a: 'Instantly. The moment an item sells at the counter, stock levels update across all registers and your main inventory dashboard.'
  },
  {
    q: 'Can I track multiple bank accounts?',
    a: 'Yes. Manage multiple commercial bank accounts, petty cash, and cards. Transfer funds between them with full traceability.'
  },
  {
    q: 'How do quotations turn into invoices?',
    a: 'With one click. When a client approves your quote, convert it to an invoice immediately — all line items and pricing carry over automatically.'
  },
  {
    q: 'Can I restrict what my team members see?',
    a: 'Yes. Assign cashiers to register mode only, let your accountant inspect the ledgers, and keep company-level profits reserved for management.'
  },
  {
    q: 'How is my financial data protected?',
    a: 'Bank-grade AES encryption, biometric passkeys (Touch ID and Face ID), daily cloud backups, and private-by-design access controls.'
  },
  {
    q: 'Can I export my data for my accountant or tax filings?',
    a: 'Anytime. Export all transactions, invoices, and ledgers into clean CSV spreadsheets in a single click.'
  },
  {
    q: 'Can I change my plan as my business grows?',
    a: 'Whenever you need to. Upgrade, downgrade, or switch billing cycles anytime with zero lock-in contracts.'
  },
];
