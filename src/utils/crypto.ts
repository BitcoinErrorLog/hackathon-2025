import { logger } from './logger';

/**
 * Cryptographic utilities for Pubky authentication
 */

// Helper to convert hex to Uint8Array
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

// Helper to convert Uint8Array to hex
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Generate a secure random secret for the auth flow
export function generateClientSecret(): Uint8Array {
  const secret = new Uint8Array(32);
  crypto.getRandomValues(secret);
  logger.debug('Crypto', 'Generated client secret');
  return secret;
}

// Hash a value using SHA-256
export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  // Create a proper ArrayBuffer to avoid TypeScript issues
  const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return new Uint8Array(hashBuffer);
}

// Base64url encoding (URL-safe)
export function base64UrlEncode(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Base64url decoding
export function base64UrlDecode(str: string): Uint8Array {
  // Add padding if needed
  const padding = '='.repeat((4 - (str.length % 4)) % 4);
  const base64 = (str + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Decrypt the auth token using XOR with the client secret
export function decryptAuthToken(encryptedToken: Uint8Array, secret: Uint8Array): Uint8Array {
  const decrypted = new Uint8Array(encryptedToken.length);
  for (let i = 0; i < encryptedToken.length; i++) {
    decrypted[i] = encryptedToken[i] ^ secret[i % secret.length];
  }
  logger.debug('Crypto', 'Auth token decrypted');
  return decrypted;
}

// Parse the auth token structure
export interface AuthToken {
  signature: Uint8Array;
  namespace: string;
  version: number;
  timestamp: bigint;
  pubky: string;
  capabilities: string[];
}

export function parseAuthToken(tokenBytes: Uint8Array): AuthToken {
  try {
    let offset = 0;

    // Read signature (64 bytes)
    const signature = tokenBytes.slice(offset, offset + 64);
    offset += 64;

    // Read namespace (10 bytes) - "PUBKY:AUTH"
    const namespaceBytes = tokenBytes.slice(offset, offset + 10);
    const namespace = new TextDecoder().decode(namespaceBytes);
    offset += 10;

    // Read version (1 byte)
    const version = tokenBytes[offset];
    offset += 1;

    // Read timestamp (8 bytes, big-endian)
    const timestampView = new DataView(tokenBytes.buffer, offset, 8);
    const timestamp = timestampView.getBigUint64(0, false); // false = big-endian
    offset += 8;

    // Read pubky (32 bytes)
    const pubkyBytes = tokenBytes.slice(offset, offset + 32);
    const pubky = bytesToHex(pubkyBytes);
    offset += 32;

    // Read capabilities (rest of the token)
    const capabilitiesBytes = tokenBytes.slice(offset);
    const capabilitiesString = new TextDecoder().decode(capabilitiesBytes);
    const capabilities = capabilitiesString.split(',').filter(c => c.length > 0);

    logger.info('Crypto', 'Auth token parsed successfully', { pubky, capabilities });

    return {
      signature,
      namespace,
      version,
      timestamp,
      pubky,
      capabilities,
    };
  } catch (error) {
    logger.error('Crypto', 'Failed to parse auth token', error as Error);
    throw new Error('Invalid auth token format');
  }
}

