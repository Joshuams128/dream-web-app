import type { BusinessInfo, ClientInfo } from "./types";
import { money, sqft as fmtSqft } from "./format";

/** One scope-of-work line on the invoice — typically one per section. */
export interface InvoiceLine {
  /** What the work is, e.g. "Living room — Red oak hardwood". */
  description: string;
  area: number;
  rate: number; // firm per-sq-ft rate for this line
}

export interface InvoiceData {
  business: BusinessInfo;
  client: ClientInfo;
  /** Job-site / service address (may differ from billing address). */
  serviceAddress: string;
  invoiceNumber: string;
  dateLabel: string;
  lines: InvoiceLine[];
  /** Notes & disclaimer text printed at the bottom of the PDF. */
  notes: string;
  contingencyPct: number;
  hstPct: number;
}

export interface InvoiceTotals {
  subtotal: number;
  contingency: number;
  hst: number;
  total: number;
}

/** Amount for a single line: area × rate. */
export function lineAmount(line: InvoiceLine): number {
  return line.area * line.rate;
}

/** Firm (single-value) totals for an invoice, summed across every line. */
export function invoiceTotals(
  lines: InvoiceLine[],
  contingencyPct: number,
  hstPct: number,
): InvoiceTotals {
  const subtotal = lines.reduce((sum, l) => sum + lineAmount(l), 0);
  const contingency = subtotal * (contingencyPct / 100);
  const base = subtotal + contingency;
  const hst = base * (hstPct / 100);
  return { subtotal, contingency, hst, total: base + hst };
}

/** Load a public-folder image as a base64 data URL for jsPDF. */
async function loadBase64(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

/**
 * Render the invoice to a PDF and trigger a download. jsPDF + autotable are
 * dynamically imported so they only load when the user actually exports.
 *
 * Layout mirrors the Dream Build Group estimate template:
 *   Logo (top-left) · ESTIMATE (top-right)
 *   Estimate # / Date / HST# / Service address (left) · Bill To (right)
 *   ── divider ──
 *   SCOPE OF WORK table with line items
 *   Contingency / Subtotal / HST / TOTAL totals block
 *   NOTES & DISCLAIMER
 *   "Thank you for your business!" footer band
 */
export async function exportInvoicePdf(data: InvoiceData): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const logoBase64 = await loadBase64("/imgs/logo-2.png");

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const L = 15; // left margin
  const R = pageW - 15; // right edge
  const midX = pageW / 2;

  // ── Logo ──────────────────────────────────────────────────────────────────
  const LOGO_SIZE = 32;
  let logoBottomY = 12;
  if (logoBase64) {
    doc.addImage(logoBase64, "PNG", L, 8, LOGO_SIZE, LOGO_SIZE);
    logoBottomY = 8 + LOGO_SIZE + 2;
  }

  // ── "ESTIMATE" title (top-right) ──────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(20, 20, 20);
  doc.text("ESTIMATE", R, 26, { align: "right" });

  // ── Top divider ───────────────────────────────────────────────────────────
  const divY1 = Math.max(logoBottomY, 36);
  doc.setDrawColor(170, 165, 160);
  doc.setLineWidth(0.5);
  doc.line(L, divY1, R, divY1);

  // ── Meta block (left column | right column) ───────────────────────────────
  const metaTop = divY1 + 5.5;
  const rightColX = midX + 4;
  let leftY = metaTop;
  let rightY = metaTop;

  const boldText = (text: string, x: number, y: number, align?: "right") => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text(text, x, y, align ? { align } : undefined);
  };
  const normalText = (text: string, x: number, y: number, align?: "right") => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    doc.text(text, x, y, align ? { align } : undefined);
  };

  // Left: Estimate # and Date
  boldText("Estimate #:", L, leftY);
  normalText(data.invoiceNumber, L + 26, leftY);
  leftY += 5.5;

  boldText("Date:", L, leftY);
  normalText(data.dateLabel, L + 26, leftY);
  leftY += 7;

  // Left: HST#
  const hstLine = data.business.hstNumber
    ? `HST#   ${data.business.hstNumber}`
    : "HST#";
  boldText(hstLine, L, leftY);
  leftY += 5.5;

  // Left: Service(s)
  boldText("Service(s):", L, leftY);
  leftY += 5;
  const serviceAddr = data.serviceAddress || data.business.address || "";
  if (serviceAddr) {
    // Wrap long addresses
    const addrLines = doc.splitTextToSize(serviceAddr, midX - L - 8) as string[];
    normalText(addrLines.join("\n"), L, leftY);
    leftY += addrLines.length * 4.5 + 1;
  }

  // Right: BILL TO
  boldText("BILL TO:", rightColX, rightY);
  rightY += 5.5;

  if (data.client.name) {
    boldText("Name:", rightColX, rightY);
    normalText(data.client.name, rightColX + 17, rightY);
    rightY += 4.5;
  }
  if (data.client.address) {
    boldText("Address:", rightColX, rightY);
    const addrLines = doc.splitTextToSize(data.client.address, R - rightColX - 28) as string[];
    normalText(addrLines[0], rightColX + 21, rightY);
    if (addrLines.length > 1) {
      rightY += 4.5;
      normalText(addrLines.slice(1).join(" "), rightColX + 21, rightY);
    }
    rightY += 4.5;
  }
  if (data.client.email) {
    boldText("Email/Phone:", rightColX, rightY);
    normalText(data.client.email, rightColX + 29, rightY);
    rightY += 4.5;
  }

  // ── Second divider ────────────────────────────────────────────────────────
  const divY2 = Math.max(leftY, rightY) + 4;
  doc.line(L, divY2, R, divY2);

  // ── SCOPE OF WORK header ──────────────────────────────────────────────────
  const scopeY = divY2 + 6;
  boldText("SCOPE OF WORK", L, scopeY);

  // ── Line items table ──────────────────────────────────────────────────────
  const t = invoiceTotals(data.lines, data.contingencyPct, data.hstPct);
  const body = data.lines.map((l, i) => [
    i + 1,
    l.description || "Work",
    `${fmtSqft(l.area)} sq ft @ ${money(l.rate)}/sq ft`,
    money(lineAmount(l)),
  ]);

  autoTable(doc, {
    startY: scopeY + 4,
    head: [["ITEM", "Description", "Quantity", "Amount"]],
    body,
    theme: "plain",
    headStyles: {
      fillColor: [238, 233, 227],
      textColor: [25, 25, 25],
      fontStyle: "bold",
      fontSize: 9,
      lineWidth: { bottom: 0.4 },
      lineColor: [160, 155, 150],
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [45, 45, 45],
      lineColor: [205, 200, 195],
      lineWidth: { bottom: 0.2 },
      valign: "top",
      minCellHeight: 12,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 14 },
      1: { cellWidth: "auto" },
      2: { halign: "right", cellWidth: 55 },
      3: { halign: "right", cellWidth: 28 },
    },
    margin: { left: L, right: 15 },
  });

  // ── Totals block (right-aligned) ──────────────────────────────────────────
  let tY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  const labelX = R - 55;
  const rowH = 6;

  const totRow = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 10 : 9);
    doc.setTextColor(bold ? 20 : 70, bold ? 20 : 70, bold ? 20 : 70);
    doc.text(label, labelX, tY);
    doc.text(value, R, tY, { align: "right" });
    tY += bold ? rowH + 1 : rowH;
  };

  if (data.contingencyPct > 0) {
    totRow(`Contingency ${data.contingencyPct}%`, money(t.contingency));
  }
  totRow("Subtotal:", money(t.subtotal + t.contingency));
  totRow(`HST (${data.hstPct}%):`, money(t.hst));

  // TOTAL — highlighted band
  doc.setFillColor(235, 229, 220);
  doc.rect(labelX - 4, tY - 5, R - labelX + 4, rowH + 3, "F");
  totRow("TOTAL:", money(t.total), true);

  // ── Notes & Disclaimer ────────────────────────────────────────────────────
  if (data.notes && data.notes.trim()) {
    const notesTop = tY + 8;
    // Leave at least 30mm for the footer
    if (notesTop < pageH - 32) {
      boldText("NOTES & DISCLAIMER:", L, notesTop);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(60, 60, 60);
      const wrapped = doc.splitTextToSize(data.notes.trim(), R - L) as string[];
      doc.text(wrapped, L, notesTop + 5.5);
    }
  }

  // ── Footer band ───────────────────────────────────────────────────────────
  doc.setFillColor(235, 229, 220);
  doc.rect(L, pageH - 18, R - L, 11, "F");
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(80, 70, 60);
  doc.text("Thank you for your business!", midX, pageH - 11, { align: "center" });

  doc.save(`Invoice-${data.invoiceNumber || "draft"}.pdf`);
}
