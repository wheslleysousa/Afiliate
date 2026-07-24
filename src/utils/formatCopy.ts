import { ProductData } from "../types";

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
  // Regra: "sem juros" SÓ VAI APARECER se for verificado que o parcelamento é sem juros!
  let installmentLine: string | null = null;

  const rawInst = product.installments ? String(product.installments).trim() : "";
  const rawMaxSemJuros = product.max_installments_interest_free ? String(product.max_installments_interest_free).trim() : "";

  if (rawInst && rawInst !== "Apenas à vista" && !rawInst.toLowerCase().includes("não informado")) {
    let cleanInst = rawInst;
    if (cleanInst.toLowerCase().startsWith("ou ")) {
      cleanInst = cleanInst.slice(3).trim();
    }
    if (cleanInst.toLowerCase().startsWith("em ")) {
      cleanInst = cleanInst.slice(3).trim();
    }

    // Verificar se a extração confirmou explicitamente "sem juros"
    const isVerifiedSemJuros = cleanInst.toLowerCase().includes("sem juros") ||
      (rawMaxSemJuros && rawMaxSemJuros.toLowerCase().includes("sem juros"));

    if (isVerifiedSemJuros) {
      if (!cleanInst.toLowerCase().includes("sem juros")) {
        cleanInst = `${cleanInst} sem juros`;
      }
      installmentLine = cleanInst;
    } else {
      // Se NÃO tiver confirmação de "sem juros", mostra apenas a quantidade e o valor da parcela (sem a palavra "sem juros")
      installmentLine = cleanInst.replace(/sem juros/gi, "").trim();
    }
  } else if (rawMaxSemJuros && rawMaxSemJuros.toLowerCase().includes("sem juros")) {
    let cleanMax = rawMaxSemJuros;
    if (cleanMax.toLowerCase().startsWith("ou ")) cleanMax = cleanMax.slice(3).trim();
    if (cleanMax.toLowerCase().startsWith("em ")) cleanMax = cleanMax.slice(3).trim();
    installmentLine = cleanMax;
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
  lines.push(`🛍️ Compre aqui: ${product.original_link || ''}`);
  lines.push("");

  // 7. Footer Disclaimer
  lines.push("*Promoção sujeita a alteração a qualquer momento");

  return lines.join("\n");
}



