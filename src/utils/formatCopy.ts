import { ProductData } from "../types";

export function extractCleanInstallmentsOnly(rawText: string, isSemJurosConfirmed: boolean): string | null {
  if (!rawText || typeof rawText !== 'string') return null;
  const lower = rawText.trim().toLowerCase();
  if (lower === "apenas à vista" || lower.includes("não informado") || lower.includes("à vista")) return null;

  const hasSemJuros = lower.includes("sem juros") || isSemJurosConfirmed;

  // Regex to match installment count and price per installment (e.g. "10x de R$ 25,00", "10x 25,00", "10x de 25")
  const regex = /(\d+)\s*x\s*(?:de\s*)?(?:R\$\s*)?([\d\.]+(?:,\d{2})?)/i;
  const match = rawText.match(regex);

  if (match && match[1] && match[2]) {
    const qty = match[1];
    let valStr = match[2].trim();
    if (!valStr.includes(',')) {
      valStr = valStr + ',00';
    }
    const formattedPart = `${qty}x de R$ ${valStr}`;
    return hasSemJuros ? `${formattedPart} sem juros` : formattedPart;
  }

  // Fallback cleanup if regex doesn't match standard pattern
  let clean = rawText.trim();
  if (clean.toLowerCase().includes("ou ")) {
    clean = clean.split(/ou /i).pop() || clean;
  }
  if (clean.toLowerCase().includes("em ")) {
    clean = clean.split(/em /i).pop() || clean;
  }
  clean = clean.trim();

  if (hasSemJuros) {
    if (!clean.toLowerCase().includes("sem juros")) {
      clean = `${clean} sem juros`;
    }
  } else {
    clean = clean.replace(/sem juros/gi, "").trim();
  }

  return clean || null;
}

export function formatCopy(product: ProductData): string {
  const lines: string[] = [];

  // 1. Title (Clean title without surrounding markdown or emojis)
  lines.push(product.title.trim());
  lines.push("");

  // 2. Price From (~de R$ X~ strikethrough for WhatsApp rendering)
  if (product.price_from && String(product.price_from).trim() && product.price_from !== product.price_to) {
    let cleanFrom = String(product.price_from).trim();
    if (cleanFrom.toLowerCase().startsWith("r$")) cleanFrom = cleanFrom.slice(2).trim();
    lines.push(`~de R$ ${cleanFrom}~`);
  }

  // 3. Price To (Valor à vista no Pix)
  let cleanTo = String(product.price_to || "Consulte no link").trim();
  if (cleanTo.toLowerCase().startsWith("r$")) cleanTo = cleanTo.slice(2).trim();
  lines.push(`por R$ ${cleanTo}`);

  // 4. Installments / Cartão de crédito
  // Regra: Exibir APENAS a quantidade e o valor da parcela (ex: "10x de R$ 25,00 sem juros" ou "10x de R$ 25,00")
  let installmentLine: string | null = null;
  const rawInst = product.installments ? String(product.installments).trim() : "";
  const rawMaxSemJuros = product.max_installments_interest_free ? String(product.max_installments_interest_free).trim() : "";

  const isVerifiedSemJuros = rawInst.toLowerCase().includes("sem juros") || 
                             (!!rawMaxSemJuros && rawMaxSemJuros.toLowerCase().includes("sem juros"));

  if (rawInst) {
    installmentLine = extractCleanInstallmentsOnly(rawInst, isVerifiedSemJuros);
  } else if (rawMaxSemJuros) {
    installmentLine = extractCleanInstallmentsOnly(rawMaxSemJuros, true);
  }

  if (installmentLine) {
    lines.push(`💳 ou ${installmentLine}`);
  }

  lines.push("");

  // 5. Coupon
  if (product.coupon && String(product.coupon).trim()) {
    lines.push(`🎟️ Use o cupom: ${String(product.coupon).trim()}`);
    lines.push("");
  }

  // 6. Link
  const targetLink = product.affiliate_link || product.original_link || '';
  lines.push(`🛍️ Compre aqui: ${targetLink}`);
  lines.push("");

  // 7. Footer Disclaimer
  lines.push("*Promoção sujeita a alteração a qualquer momento");

  return lines.join("\n");
}



