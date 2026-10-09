import { MdOutlineDescription, MdAttachMoney, MdAccountBalance, MdTrendingUp, MdGroup, MdInventory } from 'react-icons/md';

export const jumpLinks = [
  { id: 'how-it-works', label: 'How it works' },
  { id: 'spreadsheets-vs-framebooks', label: 'Spreadsheets vs Framebooks' },
  { id: 'invoice-statuses', label: 'Invoice statuses' },
  { id: 'quotation-to-cash', label: 'Quotation to cash' },
  { id: 'accounts', label: 'Accounts & transfers' },
  { id: 'reports', label: 'Reports' },
  { id: 'plans', label: 'Plans & limits' },
  { id: 'plan-finder', label: 'Plan finder' },
  { id: 'security', label: 'Security' },
];

export const comparisonTable = [
  { feature: 'Creating invoices', spreadsheets: 'Manual numbering, copy-pasting items', framebooks: 'Automatic numbering, saved products & clients' },
  { feature: 'Tracking who has paid', spreadsheets: 'Manual checking against bank statement', framebooks: 'One-click payment recording on the invoice' },
  { feature: 'Overdue reminders at a glance', spreadsheets: 'Requires complex formulas', framebooks: 'Automatic highlighting in the dashboard' },
  { feature: 'Multiple bank accounts', spreadsheets: 'Hard to reconcile transfers between them', framebooks: 'Built-in transfer tracking' },
  { feature: 'Expense categories', spreadsheets: 'Manual tagging and sorting', framebooks: 'Standardised categories for clean reports' },
  { feature: 'Profit & loss and balance sheet', spreadsheets: 'Requires manual calculation', framebooks: 'Generated automatically in real-time' },
  { feature: 'Team roles & permissions', spreadsheets: 'All or nothing access', framebooks: 'Granular access control' },
  { feature: 'Audit trail', spreadsheets: 'No history of who changed what', framebooks: 'Detailed system logs (Pro Plus)' },
  { feature: 'Data export', spreadsheets: 'Always a spreadsheet', framebooks: 'Export to CSV anytime' },
];

export const invoiceStatuses = [
  { status: 'Unpaid', color: 'bg-amber-100 text-amber-800', description: 'The invoice has been sent, but no payment has been recorded yet.', action: 'Wait for payment, or send a reminder.' },
  { status: 'Partially Paid', color: 'bg-blue-100 text-blue-800', description: 'The client has paid a portion of the total amount.', action: 'Record the remaining payment when it arrives.' },
  { status: 'Fully Paid', color: 'bg-green-100 text-green-800', description: 'The full amount has been received.', action: 'No further action needed.' },
  { status: 'Advance-Paid', color: 'bg-purple-100 text-purple-800', description: 'The client paid before the invoice was finalized.', action: 'Apply the advance payment to the invoice.' },
  { status: 'On Review', color: 'bg-gray-100 text-gray-800', description: 'The invoice is drafted and waiting for approval.', action: 'Review and send to the client.' },
  { status: 'Overdue', color: 'bg-red-100 text-red-800', description: 'The due date has passed and payment is missing.', action: 'Follow up with the client immediately.' },
];

export const quotationTimeline = [
  { step: 1, title: 'Draft Quotation', status: 'Draft', description: 'Create a quote with your proposed services and pricing.' },
  { step: 2, title: 'Send to Client', status: 'Sent', description: 'Email or share the quote link with your client.' },
  { step: 3, title: 'Client Decides', status: 'Accepted / Rejected', description: 'The client reviews and either accepts or declines.' },
  { step: 4, title: 'Convert to Invoice', status: 'Invoiced', description: 'Turn the accepted quote directly into an invoice.' },
  { step: 5, title: 'Get Paid', status: 'Fully Paid', description: 'Record the income when the money hits your bank.' },
];

export const reportTabs = [
  { id: 'overview', label: 'Overview', title: 'A bird\'s-eye view of your business.', description: 'The Overview gives you a quick snapshot of your financial health, combining your key metrics like total income, expenses, and net profit.', whenToUse: 'Check this daily or weekly to keep your finger on the pulse of your business.' },
  { id: 'profit-loss', label: 'Profit & Loss', title: 'Are you making money?', description: 'This report summarizes your revenues, costs, and expenses incurred during a specific period. It tells you your bottom line.', whenToUse: 'Use this at the end of every month or quarter to see if your business is profitable.' },
  { id: 'cash-flow', label: 'Cash Flow', title: 'Where is your money going?', description: 'Tracks the flow of cash in and out of your business. It shows how changes in balance sheet accounts and income affect cash.', whenToUse: 'Crucial for ensuring you have enough cash on hand to pay bills and payroll.' },
  { id: 'balance-sheet', label: 'Balance Sheet', title: 'Your business net worth.', description: 'A snapshot of your assets, liabilities, and equity at a specific point in time.', whenToUse: 'Often required by banks for loans, or used by accountants at year-end.' },
  { id: 'tax-summary', label: 'Tax Summary', title: 'Get ready for tax season.', description: 'Calculates the estimated taxes you owe based on your income and deductible expenses.', whenToUse: 'Review this before filing your taxes to ensure you have set aside enough funds.' },
  { id: 'trial-balance', label: 'Trial Balance', title: 'Ensure your books balance.', description: 'A list of all your general ledger accounts and their balances (debits and credits).', whenToUse: 'Used primarily by accountants to catch errors before producing financial statements.' },
  { id: 'general-ledger', label: 'General Ledger', title: 'The master record.', description: 'The complete record of all financial transactions over the life of your company.', whenToUse: 'When you need to dig deep into the details of specific transactions.' },
  { id: 'account-ledger', label: 'Account Ledger', title: 'Focus on one account.', description: 'Shows the transaction history for a single specific account (e.g., a specific bank account).', whenToUse: 'Use this when reconciling a specific bank statement.' },
];

export const planLimitsDisplay = [
  { name: 'Free', target: 'For freelancers starting out', limits: ['50 Invoices', '100 Income / 100 Expenses', '50 Clients', '2 Bank Accounts', 'No Inventory', 'Standard Reports', 'Standard Security'] },
  { name: 'Pro', target: 'For growing businesses', limits: ['Unlimited Invoices', 'Unlimited Income / Expenses', 'Unlimited Clients', '2 Bank Accounts', 'No Inventory', 'Advanced Reports', '2FA Security'] },
  { name: 'Pro Plus', target: 'For power users and teams', limits: ['Unlimited Everything', 'Unlimited Bank Accounts', 'Unlimited Team Members', 'Inventory Management', 'Advanced Reports', 'Audit Logs'] },
];
