import { getDriveAccessToken, setDriveAccessToken } from './firebase';
import { LIMITS } from '../types';

// Provisioned Google Workspace OAuth Client ID (gen-lang-client-0383654104)
const DRIVE_OAUTH_CLIENT_ID =
  '709500446721-v2hfqtef7j21ha90ecm8m3vldhh582mj.apps.googleusercontent.com';
const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
].join(' ');

interface GooglePickerDocument {
  id: string;
  name: string;
  mimeType: string;
}

interface GooglePickerResponse {
  action: string;
  docs?: GooglePickerDocument[];
}

interface GooglePickerNamespace {
  Action: {
    PICKED: string;
    CANCEL: string;
  };
  DocsView: new () => {
    setIncludeFolders: (include: boolean) => GooglePickerDocsView;
    setMimeTypes: (mimeTypes: string) => GooglePickerDocsView;
  };
  PickerBuilder: new () => {
    addView: (view: unknown) => GooglePickerBuilder;
    setOAuthToken: (token: string) => GooglePickerBuilder;
    setCallback: (cb: (data: GooglePickerResponse) => void) => GooglePickerBuilder;
    setOrigin: (origin: string) => GooglePickerBuilder;
    setTitle: (title: string) => GooglePickerBuilder;
    build: () => { setVisible: (visible: boolean) => void };
  };
}

type GooglePickerDocsView = InstanceType<GooglePickerNamespace['DocsView']>;
type GooglePickerBuilder = InstanceType<GooglePickerNamespace['PickerBuilder']>;

interface GapiClient {
  load: (api: string, options: { callback: () => void; onerror?: () => void }) => void;
}

interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GisTokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string; hint?: string }) => void;
}

interface GoogleAccountsOAuth2 {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    hint?: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type: string; message?: string }) => void;
  }) => GisTokenClient;
}

declare global {
  interface Window {
    gapi?: GapiClient;
    google?: {
      picker?: GooglePickerNamespace;
      accounts?: {
        oauth2?: GoogleAccountsOAuth2;
      };
    };
  }
}

let pickerLoaderPromise: Promise<GooglePickerNamespace> | null = null;
let gisLoaderPromise: Promise<GoogleAccountsOAuth2> | null = null;

function loadGooglePickerApi(): Promise<GooglePickerNamespace> {
  if (window.google?.picker) {
    return Promise.resolve(window.google.picker);
  }
  if (pickerLoaderPromise) {
    return pickerLoaderPromise;
  }

  pickerLoaderPromise = new Promise((resolve, reject) => {
    const loadPickerModule = () => {
      if (!window.gapi) {
        pickerLoaderPromise = null;
        reject(new Error('Google API loader unavailable.'));
        return;
      }
      window.gapi.load('picker', {
        callback: () => {
          if (window.google?.picker) {
            resolve(window.google.picker);
          } else {
            pickerLoaderPromise = null;
            reject(new Error('Google Picker failed to initialize.'));
          }
        },
        onerror: () => {
          pickerLoaderPromise = null;
          reject(new Error('Could not load Google Picker library.'));
        },
      });
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://apis.google.com/js/api.js"]'
    );

    if (existingScript) {
      if (window.gapi) {
        loadPickerModule();
      } else {
        existingScript.addEventListener('load', loadPickerModule, { once: true });
        existingScript.addEventListener(
          'error',
          () => {
            pickerLoaderPromise = null;
            reject(new Error('Failed to load Google API script.'));
          },
          { once: true }
        );
      }
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;
    script.onload = loadPickerModule;
    script.onerror = () => {
      pickerLoaderPromise = null;
      reject(new Error('Failed to load Google API script.'));
    };
    document.head.appendChild(script);
  });

  return pickerLoaderPromise;
}

function loadGoogleIdentityServices(): Promise<GoogleAccountsOAuth2> {
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve(window.google.accounts.oauth2);
  }
  if (gisLoaderPromise) {
    return gisLoaderPromise;
  }

  gisLoaderPromise = new Promise((resolve, reject) => {
    const onReady = () => {
      if (window.google?.accounts?.oauth2) {
        resolve(window.google.accounts.oauth2);
      } else {
        gisLoaderPromise = null;
        reject(new Error('Google Identity Services unavailable.'));
      }
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );

    if (existing) {
      if (window.google?.accounts?.oauth2) {
        onReady();
      } else {
        existing.addEventListener('load', onReady, { once: true });
        existing.addEventListener(
          'error',
          () => {
            gisLoaderPromise = null;
            reject(new Error('Failed to load Google Identity script.'));
          },
          { once: true }
        );
      }
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = onReady;
    script.onerror = () => {
      gisLoaderPromise = null;
      reject(new Error('Failed to load Google Identity script.'));
    };
    document.head.appendChild(script);
  });

  return gisLoaderPromise;
}

export function preloadGoogleDriveLibraries(): void {
  void loadGoogleIdentityServices().catch(() => {});
  void loadGooglePickerApi().catch(() => {});
}

export async function requestDriveAccessToken(userEmail?: string | null): Promise<string> {
  const existing = getDriveAccessToken();
  if (existing) return existing;

  const oauth2 = await loadGoogleIdentityServices();

  return new Promise<string>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: DRIVE_OAUTH_CLIENT_ID,
      scope: DRIVE_SCOPES,
      hint: userEmail || undefined,
      callback: (response: TokenResponse) => {
        if (response.error || !response.access_token) {
          reject(
            new Error(
              response.error_description ||
                response.error ||
                'Google Drive permission was not granted.'
            )
          );
          return;
        }
        setDriveAccessToken(response.access_token);
        resolve(response.access_token);
      },
      error_callback: (err) => {
        reject(new Error(err.message || 'Google Drive sign-in popup was closed or blocked.'));
      },
    });

    client.requestAccessToken({ prompt: '', hint: userEmail || undefined });
  });
}

export async function extractTextFromPdfBytes(
  bytes: ArrayBuffer
): Promise<{ text: string; pageCount: number; pdfTitle?: string }> {
  const res = await fetch('/api/pdf/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/pdf' },
    body: bytes,
  });

  const data = (await res.json()) as {
    text?: string;
    pageCount?: number;
    pdfTitle?: string;
    error?: string;
  };

  if (!res.ok) {
    throw new Error(data.error || 'Could not extract text from the PDF file.');
  }

  return {
    text: (data.text || '').slice(0, LIMITS.CONTENT_MAX),
    pageCount: Number(data.pageCount ?? 1),
    pdfTitle: data.pdfTitle,
  };
}

export interface ImportedManuscript {
  fileName: string;
  suggestedTitle: string;
  content: string;
  pageCount?: number;
  source: 'google-drive' | 'local';
}

function cleanTitleFromFilename(fileName: string): string {
  return fileName
    .replace(/\.(pdf|txt|md|markdown|docx?)$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim()
    .slice(0, LIMITS.TITLE_MAX);
}

export async function pickAndImportFromGoogleDrive(
  accessToken: string
): Promise<ImportedManuscript | null> {
  const pickerLib = await loadGooglePickerApi();

  const pickedDoc = await new Promise<GooglePickerDocument | null>((resolve) => {
    const ancestors = window.location.ancestorOrigins;
    const pickerOrigin =
      ancestors && ancestors.length > 0
        ? ancestors[ancestors.length - 1]
        : window.location.origin;

    const docsView = new pickerLib.DocsView()
      .setIncludeFolders(true)
      .setMimeTypes(
        'application/pdf,application/vnd.google-apps.document,text/plain,text/markdown'
      );

    const picker = new pickerLib.PickerBuilder()
      .addView(docsView)
      .setOAuthToken(accessToken)
      .setOrigin(pickerOrigin)
      .setTitle('Choose a story PDF or document from Google Drive')
      .setCallback((data: GooglePickerResponse) => {
        if (data.action === pickerLib.Action.PICKED && data.docs && data.docs.length > 0) {
          resolve(data.docs[0]);
        } else if (data.action === pickerLib.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();

    picker.setVisible(true);
  });

  if (!pickedDoc) {
    return null;
  }

  const isGoogleDoc = pickedDoc.mimeType === 'application/vnd.google-apps.document';
  const isPdf =
    pickedDoc.mimeType === 'application/pdf' ||
    pickedDoc.name.toLowerCase().endsWith('.pdf');

  if (isGoogleDoc) {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(pickedDoc.id)}/export?mimeType=text/plain`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new Error('DRIVE_AUTH_EXPIRED');
      }
      throw new Error('Could not export the selected Google Doc. Please reconnect Google Drive and try again.');
    }
    const text = (await res.text()).trim().slice(0, LIMITS.CONTENT_MAX);
    if (!text) {
      throw new Error('The selected Google Doc appears to be empty.');
    }
    return {
      fileName: pickedDoc.name,
      suggestedTitle: cleanTitleFromFilename(pickedDoc.name),
      content: text,
      source: 'google-drive',
    };
  }

  const fileRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(pickedDoc.id)}?alt=media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!fileRes.ok) {
    if (fileRes.status === 401 || fileRes.status === 403) {
      throw new Error('DRIVE_AUTH_EXPIRED');
    }
    throw new Error('Unable to download the selected file from Google Drive.');
  }

  if (isPdf) {
    const bytes = await fileRes.arrayBuffer();
    const extracted = await extractTextFromPdfBytes(bytes);
    if (!extracted.text.trim()) {
      throw new Error('No readable text was found in this PDF (it may be a scanned image-only PDF).');
    }
    return {
      fileName: pickedDoc.name,
      suggestedTitle:
        (extracted.pdfTitle && extracted.pdfTitle.trim().slice(0, LIMITS.TITLE_MAX)) ||
        cleanTitleFromFilename(pickedDoc.name),
      content: extracted.text,
      pageCount: extracted.pageCount,
      source: 'google-drive',
    };
  }

  const plainText = (await fileRes.text()).trim().slice(0, LIMITS.CONTENT_MAX);
  if (!plainText) {
    throw new Error('The selected text file appears to be empty.');
  }
  return {
    fileName: pickedDoc.name,
    suggestedTitle: cleanTitleFromFilename(pickedDoc.name),
    content: plainText,
    source: 'google-drive',
  };
}
