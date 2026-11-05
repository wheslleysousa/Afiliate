'use strict';
// A taxa definida no app se aplica a produtos por hora, por campanha.
// Cada produto pode gerar uma publicação em cada destino da campanha.
// Campanhas legadas sem productsPerHour mantêm seu comportamento original.
const HOUR_MS = 60 * 60 * 1000;

function readHourlyRate(campaign) {
  if (campaign?.productsPerHour == null) return null;
  const rate = Number(campaign.productsPerHour);
  if (!Number.isInteger(rate) || rate < 1 || rate > 500) return null;
  return rate;
}

function buildHourlyOffsets(rate, pacing = 'uniforme', random = Math.random) {
  if (!Number.isInteger(rate) || rate < 1 || rate > 500) {
    throw new RangeError('Produtos por hora deve ser um inteiro entre 1 e 500.');
  }
  const slot = HOUR_MS / rate;
  // Um produto por fatia da hora. Aleatório movimenta cada publicação
  // dentro da própria fatia, sem empurrá-la para a hora seguinte.
  return Array.from({ length: rate }, (_, i) => {
    const jitter = pacing === 'aleatorio'
      ? (0.1 + 0.8 * Math.max(0, Math.min(1, Number(random()) || 0)))
      : 0;
    return Math.floor((i + jitter) * slot);
  });
}

module.exports = { HOUR_MS, readHourlyRate, buildHourlyOffsets };
