export const WORKSPACE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

export interface GoogleUserIdentity {
  uid: string;
  email: string;
  displayName: string;
}

interface GisTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface GisTokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: GisTokenResponse) => void;
            error_callback?: (error: { type?: string; message?: string }) => void;
          }) => GisTokenClient;
          revoke?: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

export const GOOGLE_OAUTH_CLIENT_ID = (
  import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID || ''
).trim();

export const hasConfiguredGoogleOAuthClientId = (): boolean =>
  Boolean(GOOGLE_OAUTH_CLIENT_ID);

// In-memory only OAuth token cache (never stored in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
let cachedUser: GoogleUserIdentity | null = null;
let gsiScriptPromise: Promise<void> | null = null;

function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Identity Services hanya tersedia di browser.'));
  }
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }
  if (gsiScriptPromise) return gsiScriptPromise;

  gsiScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('Gagal memuat Google Identity Services.')),
        { once: true }
      );
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gsiScriptPromise = null;
      reject(new Error('Gagal memuat Google Identity Services. Periksa koneksi internet.'));
    };
    document.head.appendChild(script);
  });

  return gsiScriptPromise;
}

async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserIdentity> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error('Gagal membaca profil akun Google.');
  }
  const data = (await res.json()) as {
    sub?: string;
    email?: string;
    name?: string;
  };
  return {
    uid: data.sub ? `google_${data.sub}` : `google_${Date.now()}`,
    email: data.email || '',
    displayName: data.name || data.email || 'Pengurus RT',
  };
}

export const googleWorkspaceSignIn = async (): Promise<{
  user: GoogleUserIdentity;
  accessToken: string;
}> => {
  if (!GOOGLE_OAUTH_CLIENT_ID) {
    throw new Error(
      'Mode OAuth Google langsung memerlukan VITE_GOOGLE_OAUTH_CLIENT_ID dari Google Cloud Console Anda sendiri. Gunakan koneksi Apps Script Spreadsheet agar langsung aktif tanpa OAuth/verifikasi Google.'
    );
  }

  await loadGoogleIdentityScript();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) {
    throw new Error('Google Identity Services belum siap. Muat ulang halaman lalu coba lagi.');
  }

  const token = await new Promise<string>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: GOOGLE_OAUTH_CLIENT_ID,
      scope: WORKSPACE_SCOPES.join(' '),
      callback: (resp) => {
        if (resp.error) {
          reject(new Error(resp.error_description || resp.error));
          return;
        }
        if (!resp.access_token) {
          reject(new Error('Token akses Google Sheets tidak diterima.'));
          return;
        }
        resolve(resp.access_token);
      },
      error_callback: (err) => {
        if (err?.type === 'popup_closed') {
          reject(new Error('Jendela login Google ditutup sebelum selesai.'));
        } else if (err?.type === 'popup_failed_to_open') {
          reject(new Error('Pop-up login Google diblokir oleh browser. Izinkan pop-up lalu coba lagi.'));
        } else {
          reject(new Error(err?.message || 'Gagal membuka login Google.'));
        }
      },
    });
    client.requestAccessToken({ prompt: 'select_account' });
  });

  const user = await fetchGoogleUserInfo(token);
  cachedAccessToken = token;
  cachedUser = user;
  return { user, accessToken: token };
};

export const getGoogleAccessToken = (): string | null => cachedAccessToken;
export const getCachedGoogleUser = (): GoogleUserIdentity | null => cachedUser;

export const clearGoogleAccessToken = (): void => {
  cachedAccessToken = null;
  cachedUser = null;
};

export const googleWorkspaceSignOut = async (): Promise<void> => {
  const tokenToRevoke = cachedAccessToken;
  cachedAccessToken = null;
  cachedUser = null;
  if (tokenToRevoke && window.google?.accounts?.oauth2?.revoke) {
    await new Promise<void>((resolve) => {
      window.google!.accounts!.oauth2!.revoke!(tokenToRevoke, () => resolve());
    });
  }
};

export const formatGoogleAuthError = (
  err: unknown,
  context: 'connect' | 'admin' = 'connect'
): string => {
  const rawMessage = err instanceof Error ? err.message : String(err || '');
  if (rawMessage.includes('access_denied') || rawMessage.includes('403')) {
    return 'Akses OAuth Google ditolak (Error 403). Gunakan koneksi URL Web App Apps Script Spreadsheet agar tidak terkena blokir verifikasi Google.';
  }
  if (rawMessage.includes('VITE_GOOGLE_OAUTH_CLIENT_ID')) {
    return rawMessage;
  }
  const prefix =
    context === 'admin' ? 'Gagal masuk OAuth Google' : 'Gagal menghubungkan Google OAuth';
  return rawMessage ? `${prefix}: ${rawMessage}` : prefix;
};
