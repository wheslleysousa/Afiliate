'use strict';

// Arquiva uma sessão recusada em um diretório FORA de auth/.
// A pasta auth/ é escaneada automaticamente na inicialização do worker;
// por isso uma sessão recusada não deve permanecer nela e gerar um 401 a cada boot.
// Nada é apagado: o proprietário pode revisar/restaurar a cópia depois.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function archiveRejectedAuth(authBaseDir, sessionId) {
  if (typeof sessionId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(sessionId)) {
    throw new Error('Identificador de sessão inválido para arquivamento.');
  }
  const root = path.resolve(authBaseDir);
  const source = path.join(root, sessionId);
  if (!fs.existsSync(source)) return null;
  const stat = fs.lstatSync(source);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error('Caminho de autenticação não é um diretório regular.');
  }

  const archiveRoot = path.join(path.dirname(root), 'auth-rejected');
  fs.mkdirSync(archiveRoot, { recursive: true, mode: 0o700 });
  fs.chmodSync(archiveRoot, 0o700);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const nonce = crypto.randomBytes(4).toString('hex');
  const destination = path.join(archiveRoot, timestamp + '-' + nonce + '-' + sessionId);
  fs.renameSync(source, destination);
  return destination;
}

module.exports = { archiveRejectedAuth };
