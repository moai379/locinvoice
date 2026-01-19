# Invoice Management Web Application (Local)

## Overview

This project is aimed at running **locally as a web-application invoice management system** developed using **Node.js, Express, SQLite, and EJS**.  
It enables structured invoice creation, installment management, cancellation handling, and PDF generation while ensuring audit safety and data persistence all without reliance on external services or cloud infrastructure.

---

## Key Features

- Structured and sequential invoice number generation
- Optional installment schedules per invoice
- Client-wise and year-wise invoice PDF storage
- Invoice cancellation without number reuse (audit-safe)
- Optional permanent deletion with file cleanup
- Filter invoices by status: Active / Cancelled / All
- Print-optimized invoice layout
- Fully local SQLite database
- No external APIs or third-party services required

---

## Technology Stack

| Component | Technology |
|---------|------------|
| Backend | Node.js, Express |
| Frontend | EJS |
| Database | SQLite |
| PDF Generation | Puppeteer |
| Styling | Vanilla CSS |
| Storage | Local filesystem |

---

## Installation and Setup

### Prerequisites
- Node.js (v18 or later recommended)
- npm

### Steps

1. Clone the repository:
```bash
git clone https://github.com/moai379/locinvoice.git
cd invoice-web-app
```
2. Install dependencies:
```bash
npm install
```
3. Start the application:
```bash
npm start
```
5. Open the application in a browser: http://localhost:3000

---

## Invoice Numbering System

Invoices follow a year-based sequential format: INV-YYYY-XXXXXX

Example:
INV-2026-000001,
INV-2026-000002


- Sequence resets automatically each year

- Invoice numbers are preserved even if invoices are cancelled

- Number reuse is avoided unless the database is manually reset

---

## PDF Storage Strategy

Invoice PDFs are stored locally using a client-wise and year-wise directory structure: 
```yaml
invoices/
  {client_name}/
    {year}/
      {client_name}_INV-{year}-000123.pdf
```
---

## Print and PDF Behavior

- UI elements are excluded from print and PDF output using @media print

- Layout optimized for A4 page size

- Automatic page breaks for installment tables

- Optional watermark for cancelled invoices

---

## License

This project is released under the MIT License.
You are free to use, modify, and distribute it in accordance with the license terms.


# **THE END**
