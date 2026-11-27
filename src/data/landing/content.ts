export const navigation = [
  { name: 'Features', href: '/#features' },
  { name: 'POS', href: '/#pos' },
  { name: 'Pricing', href: '/#pricing' },
  { name: 'Guide', href: '/guide' },
  { name: 'FAQ', href: '/#faq' },
  { name: 'Contact', href: '/#contact' },
];

export const footerProductLinks = [
  { name: 'Features', href: '/#features' },
  { name: 'POS', href: '/#pos' },
  { name: 'Pricing', href: '/#pricing' },
  { name: 'Guide', href: '/guide' },
];

export const footerLegalLinks = [
  { name: 'Privacy Policy', href: '#' },
  { name: 'Terms of Service', href: '#' },
  { name: 'Cookie Policy', href: '#' },
  { name: 'Refund Policy', href: '#' },
];

export const kpis = [
  { label: 'Modules', value: '11' },
  { label: 'Retail & POS', value: 'High-speed' },
  { label: 'LKR-first', value: 'accounting' },
  { label: 'Data encryption', value: 'Bank-grade' },
];

export const features = [
  { title: 'Income tracking', description: 'Log all revenue streams with linked invoices.', icon: 'MdCallReceived' },
  { title: 'Expense tracking', description: 'Categorise and record spending by account.', icon: 'MdCallMade' },
  { title: 'Multi-account banking', description: 'Manage multiple bank and cash accounts seamlessly.', icon: 'MdAccountBalance' },
  { title: 'Invoicing', description: 'Create, send, and track professional invoices.', icon: 'MdInsertDriveFile' },
  { title: 'Quotations', description: 'Send estimates and convert them to invoices.', icon: 'MdInsertDriveFile' },
  { title: 'Client management', description: 'Keep a directory of your clients and their revenue.', icon: 'MdGroup' },
  { title: 'Inventory', description: 'Track items and estimated values (Pro Plus).', icon: 'MdInventory' },
  { title: 'Point of Sale (POS)', description: 'Rapid barcode scanning, stock sync, receipts & drawer.', icon: 'MdPointOfSale' },
  { title: 'Financial reports', description: 'Get insights from P&L, Cash Flow, and more.', icon: 'MdTrendingUp' },
];

export const modulesData = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    benefits: ['Monitor KPI cards like Total Income and Net Profit.', 'Visualize Income vs Expenses over time.', 'Quickly access recent invoices and quotations.'],
    align: 'left'
  },
  {
    id: 'invoices',
    title: 'Invoices',
    benefits: ['Create, send, and download invoices in seconds.', 'Track payment statuses like Fully Paid or Overdue.', 'Highlight overdue dates automatically.'],
    align: 'right'
  },
  {
    id: 'quotations',
    title: 'Quotations',
    benefits: ['Draft and send quotes to potential clients.', 'Filter by service categories like Web dev or Photography.', 'Convert accepted quotes into invoices instantly.'],
    align: 'left'
  },
  {
    id: 'income-expenses',
    title: 'Income & Expenses',
    benefits: ['Record transactions against clients and accounts.', 'Tag entries with categories for accurate reporting.', 'Compare this month to last month at a glance.'],
    align: 'right'
  },
  {
    id: 'accounts',
    title: 'Account Ledgers',
    benefits: ['Maintain multiple bank and cash accounts with one-click bank detail sharing.', 'Track real-time inflow, outflow, net debt, and account balances.', 'Manage dual-direction debts (receivables & payables) without skewing P&L.'],
    align: 'left'
  },
  {
    id: 'clients',
    title: 'Clients',
    benefits: ['Store contact details and track lifetime revenue.', 'See who your top clients are instantly.', 'Manage active and inactive client statuses with field-level encryption.'],
    align: 'right'
  },
  {
    id: 'inventory',
    title: 'Inventory',
    benefits: ['Maintain an itemized list of your products.', 'Track available quantities and estimated value.', 'Exclusive to our Pro Plus plan.'],
    align: 'left'
  },
  {
    id: 'team',
    title: 'Team & Roles',
    benefits: ['Invite unlimited team members on higher plans.', 'Assign fine-grained custom roles and permissions.', 'Collaborate without sharing passwords.'],
    align: 'right'
  },
  {
    id: 'security',
    title: 'Security & Privacy',
    benefits: ['Bank-grade data encryption for sensitive client and banking details.', 'Hardware-backed biometric passkeys (Touch ID / Face ID) and app lock PIN.', 'Privacy blur mode for public spaces and comprehensive system audit logs.'],
    align: 'left'
  }
];

export const workflowSteps = [
  { num: '01', title: 'Send a quotation', icon: 'MdInsertDriveFile' },
  { num: '02', title: 'Convert it to an invoice', icon: 'MdAutorenew' },
  { num: '03', title: 'Record the payment against your account', icon: 'MdAccountBalanceWallet' },
  { num: '04', title: 'See it in your reports', icon: 'MdTrendingUp' },
];

export const securityFeatures = [
  'Roles & Permissions (custom roles)',
  'Team Settings & Invitations',
  'Audit Logs & Traceability',
  'App Lock & Biometric Passkeys',
  'Privacy Blur Mode',
  'Push Notifications & Financial Reminders',
  'Data Export to CSV',
  'Bank-Grade Data Encryption'
];

export const plans = [
  {
    name: 'Free',
    description: 'Get started for free to explore the product',
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
    description: 'Advanced tools to manage finances and grow faster.',
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
    description: 'For Power Users and large teams',
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
    title: 'Fast Barcode & QR Scanning',
    description: 'Scan items in seconds with your phone camera or any handheld USB and Bluetooth barcode scanner to keep checkout lines moving fast.',
    icon: 'MdQrCodeScanner',
  },
  {
    title: 'Real-Time Stock Tracking',
    description: 'Stock quantities sync automatically with every sale, preventing stockouts and keeping your counter shelves and catalog accurate.',
    icon: 'MdInventory',
  },
  {
    title: 'Receipt Printing & Cash Drawers',
    description: 'Print clean customer receipts on standard 80mm or 58mm thermal printers and automatically pop open your cash drawer when payment completes.',
    icon: 'MdPrint',
  },
  {
    title: 'Cashier Controls & Manager PIN',
    description: 'Protect your business with role permissions. Staff can ring up sales, while applying custom discounts requires a manager PIN code.',
    icon: 'MdLockOutline',
  },
  {
    title: 'Flexible Discounts & Offers',
    description: 'Apply percentage or fixed-amount discounts, run product bundle deals, and track walk-in or saved customers with clear price breakdowns.',
    icon: 'MdLocalOffer',
  },
  {
    title: 'Sell on Mobile, Tablet & PC',
    description: 'Take orders from your counter desktop, a tablet, or your phone on the retail floor. Complete sales anywhere with instant cloud sync.',
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
  { q: 'Who is Framebooks for?', a: 'Framebooks is built specifically for small businesses, agencies, and freelancers in Sri Lanka looking for an all-in-one financial dashboard.' },
  { q: 'Does it work in LKR?', a: 'Yes! Framebooks is LKR-first, meaning all formatting, reports, and currency displays are natively designed for Sri Lankan Rupees.' },
  { q: 'Does Framebooks have a POS System?', a: 'Yes! Framebooks includes an easy-to-use, fast POS terminal for retail counters. Scan barcodes with a camera or scanner, print thermal customer receipts, open cash drawers, apply discounts with manager PIN approval, and track sales live.' },
  { q: 'Can I use the POS on mobile phones or tablets?', a: 'Yes. The POS is fully mobile-responsive. You can take orders on the sales floor with a phone or tablet, scan barcodes using your device camera, and complete transactions anywhere in your store.' },
  { q: 'How does POS stock synchronization work?', a: 'Your physical stock counts update automatically in real time with every sale. When an item is sold at the register, stock quantities immediately update across all registers and your stock dashboard to prevent overselling.' },
  { q: 'Can I manage multiple bank accounts?', a: 'Absolutely. You can track multiple bank accounts, petty cash, and even transfer funds between them with full history.' },
  { q: 'How do quotations become invoices?', a: 'Once a client accepts a quote, you can convert it to an invoice with a single click, carrying over all line items and details automatically.' },
  { q: 'Can my team have different permissions?', a: 'Yes, our Roles & Permissions feature allows you to customize exactly what each team member can see and edit.' },
  { q: 'Is my data safe?', a: 'Your data stays secure with enterprise-grade encryption in transit and at rest, regular backups, and features like two-factor authentication on higher plans.' },
  { q: 'Can I export my data?', a: 'You can export all your financial data to CSV at any time for your accountant or your own records.' },
  { q: 'Can I upgrade or downgrade later?', a: 'Of course! You can change your plan at any time to fit your growing business needs.' },
  { q: 'What hardware do I need to use the POS?', a: 'You can use any laptop, tablet, or smartphone. Framebooks POS works with standard USB and Bluetooth barcode scanners, 80mm and 58mm thermal receipt printers, and cash drawers without needing expensive proprietary equipment.' },
];
