/**
 * Browser-compatible Agora RTC Token Generator
 * Uses Web Crypto API (SubtleCrypto) for HMAC-SHA256
 * 
 * This generates AccessToken v1 format tokens directly in the browser,
 * eliminating the need for a server-side token generator.
 */

const VERSION = "006";
const PRIVILEGE_JOIN_CHANNEL = 1;
const PRIVILEGE_PUBLISH_AUDIO = 2;
const PRIVILEGE_PUBLISH_VIDEO = 3;
const PRIVILEGE_PUBLISH_DATA = 4;

// CRC32 lookup table
const CRC32_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[i] = c;
    }
    return table;
})();

function crc32(str: string): number {
    const bytes = new TextEncoder().encode(str);
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) {
        crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function writeUint16LE(value: number): Uint8Array {
    const buf = new Uint8Array(2);
    buf[0] = value & 0xFF;
    buf[1] = (value >> 8) & 0xFF;
    return buf;
}

function writeUint32LE(value: number): Uint8Array {
    const buf = new Uint8Array(4);
    buf[0] = value & 0xFF;
    buf[1] = (value >> 8) & 0xFF;
    buf[2] = (value >> 16) & 0xFF;
    buf[3] = (value >> 24) & 0xFF;
    return buf;
}

function concatUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return result;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function stringToUint8Array(str: string): Uint8Array {
    return new TextEncoder().encode(str);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return copy.buffer;
}

async function hmacSha256(key: string, data: Uint8Array): Promise<Uint8Array> {
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        toArrayBuffer(stringToUint8Array(key)),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, toArrayBuffer(data));
    return new Uint8Array(signature);
}

function packMessage(salt: number, ts: number, privileges: Record<number, number>): Uint8Array {
    const keys = Object.keys(privileges);
    const parts: Uint8Array[] = [
        writeUint32LE(salt),
        writeUint32LE(ts),
        writeUint16LE(keys.length),
    ];
    
    for (const key of keys) {
        parts.push(writeUint16LE(Number(key)));
        parts.push(writeUint32LE(privileges[Number(key)]));
    }
    
    return concatUint8Arrays(...parts);
}

function packContent(signature: Uint8Array, crcChannelName: number, crcUid: number, rawMessage: Uint8Array): Uint8Array {
    return concatUint8Arrays(
        writeUint16LE(signature.length),
        signature,
        writeUint32LE(crcChannelName),
        writeUint32LE(crcUid),
        writeUint16LE(rawMessage.length),
        rawMessage
    );
}

export async function generateAgoraToken(
    appId: string,
    appCertificate: string,
    channelName: string,
    uid: number,
    role: "publisher" | "subscriber",
    privilegeExpireTs: number
): Promise<string> {
    const uidStr = uid.toString();
    const salt = Math.floor(Math.random() * 99999999) + 1;
    const ts = Math.floor(Date.now() / 1000) + 24 * 3600;
    
    // Set privileges based on role
    const privileges: Record<number, number> = {
        [PRIVILEGE_JOIN_CHANNEL]: privilegeExpireTs,
    };
    
    if (role === "publisher") {
        privileges[PRIVILEGE_PUBLISH_AUDIO] = privilegeExpireTs;
        privileges[PRIVILEGE_PUBLISH_VIDEO] = privilegeExpireTs;
        privileges[PRIVILEGE_PUBLISH_DATA] = privilegeExpireTs;
    }
    
    const message = packMessage(salt, ts, privileges);
    
    // Build the data to sign
    const toSign = concatUint8Arrays(
        stringToUint8Array(appId),
        stringToUint8Array(channelName),
        stringToUint8Array(uidStr),
        message
    );
    
    // HMAC-SHA256 sign
    const signature = await hmacSha256(appCertificate, toSign);
    
    // CRC32 of channel name and uid
    const crcChannel = crc32(channelName);
    const crcUid = crc32(uidStr);
    
    // Pack content
    const content = packContent(signature, crcChannel, crcUid, message);
    
    // Final token: VERSION + appId + base64(content)
    return VERSION + appId + uint8ArrayToBase64(content);
}
