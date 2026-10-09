export const navigation = [
  { name: 'Features', href: '/#features' },
  { name: 'Pricing', href: '/#pricing' },
  { name: 'Guide', href: '/guide' },
  { name: 'FAQ', href: '/#faq' },
  { name: 'Contact', href: '/#contact' },
];

export const kpis = [
  { label: 'Modules', value: '10' },
  { label: 'LKR-first', value: 'accounting' },
  { label: 'Financial reports', value: '8' },
  { label: 'Encrypted data', value: '100%' },
];

export const features = [
  { title: 'Income tracking', description: 'Log all revenue streams with linked invoices.', icon: 'MdCallReceived' },
  { title: 'Expense tracking', description: 'Categorise and record spending by account.', icon: 'MdCallMade' },
  { title: 'Multi-account banking', description: 'Manage multiple bank and cash accounts seamlessly.', icon: 'MdAccountBalance' },
  { title: 'Invoicing', description: 'Create, send, and track professional invoices.', icon: 'MdInsertDriveFile' },
  { title: 'Quotations', description: 'Send estimates and convert them to invoices.', icon: 'MdInsertDriveFile' },
  { title: 'Client management', description: 'Keep a directory of your clients and their revenue.', icon: 'MdGroup' },
  { title: 'Inventory', description: 'Track items and estimated values (Pro Plus).', icon: 'MdInventory' },
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
    title: 'Accounts',
    benefits: ['Maintain multiple bank and cash accounts.', 'Track real-time inflow, outflow, and balances.', 'Transfer cash between accounts securely.'],
    align: 'left'
  },
  {
    id: 'clients',
    title: 'Clients',
    benefits: ['Store contact details and track lifetime revenue.', 'See who your top clients are instantly.', 'Manage active and inactive client statuses.'],
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
    title: 'Security & Logs',
    benefits: ['Review comprehensive system audit logs.', 'Protect accounts with two-factor authentication.', 'Data is secured with end-to-end encryption.'],
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
  'Team Settings',
  'Audit Logs',
  'App lock',
  'Two-factor authentication',
  'Data Export to CSV',
  'End-to-end encryption'
];

export const plans = [
  {
    name: 'Free',
    description: 'Get started for free to explore the product',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      { label: 'Invoices Limit', value: '50', icon: 'MdCallMade' },
      { label: 'Income Limit', value: '100', icon: 'MdCallMade' },
      { label: 'Expense Limit', value: '100', icon: 'MdCallMade' },
      { label: 'Client Limit', value: '50', icon: 'MdGroup' },
      { label: 'Bank Accounts', value: '2', icon: 'MdAccountBalance' },
      { label: 'Team Members', value: 'No', icon: 'MdGroup' },
      { label: 'Inventory Management', value: 'No', icon: 'MdCheck' },
      { label: 'Advanced Reports', value: 'No', icon: 'MdCheck' },
      { label: 'Security Level', value: 'Standard', icon: 'MdCheck' },
    ],
    highlight: false,
    badge: null
  },
  {
    name: 'Pro',
    description: 'Advanced tools to manage finances and grow faster.',
    monthlyPrice: 2500,
    yearlyPrice: 25000,
    features: [
      { label: 'Invoices Limit', value: 'Unlimited', icon: 'MdCallMade' },
      { label: 'Income Limit', value: 'Unlimited', icon: 'MdCallMade' },
      { label: 'Expense Limit', value: 'Unlimited', icon: 'MdCallMade' },
      { label: 'Client Limit', value: 'Unlimited', icon: 'MdGroup' },
      { label: 'Bank Accounts', value: '2', icon: 'MdAccountBalance' },
      { label: 'Team Members', value: 'No', icon: 'MdGroup' },
      { label: 'Inventory Management', value: 'No', icon: 'MdCheck' },
      { label: 'Advanced Reports', value: 'Yes', icon: 'MdCheck' },
      { label: 'Security Level', value: 'High + 2FA', icon: 'MdCheck' },
    ],
    highlight: false,
    badge: 'POPULAR'
  },
  {
    name: 'Pro Plus',
    description: 'For Power Users and large teams',
    monthlyPrice: 5000,
    yearlyPrice: 50000,
    features: [
      { label: 'Invoices Limit', value: 'Unlimited', icon: 'MdCallMade' },
      { label: 'Income Limit', value: 'Unlimited', icon: 'MdCallMade' },
      { label: 'Expense Limit', value: 'Unlimited', icon: 'MdCallMade' },
      { label: 'Client Limit', value: 'Unlimited', icon: 'MdGroup' },
      { label: 'Bank Accounts', value: 'Unlimited', icon: 'MdAccountBalance' },
      { label: 'Team Members', value: 'Unlimited', icon: 'MdGroup' },
      { label: 'Inventory Management', value: 'Yes', icon: 'MdCheck' },
      { label: 'Advanced Reports', value: 'Yes', icon: 'MdCheck' },
      { label: 'Security Level', value: 'High + Audit Logs', icon: 'MdCheck' },
    ],
    highlight: true,
    badge: null
  }
];

export const comparison = [
  { feature: 'Invoices', free: '50', pro: 'Unlimited', proPlus: 'Unlimited' },
  { feature: 'Income/Expenses', free: '100 each', pro: 'Unlimited', proPlus: 'Unlimited' },
  { feature: 'Clients', free: '50', pro: 'Unlimited', proPlus: 'Unlimited' },
  { feature: 'Bank Accounts', free: '2', pro: '2', proPlus: 'Unlimited' },
  { feature: 'Team Members', free: 'No', pro: 'No', proPlus: 'Unlimited' },
  { feature: 'Inventory Management', free: 'No', pro: 'No', proPlus: 'Yes' },
  { feature: 'Advanced Reports', free: 'No', pro: 'Yes', proPlus: 'Yes' },
  { feature: 'Security Level', free: 'Standard', pro: 'High + 2FA', proPlus: 'Max + Audit Logs' },
];

export const faqs = [
  { q: 'Who is Framebooks for?', a: 'Framebooks is built specifically for small businesses, agencies, and freelancers in Sri Lanka looking for an all-in-one financial dashboard.' },
  { q: 'Does it work in LKR?', a: 'Yes! Framebooks is LKR-first, meaning all formatting, reports, and currency displays are natively designed for Sri Lankan Rupees.' },
  { q: 'Can I manage multiple bank accounts?', a: 'Absolutely. You can track multiple bank accounts, petty cash, and even transfer funds between them with full history.' },
  { q: 'How do quotations become invoices?', a: 'Once a client accepts a quote, you can convert it to an invoice with a single click, carrying over all line items and details automatically.' },
  { q: 'Can my team have different permissions?', a: 'Yes, our Roles & Permissions feature allows you to customize exactly what each team member can see and edit.' },
  { q: 'Is my data safe?', a: 'Your data stays secure with end-to-end encryption, regular backups, and features like two-factor authentication on higher plans.' },
  { q: 'Can I export my data?', a: 'You can export all your financial data to CSV at any time for your accountant or your own records.' },
  { q: 'Can I upgrade or downgrade later?', a: 'Of course! You can change your plan at any time to fit your growing business needs.' },
];
