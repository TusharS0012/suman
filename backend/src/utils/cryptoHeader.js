import crypto from 'crypto';

/**
 * Header layout:
 * 0-3: ASCII 'STG1' (4 bytes)
 * 4: flags (1 byte) -> bit0 = encrypted
 * 5-8: payloadLength (uint32 BE)  (4 bytes)
 * 9-40: sha256 of plaintext (32 bytes)
 * if encrypted:
 * 41-56: salt (16 bytes)
 * 57-68: iv (12 bytes)
 * 69-84: authTag (16 bytes)
 *
 * Total header sizes:
 *  - not encrypted: 41 bytes
 *  - encrypted: 85 bytes
 */

function buildHeader({ payloadLength, encrypted = false, salt, iv, authTag }, plaintextBuffer) {
  const magic = Buffer.from('STG1');
  const flags = Buffer.from([encrypted ? 1 : 0]);
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(payloadLength, 0);
  const sha = crypto.createHash('sha256').update(plaintextBuffer).digest();
  let headerParts = [magic, flags, lenBuf, sha];
  if (encrypted) {
    if (!salt || !iv || !authTag) throw new Error('salt/iv/authTag required for encrypted header');
    headerParts.push(salt, iv, authTag);
  }
  const headerBuffer = Buffer.concat(headerParts);
  return { headerBuffer, headerSize: headerBuffer.length };
}

function parseHeader(buf) {
  if (buf.length < 41) throw new Error('Header buffer too short');
  const magic = buf.slice(0, 4).toString('ascii');
  if (magic !== 'STG1') throw new Error('Invalid magic');
  const flags = buf.readUInt8(4);
  const encrypted = (flags & 1) === 1;
  const payloadLength = buf.readUInt32BE(5);
  const sha = buf.slice(9, 41);
  if (!encrypted) {
    return { encrypted: false, payloadLength, sha256: sha, headerSize: 41 };
  } else {
    if (buf.length < 85) {
      // caller may call parseHeader on partial header; report headerSize so caller can read more
      return { encrypted: true, payloadLength, sha256: sha, headerSize: 85 };
    }
    const salt = buf.slice(41, 57);
    const iv = buf.slice(57, 69);
    const authTag = buf.slice(69, 85);
    return { encrypted: true, payloadLength, sha256: sha, headerSize: 85, salt, iv, authTag };
  }
}

function encryptWithPassphrase(plaintextBuf, passphrase) {
  const salt = crypto.randomBytes(16);
  const key = crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintextBuf), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext, salt, iv, authTag };
}

function decryptWithPassphrase(ciphertext, passphrase, salt, iv, authTag) {
  const key = crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
  const dec = crypto.createDecipheriv('aes-256-gcm', key, iv);
  dec.setAuthTag(authTag);
  const plaintext = Buffer.concat([dec.update(ciphertext), dec.final()]);
  return plaintext;
}

export {
  buildHeader,
  parseHeader,
  encryptWithPassphrase,
  decryptWithPassphrase
};