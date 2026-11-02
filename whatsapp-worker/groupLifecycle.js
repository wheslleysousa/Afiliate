'use strict';

// Reconciliacao de grupos por sessao: nunca remove os grupos de outra conta.
function staleGroupDocIds(sessionId, liveGroups, storedDocs) {
  if (!sessionId || !Array.isArray(liveGroups) || !Array.isArray(storedDocs)) {
    throw new Error('Snapshot de grupos invalido; nenhuma exclusao permitida.');
  }
  const live = new Set(liveGroups.filter(g => g && typeof g.id === 'string' && g.id.endsWith('@g.us'))
    .map(g => sessionId + '_' + g.id));
  return storedDocs.filter(d => d && d.id && d.sessionId === sessionId && !live.has(d.id)).map(d => d.id);
}

function validateGroupAction(command) {
  if (!command || typeof command !== 'object' || !command.sessionId ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(command.sessionId)) {
    throw new Error('Selecione uma conta conectada do WhatsApp.');
  }
  if (command.action === 'leaveGroup') {
    if (typeof command.groupId !== 'string' || !/^[0-9-]+@g\.us$/.test(command.groupId)) {
      throw new Error('Identificador do grupo invalido.');
    }
    return;
  }
  if (command.action === 'createGroup') {
    if (command.type && command.type !== 'group') {
      throw new Error('Esta versao do worker cria somente grupos comuns. Comunidades e canais nao sao suportados.');
    }
    if (typeof command.name !== 'string' || !command.name.trim() || command.name.trim().length > 100) {
      throw new Error('Informe um nome de grupo com ate 100 caracteres.');
    }
    if (!Array.isArray(command.participants) || command.participants.length > 30) {
      throw new Error('Maximo de 30 contatos na criacao; sem adicao em massa.');
    }
    return;
  }
  throw new Error('Acao de grupo nao suportada.');
}
module.exports = { staleGroupDocIds, validateGroupAction };
