import React, { useState } from "react";
import {
  FileText,
  X,
  Download,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Copy,
  Check,
  ExternalLink,
  Building2,
  User,
  Calendar,
  IndianRupee,
  Clock,
  Printer,
} from "lucide-react";
import { generateBondPdf, BondPayload } from "@/lib/bond-generator";

export interface BondPaperModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingData: Partial<BondPayload>;
  onPaymentCleared?: () => void;
}

export const BondPaperModal: React.FC<BondPaperModalProps> = ({
  isOpen,
  onClose,
  bookingData,
  onPaymentCleared,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [simulatedPaid, setSimulatedPaid] = useState(false);

  if (!isOpen) return null;

  const totalAmount = bookingData.totalAmount ?? 50000;
  const initialPaid = bookingData.amountPaid ?? 15000;
  const currentPaid = simulatedPaid ? totalAmount : initialPaid;
  const currentRemaining = totalAmount - currentPaid;
  const isFullyPaid = currentRemaining <= 0;

  const bookingId = bookingData.bookingId || "RLX-2026-88912";
  const dateGenerated = bookingData.dateGenerated || new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const ownerName = bookingData.ownerName || "Northline Earthworks & Equipment Co.";
  const ownerContact = bookingData.ownerContact || "+91 98765 43210 (Verified Owner)";
  const customerName = bookingData.customerName || "Arjun Rao (Contractor)";
  const customerContact = bookingData.customerContact || "+91 91234 56789";
  const serviceDescription = bookingData.serviceDescription || "Heavy Excavator Foundation & Trenching Operations";
  const completionDate = bookingData.completionDate || "22 Sep 2026";
  const dueDate = bookingData.dueDate || "05 Oct 2026";
  const customerIpAddress = bookingData.customerIpAddress || "192.168.1.79";
  const acceptanceTimestamp = bookingData.acceptanceTimestamp || new Date().toLocaleString("en-IN");

  const verifyUrl = `https://riglogix-marketplace-4e0iya9qu-rig-logi-x.vercel.app/verify/${bookingId}`;

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const payload: BondPayload = {
        bookingId,
        dateGenerated,
        ownerName,
        ownerContact,
        customerName,
        customerContact,
        serviceDescription,
        completionDate,
        totalAmount,
        amountPaid: currentPaid,
        remainingAmount: currentRemaining,
        dueDate,
        customerIpAddress,
        acceptanceTimestamp,
      };
      const pdfBytes = await generateBondPdf(payload);
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `${isFullyPaid ? "No-Dues-Certificate" : "Digital-Payment-Bond"}-${bookingId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Download error:", err);
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(verifyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePayBalance = () => {
    setSimulatedPaid(true);
    if (onPaymentCleared) onPaymentCleared();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-5 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl bg-[#18303a] p-1 shadow-2xl text-[#f6f3ea] border border-[#ee8b18]/40">
        
        {/* Top Header Bar */}
        <div className="flex items-center justify-between bg-[#264752] px-6 py-4 rounded-t-[22px] border-b border-[#36505a]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ee8b18] text-white shadow-md">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Official Digital Legal Bond Viewer
                <span className={`text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full ${isFullyPaid ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-amber-500/20 text-amber-300 border border-amber-500/30"}`}>
                  {isFullyPaid ? "Fully Cleared" : "Outstanding Balance Due"}
                </span>
              </h3>
              <p className="text-xs text-[#a9d9d1] mono">
                Doc Ref: {bookingId} · Verified Cryptographic Proof
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isFullyPaid && (
              <button
                type="button"
                onClick={handlePayBalance}
                className="hidden sm:flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 text-xs font-bold transition-all shadow-sm"
              >
                <CheckCircle2 size={15} />
                <span>Clear Dues (Simulate Payment)</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#18303a] text-[#a9d9d1] hover:bg-red-900/40 hover:text-white transition-all"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Bond Document Paper Frame */}
        <div className="p-4 sm:p-8 bg-[#18303a]">
          <div className="relative mx-auto max-w-3xl overflow-hidden rounded-2xl bg-[#faf8f2] p-6 sm:p-10 text-[#18303a] shadow-2xl border-4 border-[#e5dec9]">
            
            {/* Stamp Paper Top Header */}
            <div className="relative border-b-2 border-double border-[#8c7441] pb-6 text-center">
              
              {/* Background Diagonal Watermark */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.07] select-none rotate-[-25deg]">
                <span className="text-5xl font-extrabold uppercase tracking-widest text-[#18303a]">
                  RIGLOGIX SECURE · {bookingId}
                </span>
              </div>

              {/* Emblem & Title Header */}
              <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-[#8c7441]/15 text-[#8c7441] border border-[#8c7441]/40">
                <ShieldCheck size={32} />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#8c7441]">
                Republic of India · Digital Legal Evidence Framework
              </p>
              <h1 className="display mt-1 text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-[#18303a]">
                {isFullyPaid ? "NO-DUES CERTIFICATE & SERVICE COMPLETION BOND" : "DIGITAL SERVICE & PAYMENT BOND"}
              </h1>
              <p className="mt-1 text-xs text-[#68777b]">
                Platform Verification:{" "}
                <a
                  href={verifyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[#ee8b18] hover:underline"
                >
                  {verifyUrl}
                </a>
              </p>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 bg-[#f0ebd9] px-4 py-2 rounded-xl text-xs font-semibold text-[#54482c]">
                <span>Document ID: <strong className="mono font-bold text-[#18303a]">{bookingId}</strong></span>
                <span>Issuance Date: <strong className="text-[#18303a]">{dateGenerated}</strong></span>
                <span>Status: <strong className={isFullyPaid ? "text-emerald-700" : "text-amber-700"}>{isFullyPaid ? "RELEASED & CLEARED" : "ACTIVE BINDING DEBT"}</strong></span>
              </div>
            </div>

            {/* Content Sections */}
            <div className="mt-6 space-y-6 text-xs sm:text-sm leading-relaxed">
              
              {/* Parties Grid */}
              <div className="grid gap-4 sm:grid-cols-2 rounded-xl border border-[#e0d6bd] bg-[#fdfcf7] p-4">
                <div className="border-b sm:border-b-0 sm:border-r border-[#e0d6bd] pb-3 sm:pb-0 sm:pr-4">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase text-[#8c7441]">
                    <Building2 size={14} /> The Owner (Service Provider)
                  </p>
                  <p className="mt-1 font-bold text-sm text-[#18303a]">{ownerName}</p>
                  <p className="text-xs text-[#526169] mt-0.5">{ownerContact}</p>
                </div>
                <div className="sm:pl-2">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase text-[#8c7441]">
                    <User size={14} /> The Customer (Client)
                  </p>
                  <p className="mt-1 font-bold text-sm text-[#18303a]">{customerName}</p>
                  <p className="text-xs text-[#526169] mt-0.5">{customerContact}</p>
                </div>
              </div>

              {/* Service Rendered */}
              <div className="rounded-xl border border-[#e0d6bd] bg-[#fdfcf7] p-4">
                <p className="text-xs font-bold uppercase text-[#8c7441]">Service Details & Execution</p>
                <p className="mt-1 font-semibold text-[#18303a]">{serviceDescription}</p>
                <p className="mt-1 text-xs text-[#526169]">
                  Date of Work Completion: <strong>{completionDate}</strong>
                </p>
              </div>

              {/* Financial & Payment Breakdown Box */}
              <div className={`rounded-2xl border-2 p-5 ${isFullyPaid ? "border-emerald-500/40 bg-emerald-50/50" : "border-amber-500/40 bg-amber-50/50"}`}>
                <div className="flex items-center justify-between border-b border-[#d8cdb0] pb-3">
                  <span className="font-bold text-sm text-[#18303a]">Financial Payment Summary</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase ${isFullyPaid ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"}`}>
                    {isFullyPaid ? "Zero Dues Remaining" : "Payment Pending"}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white/80 p-3 rounded-xl border border-[#e0d6bd]">
                    <p className="text-[11px] font-bold text-[#68777b]">Agreed Total</p>
                    <p className="text-base sm:text-lg font-extrabold text-[#18303a]">₹{totalAmount.toLocaleString("en-IN")}</p>
                  </div>
                  <div className="bg-white/80 p-3 rounded-xl border border-[#e0d6bd]">
                    <p className="text-[11px] font-bold text-[#68777b]">Amount Paid</p>
                    <p className="text-base sm:text-lg font-extrabold text-emerald-700">₹{currentPaid.toLocaleString("en-IN")}</p>
                  </div>
                  <div className="bg-white/80 p-3 rounded-xl border border-[#e0d6bd]">
                    <p className="text-[11px] font-bold text-[#68777b]">Remaining Balance</p>
                    <p className={`text-base sm:text-lg font-extrabold ${isFullyPaid ? "text-emerald-700" : "text-red-700"}`}>
                      ₹{currentRemaining.toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Promise & Default Clauses */}
              {!isFullyPaid ? (
                <div className="rounded-xl border border-red-200 bg-red-50/60 p-4 text-xs text-[#6b1e11]">
                  <p className="font-bold uppercase flex items-center gap-1.5 text-red-800">
                    <AlertTriangle size={15} /> Promise to Pay & Legal Breach Notice
                  </p>
                  <p className="mt-2 leading-relaxed">
                    The Customer, <strong>{customerName}</strong>, hereby legally binds themselves to clear the outstanding balance of <strong>₹{currentRemaining.toLocaleString("en-IN")}</strong> to the Owner, <strong>{ownerName}</strong>, on or before <strong>{dueDate}</strong>.
                  </p>
                  <p className="mt-2 leading-relaxed font-medium">
                    <strong>DEFAULT CLAUSE:</strong> Failure to pay by <strong>{dueDate}</strong> constitutes a formal Breach of Contract under Indian contract laws. This document serves as primary evidentiary proof of debt in legal proceedings.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-xs text-emerald-900">
                  <p className="font-bold uppercase flex items-center gap-1.5 text-emerald-800">
                    <CheckCircle2 size={15} /> No Dues & Full Discharge Certificate
                  </p>
                  <p className="mt-1 leading-relaxed">
                    This certifies that the Customer has cleared all outstanding dues of <strong>₹{totalAmount.toLocaleString("en-IN")}</strong>. The Owner, <strong>{ownerName}</strong>, acknowledges full payment receipt and releases the Customer from further financial obligations for this booking.
                  </p>
                </div>
              )}

              {/* Authentication & Digital Signatures */}
              <div className="pt-4 border-t border-[#e0d6bd] grid sm:grid-cols-2 gap-4 items-end">
                <div className="text-[11px] text-[#68777b] space-y-1">
                  <p><strong>Customer IP Address:</strong> {customerIpAddress}</p>
                  <p><strong>Cryptographic Timestamp:</strong> {acceptanceTimestamp}</p>
                  <p><strong>Issuer:</strong> RigLogix Digital Contract Engine</p>
                </div>

                {/* QR Code Embed */}
                <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-[#e0d6bd] sm:justify-end">
                  <div className="bg-[#18303a] p-1.5 rounded-lg text-white">
                    <QrCode size={40} />
                  </div>
                  <div className="text-[10px] text-[#526169]">
                    <p className="font-bold text-[#18303a]">Scan to Verify</p>
                    <p>RigLogix Server Verified Copy</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Verified Stamp Overlay */}
            <div className="mt-6 text-center border-t border-dashed border-[#8c7441]/50 pt-4">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider ${isFullyPaid ? "bg-emerald-700 text-white" : "bg-[#18303a] text-amber-400"}`}>
                <ShieldCheck size={16} />
                {isFullyPaid ? "FULLY PAID & VERIFIED NO-DUES BOND" : "VALID & BINDING DIGITAL PAYMENT BOND"}
              </span>
            </div>

          </div>
        </div>

        {/* Action Controls Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#264752] px-6 py-4 rounded-b-[22px] border-t border-[#36505a]">
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center gap-2 rounded-xl bg-[#18303a] hover:bg-[#36505a] text-[#a9d9d1] px-4 py-2 text-xs font-bold transition-all"
          >
            {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
            <span>{copied ? "Verification Link Copied!" : "Copy Verification URL"}</span>
          </button>

          <div className="flex items-center gap-2">
            {!isFullyPaid && (
              <button
                type="button"
                onClick={handlePayBalance}
                className="sm:hidden flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 text-xs font-bold transition-all"
              >
                <CheckCircle2 size={15} />
                <span>Simulate Pay Dues</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="flex items-center gap-2 rounded-xl bg-[#ee8b18] hover:bg-[#d97d10] text-white px-5 py-2.5 text-xs font-bold transition-all shadow-md active:scale-95"
            >
              <Download size={16} />
              <span>{downloading ? "Generating PDF..." : "Download PDF Document"}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default BondPaperModal;
