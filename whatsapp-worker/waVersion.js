'use strict';

/**
 * Resolução conservadora da versão atual do WhatsApp Web.
 * fetchLatestBaileysVersion() pode retornar uma versão de pacote obsoleta,
 * mesmo com isLatest=true. Não iniciar pareamento se a busca oficial falhar.
 */
async function getCurrentWaWebVersion(fetchWaWebVersion) {
  if (typeof fetchWaWebVersion !== 'function') {
    throw new Error('Biblioteca Baileys instalada não oferece fetchLatestWaWebVersion.');
  }
  const result = await fetchWaWebVersion();
  const version = result?.version;
  if (result?.isLatest !== true ||
      !Array.isArray(version) || version.length !== 3 ||
      !version.every(v => Number.isSafeInteger(v) && v > 0)) {
    throw new Error('Não foi possível confirmar a versão atual do WhatsApp Web.');
  }
  return version;
}
module.exports = { getCurrentWaWebVersion };
