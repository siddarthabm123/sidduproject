import React, { useState } from "react";
import { FileText, Download, Loader2, ShieldCheck } from "lucide-react";
import { generateBondPdf, BondPayload } from "@/lib/bond-generator";

export interface DownloadBondButtonProps {
  bookingData?: Partial<BondPayload>;
  className?: string;
  variant?: "primary" | "secondary" | "outline";
}

export const defaultBondData: BondPayload = {
  bookingId: "RLX-2026-88912",
  dateGenerated: "23 Sep 2026",
  ownerName: "Neeraj Singh (RigLogix Owner)",
  ownerContact: "+91 98765 43210 | neeraj@riglogix.in",
  customerName: "Arjun Rao (Contractor)",
  customerContact: "+91 91234 56789 | arjun@constructions.in",
  serviceDescription: "Heavy Earthmoving Excavator & Borewell Drilling Work",
  completionDate: "22 Sep 2026",
  totalAmount: 50000,
  amountPaid: 15000,
  remainingAmount: 35000,
  dueDate: "05 Oct 2026",
  customerIpAddress: "192.168.1.79",
  acceptanceTimestamp: new Date().toISOString(),
};

export const DownloadBondButton: React.FC<DownloadBondButtonProps> = ({
  bookingData,
  className = "",
  variant = "primary",
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload: BondPayload = {
        ...defaultBondData,
        ...bookingData,
        remainingAmount:
          bookingData?.remainingAmount ??
          (bookingData?.totalAmount && bookingData?.amountPaid !== undefined
            ? bookingData.totalAmount - bookingData.amountPaid
            : defaultBondData.remainingAmount),
      };

      // Generate PDF Uint8Array buffer
      const pdfBytes = await generateBondPdf(payload);

      // Create Blob & trigger forced download in browser
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `Digital-Payment-Bond-${payload.bookingId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      console.error("Failed to generate Digital Payment Bond PDF:", err);
      setError(err?.message || "Failed to generate PDF document.");
    } finally {
      setLoading(false);
    }
  };

  const baseStyles =
    "inline-flex items-center justify-center gap-2 rounded-xl font-bold text-xs transition-all px-4 py-2.5 shadow-sm";
  const variantStyles = {
    primary: "bg-[#ee8b18] text-white hover:bg-[#d97d10] active:scale-[0.98]",
    secondary: "bg-[#18303a] text-white hover:bg-[#264752] active:scale-[0.98]",
    outline:
      "border-2 border-[#ee8b18] text-[#ee8b18] bg-white hover:bg-[#fff7ed] active:scale-[0.98]",
  };

  return (
    <div className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={handleDownload}
        disabled={loading}
        className={`${baseStyles} ${variantStyles[variant]} ${className} ${
          loading ? "opacity-75 cursor-not-allowed" : ""
        }`}
        data-testid="button-download-bond"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            <span>Generating Secure Bond...</span>
          </>
        ) : (
          <>
            <ShieldCheck size={16} className="text-amber-300" />
            <FileText size={16} />
            <span>Download Digital Payment Bond (PDF)</span>
            <Download size={14} className="ml-1 opacity-80" />
          </>
        )}
      </button>

      {error && <span className="text-[11px] font-semibold text-red-600">{error}</span>}
    </div>
  );
};

export default DownloadBondButton;
