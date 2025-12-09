function encrypt(data, key) {
    // Simple encryption logic (for demonstration purposes)
    let encrypted = '';
    for (let i = 0; i < data.length; i++) {
        encrypted += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return encrypted;
}

function decrypt(encryptedData, key) {
    // Simple decryption logic (same as encryption)
    let decrypted = '';
    for (let i = 0; i < encryptedData.length; i++) {
        decrypted += String.fromCharCode(encryptedData.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return decrypted;
}

module.exports = {
    encrypt,
    decrypt
};