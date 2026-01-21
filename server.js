require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { error } = require('console');
const { successlog, errorlog } = require('./util/logger');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));


app.locals.company = {
  name: process.env.COMPANY_NAME,
  address1: process.env.COMPANY_ADDRESS1,
  address2: process.env.COMPANY_ADDRESS2,
  city: process.env.COMPANY_CITY,
  phone: process.env.COMPANY_PHONE,
  email: process.env.COMPANY_EMAIL,
  signatory: process.env.COMPANY_SIGNATORY
};


const db = new sqlite3.Database('./database.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS invoice_counters (year INTEGER PRIMARY KEY, counter INTEGER )`);

  db.run(`CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT,
    client TEXT,
    total INTEGER,
    paid INTEGER,
    balance INTEGER,
    status TEXT DEFAULT 'ACTIVE',
    description TEXT,
    reference TEXT,
    invoice_date TEXT,
    due_date TEXT,
    terms TEXT,
    installment_mode TEXT,
    pdf_path TEXT
  )`);


  db.run(`CREATE TABLE IF NOT EXISTS installments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER,
    amount INTEGER,
    due_on TEXT,
    paid_on TEXT
  )`);
});

function getNextInvoiceNumber(cb) {
  const year = new Date().getFullYear();

  db.get(
    "SELECT counter FROM invoice_counters WHERE year=?",
    [year],
    (err, row) => {
      if (!row) {
        // first invoice of the year
        db.run(
          "INSERT INTO invoice_counters (year, counter) VALUES (?, ?)",
          [year, 1],
          () => cb(`INV-${year}-000001`)
        );
      } else {
        const next = row.counter + 1;
        db.run(
          "UPDATE invoice_counters SET counter=? WHERE year=?",
          [next, year],
          () => {
            const padded = String(next).padStart(6, '0');
            cb(`INV-${year}-${padded}`);
          }
        );
      }
    }
  );
}

app.get('/', (req, res) => {
  const show = req.query.show || 'all';

  // Query for list
  let listQuery;
  if (show === 'active') {
    listQuery = "SELECT * FROM invoices WHERE status='ACTIVE' ORDER BY id DESC";
  } else if (show === 'cancelled') {
    listQuery = "SELECT * FROM invoices WHERE status='CANCELLED' ORDER BY id DESC";
  } else {
    listQuery = "SELECT * FROM invoices ORDER BY id DESC";
  }

  // Get invoices
  db.all(listQuery, (err, invoices) => {
    if (err) {
      console.error(err);
      errorlog.error('Failed to fetch invoices', { error: err.message, query: listQuery });
      return res.sendStatus(500);
    }

    // Get status counts (THIS QUERY)
    db.all(
      "SELECT status, COUNT(*) as count FROM invoices GROUP BY status",
      (err2, rows) => {

        if (err2) {
          console.error('Status count query failed:', err2.message);
          rows = [];
        }

        const counts = { ACTIVE: 0, CANCELLED: 0 };

        rows.forEach(r => {
          counts[r.status] = r.count;
        });

        res.render('list', {
          title: 'Invoices',
          invoices,
          show,
          counts
        });
      }
    );
  });
});


app.get('/new', (req, res) => {
  res.render('new', { title: 'New Invoice' });
});

app.post('/new', (req, res) => {
  const total = parseInt(req.body.total);
  const mode = req.body.installment_mode || 'NONE';
  successlog.info('New invoice request', { client: req.body.client, total, mode });

  getNextInvoiceNumber((invNo) => {

    db.run(
      `INSERT INTO invoices
       (invoice_number, client, total, paid, balance, status,
        description, reference, invoice_date, due_date, terms, installment_mode)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        invNo,
        req.body.client,
        total,
        0,
        total,
        'ACTIVE',
        req.body.description,
        req.body.reference,
        req.body.invoice_date,
        req.body.due_date,
        req.body.terms,
        mode
      ],
      function (err) {
        if (err) {
          console.error(err);
          errorlog.error('Failed to create invoice', { error: err.message, client: req.body.client });
          return res.status(500).send(err.message);
        }

        const invoiceId = this.lastID;

        // EQUAL INSTALLMENTS
        if (mode === 'EQUAL') {
          const months = parseInt(req.body.months);
          const per = Math.floor(total / months);

          for (let i = 1; i <= months; i++) {
            let d = new Date();
            d.setMonth(d.getMonth() + i);

            db.run(
              `INSERT INTO installments (invoice_id, amount, due_on)
               VALUES (?,?,?)`,
              [invoiceId, per, d.toISOString().slice(0,10)]
            );
          }
        }

        // MANUAL INSTALLMENTS
        if (mode === 'MANUAL') {
          const amounts = req.body.manual_amount || [];
          const dues = req.body.manual_due || [];

          for (let i = 0; i < amounts.length; i++) {
            if (!amounts[i] || !dues[i]) continue;

            db.run(
              `INSERT INTO installments (invoice_id, amount, due_on)
               VALUES (?,?,?)`,
              [invoiceId, amounts[i], dues[i]]
            );
          }
        }

        successlog.info('Invoice created', { invoiceId: this.lastID, invoice_number: invNo, client: req.body.client, total });

        res.redirect('/');
      }
    );
  });
});


function safeFileName(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}


app.get('/invoice/:no', (req, res) => {
  db.get(
    "SELECT * FROM invoices WHERE invoice_number=?",
    [req.params.no],
    (e, invoice) => {
      db.all(
        "SELECT * FROM installments WHERE invoice_id=?",
        [invoice.id],
        (e2, installments) => {
          res.render('invoice', {
            title: `Invoice ${invoice.invoice_number}`,
            invoice,
            installments
          });
        }
      );
    }
  );
});


app.post('/cancel/:no', (req, res) => {
  const invoiceNo = req.params.no;

  db.run(
    "UPDATE invoices SET status='CANCELLED' WHERE invoice_number=?",
    [invoiceNo],
    (err) => {
      if (err) {
        console.error('Failed to cancel invoice', err);
        errorlog.error('Failed to cancel invoice', { error: err.message, invoiceNo });
      }
      res.redirect('/');
    }
  );
});



app.post('/delete/:no', (req, res) => {
  const invoiceNo = req.params.no;

  // Fetch invoice
  db.get(
    "SELECT id, pdf_path FROM invoices WHERE invoice_number=?",
    [invoiceNo],
    (err, invoice) => {

      if (err || !invoice) {
        console.error('Invoice not found');
        errorlog.error('Invoice not found for deletion', { invoiceNo, error: err?.message });
        return res.redirect('/');
      }

      const invoiceId = invoice.id;

      // Delete PDF file if it exists
      if (invoice.pdf_path && fs.existsSync(invoice.pdf_path)) {
        try {
          fs.unlinkSync(invoice.pdf_path);
          console.log('PDF deleted:', invoice.pdf_path);
        } catch (e) {
          console.error('Failed to delete PDF:', e.message);
        }
      }

      // Delete installments
      db.run(
        "DELETE FROM installments WHERE invoice_id=?",
        [invoiceId],
        (err1) => {
          if (err1) {
            console.error('Failed to delete installments', err1);
            return res.redirect('/');
          }
          // Delete invoice
          db.run(
            "DELETE FROM invoices WHERE id=?",
            [invoiceId],
            (err2) => {
              if (err2) {
                console.error('Failed to delete invoice', err2);
              }
              successlog.info('Invoice successfully deleted', { invoiceId, invoiceNo });
              res.redirect('/');
            }
          );
        }
      );
    }
  );
});



app.get('/pdf/:no', async (req, res) => {
  const invoiceNo = req.params.no;
  successlog.info('PDF generation started', { invoiceNo });

  db.get(
    "SELECT invoice_number, client FROM invoices WHERE invoice_number=?",
    [invoiceNo],
    async (err, invoice) => {

      if (!invoice) {
        errorlog.error('Invoice not found for PDF', { invoiceNo });
        return res.status(404).send('Invoice not found');
      }

      const baseDir = path.join(__dirname, 'invoices');
      const clientDirName = safeFileName(invoice.client);
      const clientDir = path.join(baseDir, clientDirName);

      // Ensure folders exist
      if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir);
      if (!fs.existsSync(clientDir)) fs.mkdirSync(clientDir);

      // Subfolder based on year
      const year = new Date().getFullYear();
      const yearDir = path.join(clientDir, String(year));
      if (!fs.existsSync(yearDir)) fs.mkdirSync(yearDir);

      const fileName = `${clientDirName}_${invoice.invoice_number}.pdf`;
      const filePath = path.join(yearDir, fileName);

      const browser = await puppeteer.launch();
      const page = await browser.newPage();

      await page.goto(
        `http://localhost:3000/invoice/${invoiceNo}`,
        { waitUntil: 'networkidle0' }
      );

      await page.pdf({
        path: filePath,
        format: 'A4',
        printBackground: true
      });

      await browser.close();
      res.download(filePath);

      successlog.info('PDF generated', { invoiceNo, filePath });

    }
  );
});


app.listen(3000, () => console.log('Running on http://localhost:3000'));
