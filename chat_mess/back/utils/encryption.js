const crypto = require('crypto');

const algorithm = "aes-256-cbc";
const IV_LENGTH = 16;

if (!process.env.ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY must be set in .env (64 hex chars = 32 bytes)');
}
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
if (ENCRYPTION_KEY.length !== 32) {
  throw new Error(`ENCRYPTION_KEY must be exactly 32 bytes (64 hex chars), got ${ENCRYPTION_KEY.length}`);
}

function encrypt(text) {
  if (!text) return "";
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(algorithm, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decrypt(encryptedText) {
  if (!encryptedText) return "";
  const [ivHex, encrypted] = encryptedText.split(":");
  if (!ivHex || !encrypted) return "";
  try {
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv(algorithm, ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.error("Decryption error:", err);
    return "";
  }
}

module.exports = {
  encrypt,
  decrypt
};