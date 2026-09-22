import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import QRCode from "qrcode";

export interface BondPayload {
  bookingId: string;
  dateGenerated: string;
  ownerName: string;
  ownerContact: string;
  customerName: string;
  customerContact: string;
  serviceDescription: string;
  completionDate: string;
  totalAmount: number;
  amountPaid: number;
  remainingAmount: number;
  dueDate: string;
  customerIpAddress: string;
  acceptanceTimestamp: string;
}

/**
 * Generates a secure, read-only PDF Digital Service & Payment Bond.
 */
export async function generateBondPdf(payload: BondPayload): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 Size (points)
  const { width, height } = page.getSize();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Color Palette
  const primaryColor = rgb(0.09, 0.19, 0.23); // Dark Navy #18303a
  const accentColor = rgb(0.93, 0.55, 0.09); // Orange #ee8b18
  const textDark = rgb(0.1, 0.15, 0.18);
  const textMuted = rgb(0.35, 0.42, 0.45);
  const bgLight = rgb(0.96, 0.95, 0.92); // Cream background
  const borderLight = rgb(0.85, 0.82, 0.76);
  const dangerColor = rgb(0.72, 0.18, 0.12);

  // 1. Diagonal Watermark Across Page
  const watermarkText = `RIGLOGIX SECURE - ${payload.bookingId.toUpperCase()}`;
  page.drawText(watermarkText, {
    x: 40,
    y: height / 2 - 40,
    size: 26,
    font: fontBold,
    color: rgb(0.88, 0.88, 0.88),
    rotate: degrees(38),
    opacity: 0.65,
  });

  // Page Border Frame
  page.drawRectangle({
    x: 20,
    y: 20,
    width: width - 40,
    height: height - 40,
    borderWidth: 2,
    borderColor: primaryColor,
  });
  page.drawRectangle({
    x: 24,
    y: 24,
    width: width - 48,
    height: height - 48,
    borderWidth: 0.75,
    borderColor: accentColor,
  });

  let currentY = height - 60;

  // 2. Header Banner
  page.drawRectangle({
    x: 35,
    y: currentY - 45,
    width: width - 70,
    height: 55,
    color: primaryColor,
  });

  page.drawText("RIGLOGIX MARKETPLACE", {
    x: 50,
    y: currentY - 18,
    size: 11,
    font: fontBold,
    color: accentColor,
  });

  page.drawText("DIGITAL SERVICE & PAYMENT BOND", {
    x: 50,
    y: currentY - 38,
    size: 16,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  currentY -= 65;

  // Metadata Subheader
  page.drawText(`Document Ref ID: ${payload.bookingId}`, {
    x: 35,
    y: currentY,
    size: 10,
    font: fontBold,
    color: textDark,
  });
  page.drawText(`Date of Issuance: ${payload.dateGenerated}`, {
    x: width - 210,
    y: currentY,
    size: 10,
    font: fontRegular,
    color: textMuted,
  });

  currentY -= 15;
  const verifyUrl = `https://riglogix-marketplace-4e0iya9qu-rig-logi-x.vercel.app/verify/${payload.bookingId}`;
  page.drawText(`Verification Link: ${verifyUrl}`, {
    x: 35,
    y: currentY,
    size: 8.5,
    font: fontRegular,
    color: rgb(0.1, 0.45, 0.65),
  });

  currentY -= 15;
  page.drawLine({
    start: { x: 35, y: currentY },
    end: { x: width - 35, y: currentY },
    thickness: 1,
    color: borderLight,
  });

  // Helper for Section Titles
  const drawSectionTitle = (title: string, yPos: number) => {
    page.drawRectangle({
      x: 35,
      y: yPos - 18,
      width: width - 70,
      height: 22,
      color: bgLight,
    });
    page.drawText(title.toUpperCase(), {
      x: 45,
      y: yPos - 13,
      size: 10,
      font: fontBold,
      color: primaryColor,
    });
  };

  // 3. Parties Details (Owner & Customer Side-by-Side)
  currentY -= 25;
  drawSectionTitle("Parties to this Agreement", currentY);
  currentY -= 32;

  // Owner Column (Left)
  page.drawText("THE OWNER (Service Provider):", {
    x: 45,
    y: currentY,
    size: 9.5,
    font: fontBold,
    color: textDark,
  });
  page.drawText(`Name: ${payload.ownerName}`, {
    x: 45,
    y: currentY - 14,
    size: 9,
    font: fontRegular,
    color: textDark,
  });
  page.drawText(`Contact: ${payload.ownerContact}`, {
    x: 45,
    y: currentY - 26,
    size: 9,
    font: fontRegular,
    color: textMuted,
  });

  // Customer Column (Right)
  page.drawText("THE CUSTOMER (Client):", {
    x: width / 2 + 10,
    y: currentY,
    size: 9.5,
    font: fontBold,
    color: textDark,
  });
  page.drawText(`Name: ${payload.customerName}`, {
    x: width / 2 + 10,
    y: currentY - 14,
    size: 9,
    font: fontRegular,
    color: textDark,
  });
  page.drawText(`Contact: ${payload.customerContact}`, {
    x: width / 2 + 10,
    y: currentY - 26,
    size: 9,
    font: fontRegular,
    color: textMuted,
  });

  currentY -= 42;

  // 4. Service Details Section
  drawSectionTitle("Service Details", currentY);
  currentY -= 32;

  page.drawText(`Booking Reference: ${payload.bookingId}`, {
    x: 45,
    y: currentY,
    size: 9,
    font: fontRegular,
    color: textDark,
  });
  page.drawText(`Service Description: ${payload.serviceDescription}`, {
    x: 45,
    y: currentY - 14,
    size: 9,
    font: fontRegular,
    color: textDark,
  });
  page.drawText(`Date of Completion: ${payload.completionDate}`, {
    x: 45,
    y: currentY - 28,
    size: 9,
    font: fontRegular,
    color: textDark,
  });

  currentY -= 44;

  // 5. Payment Declaration Section
  drawSectionTitle("Payment Declaration", currentY);
  currentY -= 32;

  // Box Container for Payment Summary
  page.drawRectangle({
    x: 35,
    y: currentY - 45,
    width: width - 70,
    height: 52,
    borderWidth: 1,
    borderColor: borderLight,
    color: rgb(0.99, 0.99, 0.98),
  });

  const colWidth = (width - 70) / 3;
  // Total Amount
  page.drawText("Total Agreed Amount", {
    x: 45,
    y: currentY - 15,
    size: 8.5,
    font: fontRegular,
    color: textMuted,
  });
  page.drawText(`INR ${payload.totalAmount.toLocaleString("en-IN")}`, {
    x: 45,
    y: currentY - 34,
    size: 12,
    font: fontBold,
    color: textDark,
  });

  // Amount Paid
  page.drawText("Amount Paid (Advance)", {
    x: 45 + colWidth,
    y: currentY - 15,
    size: 8.5,
    font: fontRegular,
    color: textMuted,
  });
  page.drawText(`INR ${payload.amountPaid.toLocaleString("en-IN")}`, {
    x: 45 + colWidth,
    y: currentY - 34,
    size: 12,
    font: fontBold,
    color: rgb(0.1, 0.55, 0.25),
  });

  // Remaining Balance Due
  page.drawText("Remaining Balance Due", {
    x: 45 + colWidth * 2,
    y: currentY - 15,
    size: 8.5,
    font: fontBold,
    color: dangerColor,
  });
  page.drawText(`INR ${payload.remainingAmount.toLocaleString("en-IN")}`, {
    x: 45 + colWidth * 2,
    y: currentY - 34,
    size: 13,
    font: fontBold,
    color: dangerColor,
  });

  currentY -= 62;

  // 6. Promise to Pay & Due Date Clause
  drawSectionTitle("Promise to Pay & Strict Due Date", currentY);
  currentY -= 28;

  const promiseText = `The Customer, ${payload.customerName}, hereby legally binds themselves to pay the remaining balance of INR ${payload.remainingAmount.toLocaleString("en-IN")} to the Owner, ${payload.ownerName}, on or before the strict due date of: ${payload.dueDate}.`;
  
  page.drawText(promiseText, {
    x: 45,
    y: currentY,
    size: 9,
    font: fontBold,
    color: primaryColor,
    maxWidth: width - 90,
    lineHeight: 13,
  });

  currentY -= 36;

  // 7. Default and Legal Action Clause
  drawSectionTitle("Default and Legal Action Clause", currentY);
  currentY -= 28;

  const legalText = `If the Customer fails to clear the remaining balance of INR ${payload.remainingAmount.toLocaleString("en-IN")} by ${payload.dueDate}, the Customer acknowledges that they are in Breach of Contract. The Customer authorizes the Owner to use this Digital Bond as primary evidentiary proof of debt in a court of law to initiate civil or criminal legal proceedings for the recovery of dues.`;

  page.drawText(legalText, {
    x: 45,
    y: currentY,
    size: 8.5,
    font: fontRegular,
    color: textDark,
    maxWidth: width - 90,
    lineHeight: 12,
  });

  currentY -= 55;

  // 8. Digital Authentication & QR Code Footer
  drawSectionTitle("Digital Authentication & Verification", currentY);
  currentY -= 28;

  page.drawText(`This document is automatically generated and secured by RigLogix Marketplace.`, {
    x: 45,
    y: currentY,
    size: 8.5,
    font: fontRegular,
    color: textMuted,
  });
  page.drawText(`Customer IP Address: ${payload.customerIpAddress}`, {
    x: 45,
    y: currentY - 14,
    size: 8.5,
    font: fontBold,
    color: textDark,
  });
  page.drawText(`Timestamp of Acceptance: ${payload.acceptanceTimestamp}`, {
    x: 45,
    y: currentY - 28,
    size: 8.5,
    font: fontBold,
    color: textDark,
  });

  // Generate QR Code PNG
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    margin: 1,
    width: 90,
    color: {
      dark: "#18303a",
      light: "#ffffff",
    },
  });

  const qrImageBytes = Buffer.from(qrDataUrl.split(",")[1], "base64");
  const qrImage = await pdfDoc.embedPng(qrImageBytes);

  // Draw QR Code on the Right
  const qrSize = 75;
  page.drawImage(qrImage, {
    x: width - 125,
    y: currentY - 45,
    width: qrSize,
    height: qrSize,
  });

  page.drawText("Scan to verify the unaltered", {
    x: width - 150,
    y: currentY - 56,
    size: 7,
    font: fontRegular,
    color: textMuted,
  });
  page.drawText("original copy on RigLogix.", {
    x: width - 150,
    y: currentY - 65,
    size: 7,
    font: fontRegular,
    color: textMuted,
  });

  // Footer Disclaimer line
  page.drawText("CONFIDENTIAL & LEGALLY BINDING — GENERATED VIA RIGLOGIX DIGITAL BOND ENGINE", {
    x: width / 2 - 190,
    y: 30,
    size: 7,
    font: fontBold,
    color: textMuted,
  });

  return await pdfDoc.save();
}
