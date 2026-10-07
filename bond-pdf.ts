import { createHash } from 'node:crypto';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { signBond } from './bond-signature.js';
import type { BondPayload } from './bond-signature.js';

const requiredText: (keyof BondPayload)[] = [
  'bookingId', 'dateGenerated', 'ownerName', 'ownerContact', 'customerName',
  'customerContact', 'serviceDescription', 'completionDate', 'dueDate',
  'acceptanceTimestamp',
];
const requiredMoney: (keyof BondPayload)[] = ['totalAmount', 'amountPaid', 'remainingAmount'];
const verifyBase = process.env.BOND_VERIFY_BASE_URL || 'https://rigdesk-marketplace-rig-desk.vercel.app/verify/';

function safeText(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function validate(body: unknown): BondPayload {
  if (!body || typeof body !== 'object') throw new Error('A JSON booking payload is required.');
  const input = body as Record<string, unknown>;
  for (const key of requiredText) {
    if (!safeText(input[key])) throw new Error(`${key} is required.`);
  }
  for (const key of requiredMoney) {
    if (!Number.isFinite(Number(input[key])) || Number(input[key]) < 0) throw new Error(`${key} must be a non-negative number.`);
  }
  const totalAmount = Number(input.totalAmount);
  const amountPaid = Number(input.amountPaid);
  const remainingAmount = Number(input.remainingAmount);
  if (amountPaid + remainingAmount > totalAmount + 1) throw new Error('Paid and remaining amounts cannot exceed the total amount.');
  return {
    bookingId: safeText(input.bookingId, 80),
    dateGenerated: safeText(input.dateGenerated, 80),
    ownerName: safeText(input.ownerName, 120),
    ownerContact: safeText(input.ownerContact, 120),
    customerName: safeText(input.customerName, 120),
    customerContact: safeText(input.customerContact, 120),
    serviceDescription: safeText(input.serviceDescription, 600),
    completionDate: safeText(input.completionDate, 80),
    totalAmount,
    amountPaid,
    remainingAmount,
    dueDate: safeText(input.dueDate, 80),
    customerIpAddress: safeText(input.customerIpAddress, 80),
    acceptanceTimestamp: safeText(input.acceptanceTimestamp, 100),
  };
}

function money(value: number) {
  return `INR ${Math.round(value).toLocaleString('en-IN')}`;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const signingSecret = process.env.BOND_PDF_SECRET?.trim();
    if (!signingSecret) {
      return res.status(503).json({ error: 'Bond signing is not configured yet.' });
    }
    const bond = validate(typeof req.body === 'string' ? JSON.parse(req.body) : req.body);
    const forwarded = safeText(req.headers['x-forwarded-for']).split(',')[0].trim();
    const ipAddress = forwarded || bond.customerIpAddress || 'Not recorded';
    const signedBond = { ...bond, customerIpAddress: ipAddress };
    const token = signBond(signedBond);
    const verificationUrl = `${verifyBase.replace(/\/$/, '')}/${encodeURIComponent(bond.bookingId)}?token=${encodeURIComponent(token)}`;
    const digest = createHash('sha256')
      .update(JSON.stringify(signedBond))
      .digest('hex')
      .toUpperCase();
    const ownerPassword = createHash('sha256')
      .update(`${signingSecret}:${bond.bookingId}`)
      .digest('hex');
    const qrCode = await QRCode.toDataURL(verificationUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 720,
    });
    const doc = new jsPDF({
      unit: 'mm',
      format: 'a4',
      compress: true,
      encryption: { ownerPassword, userPermissions: ['print'] },
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 18;
    const contentWidth = pageWidth - margin * 2;
    const qrSize = 46;
    const qrX = pageWidth - margin - qrSize;
    const headerTextWidth = contentWidth - qrSize - 12;
    let y = 20;

    const ensureSpace = (height: number) => {
      if (y + height > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }
    };
    const heading = (text: string) => {
      ensureSpace(12);
      doc.setFillColor(24, 48, 58);
      doc.rect(margin, y, contentWidth, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(text, margin + 3, y + 5.4);
      y += 12;
    };
    const line = (label: string, value: string, bold = false) => {
      const lines = doc.splitTextToSize(`${label}${value}`, contentWidth);
      ensureSpace(lines.length * 5 + 2);
      doc.setTextColor(30, 48, 56);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(9.5);
      doc.text(lines, margin, y);
      y += lines.length * 5 + 2;
    };
    const paragraph = (text: string) => {
      const lines = doc.splitTextToSize(text, contentWidth);
      ensureSpace(lines.length * 4.8 + 4);
      doc.setTextColor(47, 61, 66);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.2);
      doc.text(lines, margin, y);
      y += lines.length * 4.8 + 4;
    };

    doc.setFillColor(247, 243, 233);
    doc.setDrawColor(26, 125, 120);
    doc.roundedRect(qrX - 3, 12, qrSize + 6, qrSize + 14, 2, 2, 'FD');
    doc.addImage(qrCode, 'PNG', qrX, 15, qrSize, qrSize);
    doc.setTextColor(26, 125, 120);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.text('SCAN TO VERIFY ORIGINAL', qrX + qrSize / 2, 67, { align: 'center' });

    doc.setTextColor(24, 48, 58);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('DIGITAL SERVICE & PAYMENT BOND', margin, y);
    y += 8;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const documentMeta = doc.splitTextToSize(`Document Reference ID: ${bond.bookingId}\nDate of Issuance: ${bond.dateGenerated}`, headerTextWidth);
    doc.text(documentMeta, margin, y);
    y += documentMeta.length * 4.4 + 2;
    doc.setTextColor(26, 125, 120);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.4);
    doc.text('Scan the top QR code to check this original bond on RigDesk.', margin, y);
    y = 78;

    heading('BOND SUMMARY - OWNER (SERVICE PROVIDER)');
    line('Name: ', bond.ownerName, true);
    line('Contact: ', bond.ownerContact);
    heading('CUSTOMER (CLIENT)');
    line('Name: ', bond.customerName, true);
    line('Contact: ', bond.customerContact);
    heading('SERVICE DETAILS');
    line('Booking Reference: ', bond.bookingId, true);
    const summary = bond.serviceDescription.length > 280
      ? `${bond.serviceDescription.slice(0, 277)}...`
      : bond.serviceDescription;
    line('Service Description: ', summary);
    line('Date of Completion: ', bond.completionDate);
    heading('PAYMENT DECLARATION');
    line('Total Agreed Amount: ', money(bond.totalAmount), true);
    line('Amount Paid (Advance/Partial): ', money(bond.amountPaid));
    line('Remaining Balance Due: ', money(bond.remainingAmount), true);
    heading('PROMISE TO PAY & DUE DATE');
    paragraph(`The Customer, ${bond.customerName}, records their acceptance of the obligation to pay the remaining balance of ${money(bond.remainingAmount)} to the Owner, ${bond.ownerName}, on or before the due date of ${bond.dueDate}.`);
    heading('DIGITAL AUTHENTICATION');
    paragraph('The QR code at the top of this page opens the public RigDesk verification record. Any change to the signed booking summary causes verification to fail.');
    line('Timestamp of Acceptance: ', bond.acceptanceTimestamp);
    line('Record Fingerprint: ', digest.slice(0, 32), true);

    doc.addPage();
    y = 20;
    heading('DEFAULT AND LEGAL ACTION CLAUSE');
    paragraph(`If the Customer fails to clear the remaining balance of ${money(bond.remainingAmount)} by ${bond.dueDate}, the Customer acknowledges a breach of the recorded service agreement. This Digital Bond may be produced as evidentiary proof of the recorded debt, subject to applicable law and judicial acceptance.`);
    heading('DOCUMENT INTEGRITY NOTICE');
    paragraph('This document is automatically generated and secured by RigDesk Marketplace from the booking and acceptance record. It is permission-protected against modification; no PDF control can prevent screenshots or guarantee legal enforceability by itself. The public QR verification result confirms the signed booking summary only.');
    heading('FULL SERVICE RECORD');
    paragraph(bond.serviceDescription);
    paragraph('Private customer contact and network details are retained outside the public verification record.');

    for (let page = 1; page <= doc.getNumberOfPages(); page += 1) {
      doc.setPage(page);
      doc.setTextColor(220, 220, 220);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(24);
      doc.text(`RIGDESK SECURE - ${bond.bookingId}`, pageWidth / 2, pageHeight / 2, { align: 'center', angle: 38 });
      doc.setTextColor(120, 130, 133);
      doc.setFontSize(7);
      doc.text(`RigDesk secure bond | Page ${page} of ${doc.getNumberOfPages()} | ${digest.slice(0, 24)}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
    }

    const bytes = Buffer.from(doc.output('arraybuffer'));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="RigDesk-Bond-${bond.bookingId.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf"`);
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('X-RigDesk-Bond-Digest', digest);
    return res.status(200).send(bytes);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to generate bond.';
    return res.status(400).json({ error: message });
  }
}
