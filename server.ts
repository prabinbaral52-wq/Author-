import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { extractText, getMeta } from 'unpdf';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === 'production';

interface CachedResearch {
  answer: string;
  sources: Array<{ title: string; uri: string }>;
  expiresAt: number;
}

const researchCache = new Map<string, CachedResearch>();
const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_CACHE_ENTRIES = 100;

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function classifyGeminiError(error: unknown): { status: number; message: string; isQuota: boolean } {
  const rawMessage =
    error instanceof Error ? error.message : 'Unable to complete search-grounded research.';
  const statusProp =
    typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : NaN;

  const isQuota =
    statusProp === 429 ||
    rawMessage.includes('429') ||
    rawMessage.includes('RESOURCE_EXHAUSTED') ||
    rawMessage.toLowerCase().includes('quota');

  if (isQuota) {
    return {
      status: 429,
      isQuota: true,
      message:
        'Gemini API quota or rate limit was reached. Please wait a moment and try again, or select a billing-enabled API key in Settings > Secrets to increase your quota.',
    };
  }

  if (
    statusProp === 403 ||
    rawMessage.includes('PERMISSION_DENIED') ||
    rawMessage.includes('API_KEY_INVALID')
  ) {
    return {
      status: 403,
      isQuota: false,
      message:
        'Gemini API access was denied. Please check your API key in Settings > Secrets.',
    };
  }

  if (statusProp === 404 || rawMessage.includes('NOT_FOUND')) {
    return {
      status: 404,
      isQuota: false,
      message: 'The requested Gemini model is unavailable right now.',
    };
  }

  return {
    status: 500,
    isQuota: false,
    message: 'Unable to complete search-grounded research right now. Please try again.',
  };
}

async function generateWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient =
        msg.includes('429') ||
        msg.includes('503') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('UNAVAILABLE');
      if (!isTransient || attempt === maxRetries) {
        throw err;
      }
      const delayMs = 600 * Math.pow(2, attempt) + Math.floor(Math.random() * 250);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post(
    '/api/pdf/extract',
    express.raw({ type: ['application/pdf', 'application/octet-stream'], limit: '20mb' }),
    async (req, res) => {
      try {
        const bodyBuffer = req.body;
        if (!Buffer.isBuffer(bodyBuffer) || bodyBuffer.byteLength === 0) {
          res.status(400).json({ error: 'Please send a valid PDF file.' });
          return;
        }

        const uint8 = new Uint8Array(
          bodyBuffer.buffer,
          bodyBuffer.byteOffset,
          bodyBuffer.byteLength
        );
        const [extracted, meta] = await Promise.all([
          extractText(uint8, { mergePages: false }),
          getMeta(uint8).catch(() => null),
        ]);

        const pages = Array.isArray(extracted.text) ? extracted.text : [String(extracted.text ?? '')];
        const normalizedText = pages
          .map((page) =>
            page
              .replace(/\0/g, '')
              .replace(/\r\n/g, '\n')
              .replace(/[ \t]+\n/g, '\n')
              .replace(/\n{3,}/g, '\n\n')
              .trim()
          )
          .filter(Boolean)
          .join('\n\n');

        const rawPdfTitle = typeof meta?.info?.Title === 'string' ? meta.info.Title.trim() : '';
        const pdfTitle =
          rawPdfTitle && !/^microsoft word|^untitled/i.test(rawPdfTitle) ? rawPdfTitle : undefined;

        res.json({
          text: normalizedText,
          pageCount: extracted.totalPages || pages.length,
          pdfTitle,
        });
      } catch (err) {
        console.warn('PDF extraction error:', err instanceof Error ? err.message : err);
        res.status(422).json({
          error: 'Could not extract readable text from this PDF. Please verify it is not password-protected.',
        });
      }
    }
  );

  app.post('/api/gemini/research', async (req, res) => {
    try {
      const body = req.body as {
        query?: unknown;
        contextTitle?: unknown;
        contextExcerpt?: unknown;
        mode?: unknown;
      };

      const rawQuery = typeof body?.query === 'string' ? body.query.trim() : '';
      if (!rawQuery || rawQuery.length > 500) {
        res.status(400).json({
          error: 'Please provide a concise research query between 1 and 500 characters.',
        });
        return;
      }

      const contextTitle =
        typeof body?.contextTitle === 'string' ? body.contextTitle.trim().slice(0, 160) : '';
      const contextExcerpt =
        typeof body?.contextExcerpt === 'string' ? body.contextExcerpt.trim().slice(0, 600) : '';
      const mode = body?.mode === 'author' ? 'author' : 'reader';

      const cacheKey = `${mode}::${contextTitle.toLowerCase()}::${rawQuery.toLowerCase()}`;
      const cached = researchCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        res.json({ answer: cached.answer, sources: cached.sources });
        return;
      }

      const systemInstruction =
        mode === 'author'
          ? 'You are a literary fact-checker and historical research assistant for an author writing books and short stories. Use Google Search to provide accurate, up-to-date, verifiable facts, dates, cultural details, and setting context in 2-3 clear paragraphs.'
          : 'You are a literary companion for readers of books and short stories. Use Google Search to provide accurate, up-to-date historical, geographical, cultural, or literary background relevant to the reader’s question in 2-3 concise, engaging paragraphs.';

      const promptParts = [
        contextTitle ? `Work Title: "${contextTitle}"` : '',
        contextExcerpt ? `Passage / Excerpt Context: "${contextExcerpt}"` : '',
        `Question: ${rawQuery}`,
      ].filter(Boolean);

      const ai = getGeminiClient();
      const response = await generateWithRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: promptParts.join('\n\n'),
          config: {
            systemInstruction,
            tools: [{ googleSearch: {} }],
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        })
      );

      const answer = (response.text ?? '').trim();
      const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];

      const seenUrls = new Set<string>();
      const sources: Array<{ title: string; uri: string }> = [];
      for (const chunk of rawChunks) {
        const uri = chunk?.web?.uri;
        const title = chunk?.web?.title;
        if (typeof uri === 'string' && uri.startsWith('http') && !seenUrls.has(uri)) {
          seenUrls.add(uri);
          sources.push({
            title: typeof title === 'string' && title.trim() ? title.trim() : uri,
            uri,
          });
        }
      }

      if (researchCache.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = researchCache.keys().next().value;
        if (oldestKey) researchCache.delete(oldestKey);
      }
      researchCache.set(cacheKey, {
        answer,
        sources,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      res.json({ answer, sources });
    } catch (error) {
      const classified = classifyGeminiError(error);
      if (classified.isQuota) {
        console.warn('Gemini research quota/rate limit reached (429).');
      } else {
        console.warn('Gemini research request failed:', classified.status, classified.message);
      }
      res.status(classified.status).json({ error: classified.message });
    }
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`praBin server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start praBin server:', err);
  process.exit(1);
});
