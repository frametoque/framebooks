// src/lib/invoice-layout/sample-data.ts

export const SAMPLE_INVOICE_DATA = {
  invoice_id: "INV-2026-0001",
  date: "2026-10-10",
  due_date: "2026-10-24",
  currency: "LKR",
  subtotal: 350000,
  discount: 15000,
  tax_rate: 8,
  advance: 100000,
  total: 361800,
  total_due: 261800,
  payment_status: "partially paid",
  legal_name: "ABC Company Ltd",
  billing_address: "123 Business Street, City Name, Country",
  client_email: "accounts@company.com",
  client_phone: "+1 234 567 890",
  notes: "Thank you for partnering with us. Payment is due within 14 business days.",
  terms: "Interest of 1.5% per month will be charged on overdue balances after 30 days.",
  items: [
    {
      description: "Consulting & Implementation Services",
      quantity: 1,
      price: 180000,
      total: 180000,
    },
    {
      description: "Software License & Maintenance",
      quantity: 1,
      price: 120000,
      total: 120000,
    },
    {
      description: "Support & Infrastructure Setup",
      quantity: 1,
      price: 50000,
      total: 50000,
    },
  ],
  bank_acc_name: "ABC Company",
  bank_acc_bank: "Bank Name",
  bank_acc_number: "123456789",
  bank_acc_branch: "City Branch",
  custom_field_values: {
    po_number: "PO-12345",
    project_code: "PRJ-001",
  },
};

export const SAMPLE_TENANT_INFO = {
  name: "ABC Company",
  legal_name: "ABC Company Ltd",
  logo_url: "/logos/ft/logo.png",
  industry: "Business Services",
  accent_color: "#00E35B",
};
