import type { NextApiRequest, NextApiResponse } from "next";
import { generateBondPdf, BondPayload } from "../lib/bond-generator";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const payload: BondPayload = req.body;

    if (!payload.bookingId || !payload.customerName || !payload.ownerName) {
      return res.status(400).json({
        error: "Missing required booking details in request payload.",
      });
    }

    const pdfBuffer = await generateBondPdf(payload);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Digital-Payment-Bond-${payload.bookingId}.pdf`
    );
    res.setHeader("Content-Length", pdfBuffer.length);

    return res.status(200).send(Buffer.from(pdfBuffer));
  } catch (error: any) {
    console.error("Error generating digital bond PDF:", error);
    return res
      .status(500)
      .json({ error: error?.message || "Failed to generate PDF document" });
  }
}
