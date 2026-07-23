import { ProductData } from "../types";

export function formatCopy(product: ProductData): string {
  const lines: string[] = [];

  lines.push(product.title);
  lines.push("");

  if (product.price_from) {
    lines.push(`de R$ ${product.price_from}`);
  }

  lines.push(`por R$ ${product.price_to}`);

  if (product.installments) {
    lines.push(`💳 ou ${product.installments}`);
  }

  lines.push("");

  if (product.coupon) {
    lines.push(`🎟️ Use o cupom: ${product.coupon}`);
    lines.push("");
  }

  lines.push(`🛍️ Compre aqui: ${product.original_link}`);
  lines.push("");
  lines.push("*Promoção sujeita a alteração a qualquer momento");

  return lines.join("\n");
}
