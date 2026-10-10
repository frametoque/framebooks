export interface GuideStep {
  title: string;
  content: string;
  bullets?: string[];
}

export interface GuideArticle {
  slug: string;
  title: string;
  intro: string;
  plan?: 'Free' | 'Pro' | 'Pro Plus';
  readTime: string;
  steps: GuideStep[];
}

export interface GuideGroup {
  id: string;
  title: string;
  articles: GuideArticle[];
}

export const guideGroups: GuideGroup[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    articles: [
      {
        slug: 'welcome',
        title: 'Welcome to Framebooks',
        intro: 'Framebooks is an all-in-one cloud financial operating system and ERP built specifically for Sri Lankan businesses. Here is an overview of the platform structure and navigation.',
        readTime: '3 min read',
        steps: [
          {
            title: 'The Navigation Sidebar',
            content: 'The left sidebar is your command center. Quickly switch between your Dashboard, Invoices, Quotations, Income, Expenses, Bank Accounts, Clients, Inventory, Reports, and System Settings.',
            bullets: [
              'Click any module to access its records and actions instantly',
              'Collapse the sidebar on smaller screens to maximize working room',
              'Quickly navigate between accounting statements and daily logs'
            ]
          },
          {
            title: 'Top Status Bar & Live Clock',
            content: 'The header shows the current local time (Colombo time), live date, business name, and quick profile status.',
            bullets: [
              'Displays current authenticated role (Owner, Admin, Member)',
              'Provides quick one-click shortcuts to workspace settings',
              'Notification center for updates and team invitations'
            ]
          },
          {
            title: 'LKR-First Financial Architecture',
            content: 'Framebooks is designed from the ground up for Sri Lanka. All currencies, exchange rates, and financial reports are calculated in Sri Lankan Rupees (LKR) with standard formatting.',
            bullets: [
              'Automatic formatting for thousand and million separators (LKR)',
              'Standard Sri Lankan tax calculation formats',
              'Support for all major local bank accounts (BOC, Commercial Bank, Sampath, HNB, Nations Trust, etc.)'
            ]
          }
        ]
      },
      {
        slug: 'create-account',
        title: 'Account Setup & Business Profile',
        intro: 'Set up your business credentials, company profile, official address, and branding in just a few minutes.',
        readTime: '3 min read',
        steps: [
          {
            title: 'Authentication & Sign Up',
            content: 'Sign up securely with your Google account or modern biometric passkey. Framebooks supports passwordless login with Touch ID, Face ID, and security keys.',
            bullets: [
              'Instant account provisioning with OAuth 2.0',
              'Automatic organization workspace creation'
            ]
          },
          {
            title: 'Business Information Profile',
            content: 'Head to Settings > Profile to fill in your company branding. This information appears automatically on all generated invoices, quotations, and official receipts.',
            bullets: [
              'Company legal name and trading name',
              'Official business registration number (BR / PV)',
              'Contact email, phone number, and physical billing address',
              'Custom company logo upload for branded PDFs'
            ]
          },
          {
            title: 'Default Financial Preferences',
            content: 'Configure your default invoice payment terms, tax rate (VAT / SSCL), and standard note templates.',
            bullets: [
              'Default payment due period (e.g. 7 days, 14 days, 30 days)',
              'Default bank account pre-selected for incoming client transfers'
            ]
          }
        ]
      },
      {
        slug: 'add-accounts',
        title: 'Setting Up Bank, Cash & Card Accounts',
        intro: 'Set up the accounts where your business funds actually reside so you can track real-time balances and transfers.',
        readTime: '3 min read',
        steps: [
          {
            title: 'Types of Accounts Supported',
            content: 'Framebooks lets you track Bank Current Accounts, Savings Accounts, Cash Registers/Petty Cash, and Corporate Credit Cards.',
            bullets: [
              'Bank Accounts: Link your commercial accounts with account number and branch',
              'Cash Accounts: Track physical cash in hand, office safe, or petty cash box',
              'Card Accounts: Monitor corporate credit and debit card spending'
            ]
          },
          {
            title: 'Adding a New Account',
            content: 'Navigate to Accounts from the sidebar and click "New Account". Enter the account title, institution, starting balance, and currency.',
            bullets: [
              'Set accurate opening balances so your Balance Sheet matches bank statements',
              'Assign a primary account for automatic client payment settlement'
            ]
          },
          {
            title: 'Account Balances & Reconciliation',
            content: 'Every time an invoice is marked paid or an expense is recorded, the respective account balance updates immediately in real time.',
            bullets: [
              'View transaction histories for each individual account ledger',
              'Filter by deposits, withdrawals, and internal transfers'
            ]
          }
        ]
      },
      {
        slug: 'add-client',
        title: 'Adding Clients & Managing Directory',
        intro: 'Build your client directory to send professional estimates, issue invoices, and track revenue per customer.',
        readTime: '3 min read',
        steps: [
          {
            title: 'Client Information Fields',
            content: 'Go to Clients > "New Client". You can record individual freelancers, local SMEs, or corporate clients.',
            bullets: [
              'Client Name & Company Name',
              'Primary billing email & secondary contacts',
              'Phone number & billing address'
            ]
          },
          {
            title: 'Client Financial Dashboard',
            content: 'Each client page gives you an instant breakdown of total revenue generated, unpaid invoices, and lifetime quotation acceptance rates.',
            bullets: [
              'View outstanding balance owed across all invoices',
              'One-click action to create a new quotation or invoice for this client',
              'Full historical ledger of past transactions'
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'sales-invoicing',
    title: 'Sales & Invoicing',
    articles: [
      {
        slug: 'quotations',
        title: 'Creating Quotes & Estimates',
        intro: 'Send estimates with custom line items, discounts, and terms, then convert them directly into invoices with one click.',
        readTime: '4 min read',
        steps: [
          {
            title: 'Drafting a New Quotation',
            content: 'Navigate to Quotations and click "New Quotation". Choose an existing client or enter a new customer immediately.',
            bullets: [
              'Set quotation issue date and expiration date (Valid Until)',
              'Add line items with descriptions, quantities, unit prices, and discounts',
              'Automatic LKR subtotal, tax calculation, and grand total'
            ]
          },
          {
            title: 'Sharing Quotes with Clients',
            content: 'Download high-resolution PDF quotes with your company letterhead or share direct links with clients.',
            bullets: [
              'Professional typography and layout tailored for corporate buyers',
              'Includes terms, conditions, and payment expectations'
            ]
          },
          {
            title: 'One-Click Conversion to Invoice',
            content: 'When your client approves the estimate, open the quote and click "Convert to Invoice". Framebooks automatically generates an invoice with matching line items and values.',
            bullets: [
              'Prevents double-entry errors and saves time',
              'Marks the quotation as "Invoiced" for complete auditability'
            ]
          }
        ]
      },
      {
        slug: 'quotation-timeline',
        title: 'Quotation to Cash: 5-Step Workflow',
        intro: 'How the end-to-end sales lifecycle works in Framebooks—from the first customer inquiry to money in the bank.',
        readTime: '3 min read',
        steps: [
          {
            title: 'Step 1: Draft Quotation',
            content: 'Build the estimate with proposed services, timeline, and itemized prices.'
          },
          {
            title: 'Step 2: Send to Client',
            content: 'Share the quotation PDF or digital proposal link. The status updates to "Sent".'
          },
          {
            title: 'Step 3: Client Decision',
            content: 'The customer reviews and accepts your estimate. Status moves to "Accepted".'
          },
          {
            title: 'Step 4: Convert to Invoice',
            content: 'Convert into an active invoice with one click. Automatic invoice number assigned.'
          },
          {
            title: 'Step 5: Payment Recorded & Cash Settled',
            content: 'Customer pays via bank transfer or card. Settle against your bank account; revenue reflects in P&L.'
          }
        ]
      },
      {
        slug: 'invoices',
        title: 'Invoicing, PDF Generation & Payments',
        intro: 'Create compliant invoices, apply discounts, set due dates, and record payments with zero friction.',
        readTime: '5 min read',
        steps: [
          {
            title: 'Creating an Invoice',
            content: 'Go to Invoices > "New Invoice". Select your client, issue date, and due date.',
            bullets: [
              'Automatic consecutive invoice numbering (e.g. INV-1042)',
              'Add multiple line items or pull saved items from Inventory (Pro Plus)',
              'Apply overall discounts (percentage or fixed LKR)',
              'Add custom bank transfer instructions and payment details'
            ]
          },
          {
            title: 'Recording Payments',
            content: 'When payment arrives, open the invoice and click "Record Payment". Select the destination bank account and payment method.',
            bullets: [
              'Supports full settlement or partial payments',
              'Automatically logs an linked Income transaction under Income tracking',
              'Updates your available bank funds in real time'
            ]
          },
          {
            title: 'PDF Generation & Download',
            content: 'Framebooks produces crisp, vector-grade PDF invoices formatted for print and digital dispatch with full company metadata and terms.',
            bullets: [
              'Embedded QR codes and payment instructions',
              'Consistent branding with your uploaded business logo'
            ]
          }
        ]
      },
      {
        slug: 'invoice-statuses',
        title: 'Complete Guide to Invoice Statuses',
        intro: 'Understand how Framebooks tracks invoice lifecycles—from draft review to full settlement and overdue alerts.',
        readTime: '3 min read',
        steps: [
          {
            title: 'Draft / On Review',
            content: 'Invoice has been prepared but not yet finalized or sent to the customer. No financial impact on your P&L yet.'
          },
          {
            title: 'Unpaid / Sent',
            content: 'The invoice is active and in the customer\'s hands. Outstanding balance appears in Accounts Receivable.'
          },
          {
            title: 'Partially Paid',
            content: 'The client made an initial advance or partial payment. The remaining balance remains tracked as due.'
          },
          {
            title: 'Fully Paid',
            content: 'The entire invoice total has been received and reconciled. Closed and logged in financial statements.'
          },
          {
            title: 'Advance-Paid',
            content: 'Payment was collected prior to invoice finalization. The payment credit is applied cleanly.'
          },
          {
            title: 'Overdue',
            content: 'The due date has elapsed without complete payment. Highlighted in red across dashboard and invoice lists.'
          }
        ]
      }
    ]
  },
  {
    id: 'money-tracking',
    title: 'Income, Expenses & Accounts',
    articles: [
      {
        slug: 'income',
        title: 'Recording & Categorizing Income',
        intro: 'Track all revenue streams—both invoice-linked payments and direct sales revenue.',
        readTime: '3 min read',
        steps: [
          {
            title: 'Invoice-Linked Income vs. Direct Income',
            content: 'When an invoice is paid, Framebooks records income automatically. You can also manually log direct income (consulting fees, cash sales, interest).',
            bullets: [
              'Categorize income by service, product line, or business division',
              'Specify which bank or cash account received the money'
            ]
          },
          {
            title: 'Income Analytics & Trends',
            content: 'Review revenue performance over custom date ranges. Filter by client, payment channel, or service category.'
          }
        ]
      },
      {
        slug: 'expenses',
        title: 'Expense Tracking & Categorization',
        intro: 'Record every rupee spent, assign categories, and maintain deductible expense records for tax season.',
        readTime: '4 min read',
        steps: [
          {
            title: 'Logging a Business Expense',
            content: 'Go to Expenses > "New Expense". Enter amount, date, vendor, category, and source account.',
            bullets: [
              'Standard Sri Lankan expense categories (Rent, Utilities, Software, Payroll, Travel, Supplies)',
              'Mark whether the expense is tax-deductible',
              'Attach notes or reference voucher numbers'
            ]
          },
          {
            title: 'Expense Breakdown Chart',
            content: 'The dashboard visually groups your expenses into a categorized breakdown chart so you can immediately see where your money goes.'
          }
        ]
      },
      {
        slug: 'accounts-transfers',
        title: 'Multi-Account Transfers & Balance Reconciliation',
        intro: 'Move money between your bank accounts and cash drawers without skewing your profit and loss.',
        readTime: '3 min read',
        steps: [
          {
            title: 'Why Use Transfers Instead of Income/Expense?',
            content: 'Transferring funds from your Commercial Bank account to Petty Cash is not an expense—it is simply moving assets. Transfers update account balances without altering Net Profit.',
            bullets: [
              'Preserves accuracy of your Profit & Loss statement',
              'Prevents artificial inflation of revenue or expense totals'
            ]
          },
          {
            title: 'Executing a Transfer',
            content: 'Go to Accounts > "Transfer Money". Pick the "From Account", the "To Account", date, and amount.',
            bullets: [
              'Both account ledgers update synchronously',
              'Add transfer notes (e.g. "ATM withdrawal for petty cash float")'
            ]
          }
        ]
      },
      {
        slug: 'clients-management',
        title: 'Client Management & Lifetime Value',
        intro: 'Track who owes you money, customer revenue history, and manage outstanding debt proactively.',
        readTime: '3 min read',
        steps: [
          {
            title: 'Client Ledger & Outstanding Receivables',
            content: 'View each client\'s transaction history to see unpaid invoices and historical receipts.',
            bullets: [
              'Instantly spot overdue accounts that require payment reminders',
              'Export customer statements to CSV or PDF'
            ]
          },
          {
            title: 'Customer Lifetime Value (LTV)',
            content: 'Discover your most profitable accounts by sorting clients by total revenue generated.'
          }
        ]
      }
    ]
  },
  {
    id: 'inventory-module',
    title: 'Inventory & Products',
    articles: [
      {
        slug: 'inventory',
        title: 'Inventory Management & Valuation',
        intro: 'Track product stock, unit cost prices, selling rates, and real-time inventory valuation for your business.',
        plan: 'Pro Plus',
        readTime: '4 min read',
        steps: [
          {
            title: 'Adding Inventory Items',
            content: 'Go to Inventory > "New Item". Add your SKU, item title, unit cost price, and default selling price.',
            bullets: [
              'Stock count tracking (Quantity on Hand)',
              'Unit classification (pieces, boxes, hours, kg, units)',
              'Cost Price vs Selling Price calculation for gross margin insights'
            ]
          },
          {
            title: 'Stock Adjustments & Restocking',
            content: 'When new stock arrives from suppliers, adjust item quantities to keep numbers up to date.',
            bullets: [
              'Log supplier purchase costs to update average unit cost',
              'Stock audit count reconciliation'
            ]
          },
          {
            title: 'Inventory Asset Valuation on Balance Sheet',
            content: 'The total value of your stock on hand is automatically computed and reflected as a Current Asset on your Balance Sheet.'
          }
        ]
      }
    ]
  },
  {
    id: 'financial-reports',
    title: 'Reports & Statements',
    articles: [
      {
        slug: 'reports-overview',
        title: 'Financial Reports Hub & Date Filtering',
        intro: 'Understand the eight financial reports provided in Framebooks and how to use the fiscal year date picker.',
        readTime: '3 min read',
        steps: [
          {
            title: 'The Period Selector',
            content: 'At the top of the Reports page, use the date selector to filter statements by Fiscal Year, Current Quarter, Month, or Custom Date Range.',
            bullets: [
              'Standard Sri Lankan fiscal year (April 1 to March 31) or calendar year',
              'Instant recalculation across all 8 statements'
            ]
          },
          {
            title: 'The Eight Report Statements',
            content: 'Framebooks includes 8 distinct financial statements for owners, auditors, and accountants:',
            bullets: [
              '1. Executive Financial Overview',
              '2. Profit & Loss Statement (P&L)',
              '3. Cash Flow Statement',
              '4. Balance Sheet',
              '5. Tax Summary & Deductions',
              '6. Trial Balance',
              '7. General Ledger',
              '8. Individual Account Ledger'
            ]
          }
        ]
      },
      {
        slug: 'profit-loss',
        title: 'Profit & Loss Statement (P&L)',
        intro: 'Measure true operational profitability by comparing recognized revenue against categorized operational costs.',
        readTime: '4 min read',
        steps: [
          {
            title: 'Understanding Your P&L',
            content: 'The Profit & Loss statement calculates Gross Revenue, Cost of Sales, Operating Expenses, and Net Profit.',
            bullets: [
              'Total Operating Income: Sum of all invoices and revenue items',
              'Categorized Operating Expenses: Itemized by category (rent, payroll, utilities)',
              'Net Profit / Net Margin: The bottom line indicating whether the company is profitable'
            ]
          },
          {
            title: 'Sharing with Stakeholders',
            content: 'Download clean P&L summaries to share with partners, shareholders, or bank loan officers.'
          }
        ]
      },
      {
        slug: 'cash-flow',
        title: 'Cash Flow Statement',
        intro: 'Track the physical movement of money into and out of your business to ensure adequate liquidity.',
        readTime: '4 min read',
        steps: [
          {
            title: 'Cash Flow vs. Profit',
            content: 'A business can be profitable on paper while still running out of cash if clients pay late. The Cash Flow Statement tracks actual liquid cash.',
            bullets: [
              'Operating Cash Inflows: Actual money collected from customers',
              'Operating Cash Outflows: Actual money paid out for expenses and bills',
              'Net Cash Position: Change in cash reserves over the selected period'
            ]
          }
        ]
      },
      {
        slug: 'balance-sheet',
        title: 'Balance Sheet & Net Worth',
        intro: 'A snapshot of everything your business owns (Assets), owes (Liabilities), and Equity.',
        readTime: '4 min read',
        steps: [
          {
            title: 'Assets',
            content: 'Includes Liquid Bank Balances, Petty Cash in hand, Outstanding Accounts Receivable (Unpaid Invoices), and Inventory Value.'
          },
          {
            title: 'Liabilities & Equity',
            content: 'Reflects outstanding obligations, owner capital contributions, and retained earnings.'
          }
        ]
      },
      {
        slug: 'tax-summary',
        title: 'Tax Summary & Deductible Expenses',
        intro: 'Prepare for Inland Revenue Department (IRD) filings with automated tax calculation and deduction summaries.',
        readTime: '3 min read',
        steps: [
          {
            title: 'Sri Lankan Tax Tracking',
            content: 'Track tax liabilities, VAT, and SSCL collected on invoices versus deductible business expenses paid.',
            bullets: [
              'Categorizes tax-deductible versus non-deductible expenditures',
              'Simplifies quarterly advance income tax (AIT) estimation'
            ]
          }
        ]
      },
      {
        slug: 'ledgers-trial-balance',
        title: 'Trial Balance, General Ledger & Account Ledgers',
        intro: 'Deep accounting tools for your accountant to audit double-entry balances and verify books before year-end close.',
        readTime: '4 min read',
        steps: [
          {
            title: 'Trial Balance',
            content: 'Lists total debits and credits across all asset, liability, revenue, and expense accounts to ensure your books balance.'
          },
          {
            title: 'General Ledger & Account Ledgers',
            content: 'Search and inspect every individual journal entry and transaction recorded in the system with timestamps and references.'
          }
        ]
      },
      {
        slug: 'data-export',
        title: 'One-Click Data Export to CSV',
        intro: 'Export all your data at any time. You are never locked in.',
        readTime: '2 min read',
        steps: [
          {
            title: 'Exporting Data',
            content: 'Navigate to any table (Invoices, Income, Expenses, Clients, Inventory) or head to Settings > Data Export to download complete CSV archives.',
            bullets: [
              '100% compliant CSV formatting compatible with Excel and Google Sheets',
              'Includes transaction dates, amounts in LKR, categories, and references'
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'settings-workspace',
    title: 'Settings & Workspace Management',
    articles: [
      {
        slug: 'business-profile',
        title: 'Business Profile & Company Branding',
        intro: 'Configure your company identity, legal business details, contact information, and high-resolution logo for client-facing documents.',
        readTime: '3 min read',
        steps: [
          {
            title: '1. Accessing Business Profile Settings',
            content: 'Navigate to Settings from the left sidebar and select "Business Profile". This tab is accessible to Workspace Owners and Admins to safeguard company identity.',
            bullets: [
              'Click Settings in the main sidebar or click your business profile badge in the header',
              'Select "Business Profile" to view and edit company information'
            ]
          },
          {
            title: '2. Entering Business Identity & Industry',
            content: 'Specify your company\'s operational name and primary sector so Framebooks can format your documentation appropriately.',
            bullets: [
              'Business Name: Enter your official registered or trading name (e.g. FrameToque Digital Media)',
              'Industry: Select your business domain (e.g. Technology, Retail, Hospitality, Services)',
              'Updates synchronize automatically to all future PDF headers, quotations, and client portals'
            ]
          },
          {
            title: '3. Contact, Website & Physical Address',
            content: 'Provide your official communication channels and office address. These details are automatically embedded into the header and footer of invoices and quotations.',
            bullets: [
              'Phone Number: Customer service or official billing contact number',
              'Official Email: Where clients can reach your accounting department',
              'Website URL: Your official website link shown on quotations and digital invoices',
              'Business Address: Registered physical location printed on official tax invoices'
            ]
          },
          {
            title: '4. Uploading & Managing Your Business Logo',
            content: 'Add your high-resolution company branding. Framebooks embeds this logo on all invoices, estimates, and payment vouchers.',
            bullets: [
              'Supported Formats: JPG, PNG, GIF, or WebP up to 2MB',
              'Click "Drop logo here or click to browse" to upload your branding image',
              'Use "Remove Logo" at any time to clear the image and fall back to clean brand initials'
            ]
          },
          {
            title: '5. Saving & Verifying Live Output',
            content: 'Click "Save Business Profile" to commit your changes. A green success confirmation will appear, and your workspace header and documents update immediately.',
            bullets: [
              'Changes reflect immediately in the top navigation bar',
              'Existing finalized invoices retain snapshot integrity while new drafts use your updated branding'
            ]
          }
        ]
      },
      {
        slug: 'account-security',
        title: 'Account, Biometric Passkeys & App Lock',
        intro: 'Manage your personal user profile, enroll passwordless biometric passkeys (Touch ID, Face ID), and set up auto-locking session protection.',
        readTime: '4 min read',
        steps: [
          {
            title: '1. Managing Your Personal Profile',
            content: 'In Settings, select "Account & Security" to update your individual user information.',
            bullets: [
              'Full Name: Your personal display name across team actions and audit logs',
              'Email Address: Authenticated login identity',
              'Phone Number: Direct mobile contact for security verifications'
            ]
          },
          {
            title: '2. Registering Biometric WebAuthn Passkeys',
            content: 'Passkeys replace traditional passwords with hardware-backed cryptographic credentials that cannot be phished.',
            bullets: [
              'Click "Add Passkey" under the Passkeys section',
              'Give your passkey a descriptive name (e.g. "Work MacBook Touch ID" or "iPhone Face ID")',
              'Confirm your device prompt using your fingerprint sensor, facial recognition, or YubiKey',
              'Your passkey is saved securely with registration date and last used timestamp'
            ]
          },
          {
            title: '3. Managing & Revoking Enrolled Devices',
            content: 'You can register multiple passkeys across your laptop, phone, and tablet for seamless, passwordless login.',
            bullets: [
              'Inspect all enrolled authenticators in the passkeys table',
              'Click the trash icon next to any device to instantly revoke its access if lost or retired'
            ]
          },
          {
            title: '4. Configuring App Lock Inactivity Protection',
            content: 'Protect your financial records from shoulder-surfing in shared or open-office environments without logging out.',
            bullets: [
              'Toggle "Enable App Lock" in the App Lock section',
              'Select an Auto-Lock Timeout: 1 minute, 5 minutes, 15 minutes, or 30 minutes',
              'Set a 4-digit PIN for backup manual unlocking'
            ]
          },
          {
            title: '5. High-Security Mode & Unlock Verification',
            content: 'When App Lock triggers or when high-security mode is engaged, the dashboard blurs and prompts for instant biometric or PIN re-verification.',
            bullets: [
              'Touch your fingerprint sensor or enter your PIN to immediately restore your working session',
              'Protects confidential payroll, profit, and client revenue figures from unauthorized eyes'
            ]
          }
        ]
      },
      {
        slug: 'billing-plans',
        title: 'Billing, Subscription Plans & Upgrades',
        intro: 'Understand subscription tiers (Free, Pro, and Pro Plus), switch billing cycles, monitor usage quotas, and manage subscription renewals.',
        readTime: '4 min read',
        steps: [
          {
            title: '1. Checking Current Tier & Resource Quotas',
            content: 'Navigate to Settings > Billing & Plans to view your active plan status, renewal date, and real-time consumption metrics.',
            bullets: [
              'Current Tier: Free, Pro, or Pro Plus badge displayed prominently',
              'Quota Gauges: Monitor monthly invoices created, active clients, connected bank accounts, and inventory items',
              'Renewal Date: Displays exact expiration and renewal status'
            ]
          },
          {
            title: '2. Plan Comparison & Selection',
            content: 'Evaluate the three subscription tiers designed for Sri Lankan businesses at different operational stages:',
            bullets: [
              'Free: Ideal for solo freelancers (up to 50 invoices, 50 clients, 2 bank accounts)',
              'Pro: For growing businesses needing unlimited invoicing, unlimited clients, and 2FA security',
              'Pro Plus: For full companies needing unlimited bank accounts, inventory tracking, audit logs, and team members'
            ]
          },
          {
            title: '3. Choosing Monthly vs. Annual Billing',
            content: 'Toggle the billing interval switch between Monthly and Annual. Annual billing includes significant savings and provides uninterrupted 12-month access.',
            bullets: [
              'Annual discount rates applied automatically in LKR',
              'Predictable accounting expenditure for your annual budget'
            ]
          },
          {
            title: '4. Upgrading Your Workspace',
            content: 'Click "Upgrade to Pro" or "Upgrade to Pro Plus" to initiate plan migration.',
            bullets: [
              'Review the summary modal with calculated LKR pricing and payment instructions',
              'Submit your bank transfer slip or online payment confirmation',
              'Your workspace tier and quotas upgrade immediately upon payment verification'
            ]
          },
          {
            title: '5. Handling Renewal Grace Periods',
            content: 'If an annual or monthly plan expires before payment, Framebooks activates a non-disruptive grace period banner.',
            bullets: [
              'Financial data remains safe and read-only accessible without sudden lockouts',
              'Owners can upload renewal proof anytime to seamlessly reactivate full writing privileges'
            ]
          }
        ]
      },
      {
        slug: 'team-roles',
        title: 'Team Settings & Member Invitations',
        intro: 'Invite staff members, co-founders, and external accountants to collaborate in your workspace with role-based access control.',
        readTime: '4 min read',
        steps: [
          {
            title: '1. Accessing Team Settings',
            content: 'Go to Settings > Team Settings. This module is accessible to Workspace Owners and Super Admins.',
            bullets: [
              'Review current roster of active team members',
              'Inspect pending outbound invitations awaiting response'
            ]
          },
          {
            title: '2. Sending a Colleague Invitation',
            content: 'Click "Invite Member" to add a new user to your organization.',
            bullets: [
              'Enter the colleague\'s email address',
              'Select an initial role: Admin, Member, Accountant, or Viewer',
              'Click "Send Invitation" to dispatch the onboarding request'
            ]
          },
          {
            title: '3. Managing Pending Invitations',
            content: 'Sent invitations appear in the Pending list with recipient email and assigned role.',
            bullets: [
              'If an email address was misspelled, click "Cancel Invitation" to revoke it immediately',
              'Invitations remain pending until the recipient logs in and accepts'
            ]
          },
          {
            title: '4. Recipient Onboarding Experience',
            content: 'When an invited user signs in or completes onboarding, Framebooks detects the pending invitation automatically.',
            bullets: [
              'The recipient can accept with one click to join the organization immediately',
              'No manual configuration or API keys required on their end'
            ]
          },
          {
            title: '5. Changing Roles & Offboarding Members',
            content: 'Maintain tight access control as staff responsibilities evolve or employees depart.',
            bullets: [
              'Change member roles dynamically from the member dropdown',
              'Click "Remove Member" to immediately revoke workspace access and terminate sessions'
            ]
          }
        ]
      },
      {
        slug: 'roles-permissions',
        title: 'Roles & Granular Permissions',
        intro: 'Define custom access profiles with module-level permissions across invoicing, banking, expenses, and financial reporting.',
        plan: 'Pro Plus',
        readTime: '4 min read',
        steps: [
          {
            title: '1. Opening Roles & Permissions',
            content: 'Navigate to Settings > Roles & Permissions. Only the Workspace Owner has permission to configure custom roles.',
            bullets: [
              'Inspect standard system roles (Owner, Admin, Accountant, Viewer)',
              'View custom roles created for specific departments'
            ]
          },
          {
            title: '2. Understanding Default Role Hierarchy',
            content: 'Framebooks provides standard roles out of the box:',
            bullets: [
              'Owner: Unrestricted access to all modules, billing, settings, and danger zone',
              'Admin: Full operational management across transactions, clients, and inventory',
              'Accountant: Direct access to journals, P&L, balance sheets, and tax reports',
              'Viewer: Safe read-only mode that prevents accidental creation, editing, or deletion'
            ]
          },
          {
            title: '3. Creating a Custom Role',
            content: 'Click "New Role" in the Roles Configurator to establish a tailored permission set.',
            bullets: [
              'Provide a descriptive Role Name (e.g., "Sales Executive", "Inventory Clerk", "Auditor")',
              'Add a brief description explaining who should hold this role'
            ]
          },
          {
            title: '4. Configuring Module-Level Access',
            content: 'Check exact permissions across all 8 primary application modules:',
            bullets: [
              'Invoices & Quotations: View, Create, Edit, Delete',
              'Income & Expenses: View, Create, Edit, Delete',
              'Accounts & Banking: Restrict account balance viewing or transfer creation',
              'Clients & Inventory: Control client catalog and stock adjustments',
              'Reports: Grant or withhold access to high-level P&L and Balance Sheet statements'
            ]
          },
          {
            title: '5. Applying Custom Roles to Team Members',
            content: 'Save your custom role, then head to Team Settings to assign it to any existing or new team member.',
            bullets: [
              'Permissions apply immediately upon their next action',
              'Audit log records the role creation and assignment for compliance'
            ]
          }
        ]
      },
      {
        slug: 'audit-logs',
        title: 'System Audit Logs & Compliance Trail',
        intro: 'Inspect a permanent, tamper-resistant record of all financial events, security logins, record deletions, and administrative actions.',
        plan: 'Pro Plus',
        readTime: '3 min read',
        steps: [
          {
            title: '1. Accessing the Audit Trail',
            content: 'Head to Settings > Audit Logs to inspect the chronological event stream.',
            bullets: [
              'Available on the Pro Plus plan for full financial and regulatory compliance',
              'Accessible to Workspace Owners and Super Admins'
            ]
          },
          {
            title: '2. Interpreting Audit Log Entries',
            content: 'Every system event is automatically logged with rich metadata:',
            bullets: [
              'Timestamp: Exact date and Colombo time of the action',
              'Actor: User display name and email address who performed the action',
              'Action: Machine-readable event tag (e.g., invoice.create, payment.record, member.remove)',
              'IP Address: Network origin address of the request',
              'Severity: Color-coded severity badge (Info, Warning, Destructive)'
            ]
          },
          {
            title: '3. Filtering by Date Range & Search',
            content: 'Pinpoint specific events quickly using dynamic filters.',
            bullets: [
              'Filter by standard periods (Today, This Week, This Month, Custom Range)',
              'Search by specific user email or action keyword to locate specific audit events'
            ]
          },
          {
            title: '4. Investigating Changes & Dispute Resolution',
            content: 'Click on any event entry to inspect details including affected record IDs and before/after values.',
            bullets: [
              'Resolve internal bookkeeping questions on who approved a discount or modified an invoice',
              'Maintain proof of payment entry for external tax auditors'
            ]
          },
          {
            title: '5. Tamper-Proof Storage & Retention',
            content: 'Audit logs are append-only and cannot be edited, overwritten, or deleted by standard users, ensuring evidentiary compliance with accounting regulations.',
            bullets: [
              'Immutable database records linked to user session IDs',
              'Archived permanently alongside your financial statements'
            ]
          }
        ]
      },
      {
        slug: 'data-export',
        title: 'Data Export & Workspace Backups',
        intro: 'Export your complete financial records, client lists, invoices, and accounting ledgers into universal CSV formats anytime.',
        readTime: '3 min read',
        steps: [
          {
            title: '1. Navigating to Data Export',
            content: 'Go to Settings > Data Export. Only Workspace Owners have permission to export organizational data.',
            bullets: [
              'Open Settings from the sidebar and select "Data Export"',
              'Designed for year-end accounting, tax preparation, and offline backups'
            ]
          },
          {
            title: '2. Selecting Data Categories for Export',
            content: 'Choose which datasets you need to download:',
            bullets: [
              'Invoices: Full line item breakdowns, tax amounts, client details, and payment statuses',
              'Quotations: All estimates, validity dates, itemized amounts, and status histories',
              'Income & Expenses: Comprehensive transaction logs with categories, payment methods, and bank links',
              'Clients: Complete contact directory with billing addresses, phone numbers, and balances',
              'Bank Accounts: Ledger balances, account numbers, and transaction flows',
              'Inventory: Stock levels, unit costs, selling prices, and categories'
            ]
          },
          {
            title: '3. Applying Date Range Filters',
            content: 'Narrow your export to specific accounting periods before downloading.',
            bullets: [
              'Choose presets such as "This Month", "Last Month", "This Quarter", or "This Financial Year"',
              'Use the Custom Date Range picker to select exact start and end dates'
            ]
          },
          {
            title: '4. Downloading Your CSV Files',
            content: 'Click "Export to CSV". Framebooks formats the data with clean column headers and streams the download directly to your browser.',
            bullets: [
              'Standard UTF-8 CSV formatting compatible with Windows, Mac, and Linux',
              'Numbers formatted cleanly with two decimal places in LKR without currency symbol corruption'
            ]
          },
          {
            title: '5. Opening in Excel, Google Sheets & Tax Software',
            content: 'Use exported files for external analysis or sharing with your chartered accountant.',
            bullets: [
              'Directly importable into Microsoft Excel, Apple Numbers, Google Sheets, or LibreOffice',
              'Easily shared with external auditors for IRD Sri Lanka tax assessments'
            ]
          }
        ]
      },
      {
        slug: 'danger-zone',
        title: 'Danger Zone & Workspace Reset',
        intro: 'Understanding irreversible administrative operations including leaving organizations, resetting test data, and permanently deleting workspaces.',
        readTime: '3 min read',
        steps: [
          {
            title: '1. Accessing the Danger Zone',
            content: 'Navigate to Settings > Danger Zone. This section is strictly restricted to Workspace Owners and Super Admins.',
            bullets: [
              'Protected with high-security visual warnings to prevent accidental triggers',
              'Requires secondary confirmation before executing any destructive command'
            ]
          },
          {
            title: '2. Leaving a Team Workspace',
            content: 'If you joined a company organization as a team member and wish to disconnect your personal account, use the "Leave Team" option.',
            bullets: [
              'Sever your access to the team workspace without deleting the company records',
              'Your personal account remains active to create or join other workspaces'
            ]
          },
          {
            title: '3. Resetting Workspace Transaction Data',
            content: 'When testing Framebooks during onboarding or starting a clean financial year, you may want to purge sample entries.',
            bullets: [
              'Click "Reset Workspace Data"',
              'Purges all invoices, quotations, income entries, and expenses',
              'Preserves your company profile, bank accounts, client roster, and inventory catalog so you don\'t have to re-enter them'
            ]
          },
          {
            title: '4. Multi-Step Confirmation Safeguards',
            content: 'To prevent accidental data loss, all destructive operations require typing your business name verbatim into a modal prompt.',
            bullets: [
              'Type your exact company name to activate the final confirmation button',
              'If App Lock is active, authentication via biometric sensor or master PIN is required'
            ]
          },
          {
            title: '5. Permanently Deleting a Workspace',
            content: 'If your business is closing or you no longer require Framebooks, you can permanently delete the organization.',
            bullets: [
              'Permanently removes the workspace, all transactions, invoices, audit trails, and member links',
              'WARNING: This operation is completely permanent and cannot be undone'
            ]
          }
        ]
      },
      {
        slug: 'passkeys-2fa',
        title: 'Biometric Passkeys & Two-Factor Authentication',
        intro: 'Protect your financial accounts using WebAuthn passkeys (Touch ID, Face ID) and two-factor authentication.',
        readTime: '4 min read',
        steps: [
          {
            title: '1. What are Passkeys?',
            content: 'Passkeys replace traditional passwords with cryptographic keys stored securely in your device\'s hardware (Apple Keychain or Google Password Manager).',
            bullets: [
              'Immune to phishing and credential stuffing attacks',
              'Log in with your fingerprint or face in less than a second'
            ]
          },
          {
            title: '2. Enrolling a Passkey',
            content: 'Go to Settings > Account & Security > Passkeys. Click "Add Passkey", name your device, and authenticate with your biometric sensor.',
            bullets: [
              'Works across Safari, Chrome, Edge, and mobile browsers',
              'Biometric data never leaves your device'
            ]
          },
          {
            title: '3. Enabling 2FA (Two-Factor Authentication)',
            content: 'Add an extra security layer for all logins to ensure unauthorized users cannot access financial records without hardware validation.',
            bullets: [
              'Prompted whenever logging in from a new browser or device',
              'Required for sensitive administrative actions'
            ]
          }
        ]
      },
      {
        slug: 'app-lock',
        title: 'App Lock & Session Protection',
        intro: 'Lock your dashboard screen when you step away from your computer in open office environments.',
        readTime: '2 min read',
        steps: [
          {
            title: '1. Enabling App Lock',
            content: 'In Settings > Account & Security, configure App Lock with an auto-lock timeout. When triggered, the screen blurs and requires your biometric sensor or PIN to resume.',
            bullets: [
              'Configurable timeout intervals from 1 minute to 30 minutes',
              'Instant screen blur covers sensitive financial figures'
            ]
          },
          {
            title: '2. Quick Manual Screen Lock',
            content: 'You can manually trigger App Lock anytime before stepping away from your desk by clicking the lock icon in the top header or user menu.',
            bullets: [
              'Instant lock without having to sign out',
              'Resumes directly on your current open page without reloading'
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'plans-tools',
    title: 'Plans & Interactive Tools',
    articles: [
      {
        slug: 'plan-finder',
        title: 'Interactive Plan Calculator & Limits',
        intro: 'Use our built-in interactive calculator to determine the ideal plan (Free, Pro, or Pro Plus) based on your real-world monthly volume.',
        readTime: '2 min read',
        steps: [
          {
            title: 'How the Calculator Works',
            content: 'Adjust your monthly volume sliders (Invoices, Clients, Bank Accounts) and check required features (Inventory, Advanced Reports, Audit Logs). Framebooks automatically computes the best plan recommendation with pricing and features.'
          }
        ]
      },
      {
        slug: 'spreadsheets-vs-framebooks',
        title: 'Spreadsheets vs. Framebooks Comparison',
        intro: 'Why modern Sri Lankan businesses migrate away from messy Excel/Google spreadsheets to an integrated cloud ERP.',
        readTime: '3 min read',
        steps: [
          {
            title: 'The Hidden Cost of Spreadsheets',
            content: 'Spreadsheets are fine for day one, but quickly become a liability as soon as you have more than a handful of clients.',
            bullets: [
              'Broken formulas lead to miscalculated profit and tax errors',
              'Zero automated overdue payment tracking',
              'No audit logs of who edited which cell',
              'Messy file sharing between business partners and accountants'
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'troubleshooting',
    title: 'Help & Reference',
    articles: [
      {
        slug: 'faq',
        title: 'Frequently Asked Questions & Troubleshooting',
        intro: 'Answers to the most common questions regarding billing, currency, payments, and account setup.',
        readTime: '4 min read',
        steps: [
          {
            title: 'Can I use Framebooks entirely in LKR (Sri Lankan Rupees)?',
            content: 'Yes! Framebooks is built from the ground up for Sri Lanka. All numbers, currency formatting, and tax logic default to LKR.'
          },
          {
            title: 'Why can\'t I delete a bank account?',
            content: 'To preserve accounting integrity and ensure your Balance Sheet doesn\'t break, you cannot delete an account that has transaction history linked to it. You can archive it instead.'
          },
          {
            title: 'Can my accountant log in simultaneously?',
            content: 'Yes! Invite your accountant under Settings > Team with the Accountant role so they can inspect financial reports and trial balance directly.'
          },
          {
            title: 'How do I cancel or upgrade my subscription?',
            content: 'Go to Settings > Billing to switch between monthly and annual plans or upgrade at any time with prorated billing.'
          }
        ]
      },
      {
        slug: 'glossary',
        title: 'Accounting & Financial Glossary',
        intro: 'Plain-English definitions of financial and accounting terms used throughout Framebooks.',
        readTime: '4 min read',
        steps: [
          {
            title: 'Accounts Receivable (AR)',
            content: 'Money owed to your business by clients for services or goods already delivered via issued invoices.'
          },
          {
            title: 'Accounts Payable (AP)',
            content: 'Money your business owes to suppliers, vendors, or contractors.'
          },
          {
            title: 'Net Profit',
            content: 'The actual money you made after subtracting all operating costs, expenses, and taxes from total revenue.'
          },
          {
            title: 'Reconciliation',
            content: 'The process of ensuring your records in Framebooks match the physical bank statement from your bank.'
          },
          {
            title: 'Trial Balance',
            content: 'A bookkeeping worksheet in which the balances of all ledgers are compiled into debit and credit columns to verify mathematical accuracy.'
          }
        ]
      }
    ]
  }
];
