const crypto = require('crypto');

function hashPassword(pw) {
  return crypto.createHash('sha256').update(pw).digest('hex');
}

function checkPassword(pw, hash) {
  return hashPassword(pw) === hash;
}

module.exports = { hashPassword, checkPassword };
