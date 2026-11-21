// Client-side AES-256-GCM encryption & PBKDF2 password hashing
// Uses Web Crypto API (PBKDF2 + AES-GCM) before storing payloads in Google Spreadsheet

const APP_PEPPER = 'KasWargaRT-AES256-Shield-2026';

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(`${password}:${APP_PEPPER}`),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return `v1:${bufferToBase64(salt)}:${bufferToBase64(derivedBits)}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const parts = storedHash.split(':');
    if (parts.length !== 3 || parts[0] !== 'v1') return false;
    const salt = base64ToBuffer(parts[1]);
    const expected = base64ToBuffer(parts[2]);
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(`${password}:${APP_PEPPER}`),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt as unknown as BufferSource,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );
    const actual = new Uint8Array(derivedBits);
    if (actual.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < actual.length; i++) {
      diff |= actual[i] ^ expected[i];
    }
    return diff === 0;
  } catch {
    return false;
  }
}

async function deriveAesKey(uid: string, saltBytes: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(`${uid}:${APP_PEPPER}`),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes as unknown as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptSensitiveJson<T>(uid: string, payload: T): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(uid, salt);
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    encoded
  );

  return JSON.stringify({
    v: 1,
    s: bufferToBase64(salt),
    iv: bufferToBase64(iv),
    ct: bufferToBase64(ciphertext),
  });
}

export async function decryptSensitiveJson<T>(uid: string, encryptedString: string): Promise<T | null> {
  try {
    const parsed = JSON.parse(encryptedString) as { v: number; s: string; iv: string; ct: string };
    if (!parsed?.s || !parsed?.iv || !parsed?.ct) return null;
    const salt = base64ToBuffer(parsed.s);
    const iv = base64ToBuffer(parsed.iv);
    const ct = base64ToBuffer(parsed.ct);
    const key = await deriveAesKey(uid, salt);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      key,
      ct as unknown as BufferSource
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as T;
  } catch {
    return null;
  }
}

export function compressProofImage(file: File, maxDimension = 840, quality = 0.65): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file foto.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format gambar tidak valid.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas tidak tersedia.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const qualities = [quality, 0.52, 0.4, 0.3];
        let dataUrl = canvas.toDataURL('image/jpeg', qualities[0]);
        for (let i = 1; i < qualities.length && dataUrl.length > 210000; i++) {
          dataUrl = canvas.toDataURL('image/jpeg', qualities[i]);
        }
        if (dataUrl.length > 215000) {
          const fallbackCanvas = document.createElement('canvas');
          const scale = 0.68;
          fallbackCanvas.width = Math.max(240, Math.round(width * scale));
          fallbackCanvas.height = Math.max(180, Math.round(height * scale));
          const fctx = fallbackCanvas.getContext('2d');
          if (fctx) {
            fctx.drawImage(canvas, 0, 0, fallbackCanvas.width, fallbackCanvas.height);
            dataUrl = fallbackCanvas.toDataURL('image/jpeg', 0.45);
          }
        }
        resolve(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function compressBannerSlideImage(
  file: File,
  maxDimension = 1080,
  initialQuality = 0.72
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error(`File "${file.name}" bukan gambar yang valid.`));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Gagal membaca file "${file.name}".`));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error(`Format gambar "${file.name}" tidak dapat diproses.`));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas tidak tersedia di browser ini.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        const qualities = [initialQuality, 0.58, 0.45, 0.35];
        let result = canvas.toDataURL('image/jpeg', qualities[0]);
        for (let i = 1; i < qualities.length && result.length > 250000; i++) {
          result = canvas.toDataURL('image/jpeg', qualities[i]);
        }

        if (result.length > 260000) {
          const fallbackCanvas = document.createElement('canvas');
          const scale = 0.68;
          fallbackCanvas.width = Math.max(320, Math.round(width * scale));
          fallbackCanvas.height = Math.max(200, Math.round(height * scale));
          const fctx = fallbackCanvas.getContext('2d');
          if (fctx) {
            fctx.drawImage(canvas, 0, 0, fallbackCanvas.width, fallbackCanvas.height);
            result = fallbackCanvas.toDataURL('image/jpeg', 0.48);
          }
        }
        resolve(result);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
