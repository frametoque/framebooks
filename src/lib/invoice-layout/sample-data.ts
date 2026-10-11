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
  legal_name: "Company Name",
  billing_address: "Client Address",
  client_email: "accounts@company.com",
  client_phone: "+1 234 567 890",
  notes: "Thank you for partnering with us. Payment is due within 14 business days.",
  terms: "Interest of 1.5% per month will be charged on overdue balances after 30 days.",
  items: [
    {
      description: "Line Item 1",
      quantity: 1,
      price: 180000,
      total: 180000,
    },
    {
      description: "Line Item 2",
      quantity: 1,
      price: 120000,
      total: 120000,
    },
    {
      description: "Line Item 3",
      quantity: 1,
      price: 50000,
      total: 50000,
    },
    {
      description: "Line Item 4",
      quantity: 1,
      price: 25000,
      total: 25000,
    },
    {
      description: "Line Item 5",
      quantity: 1,
      price: 15000,
      total: 15000,
    },
    {
      description: "Line Item 6",
      quantity: 1,
      price: 10000,
      total: 10000,
    },
    {
      description: "Line Item 7",
      quantity: 1,
      price: 10000,
      total: 10000,
    },
    {
      description: "Line Item 8",
      quantity: 1,
      price: 10000,
      total: 10000,
    },
    {
      description: "Line Item 9",
      quantity: 1,
      price: 10000,
      total: 10000,
    },
    {
      description: "Line Item 10",
      quantity: 1,
      price: 10000,
      total: 10000,
    },
  ],
  bank_acc_name: "Company Name",
  bank_acc_bank: "Bank Name",
  bank_acc_number: "123456789",
  bank_acc_branch: "City Branch",
  custom_field_values: {
    po_number: "PO-12345",
    project_code: "PRJ-001",
  },
};

export const SAMPLE_TENANT_INFO = {
  name: "Company Name",
  legal_name: "Company Name",
  logo_url: "/logos/ft/logo.png",
  industry: "Business Services",
  accent_color: "#00E35B",
};
