import { z, ZodError } from 'zod';
import {
  type SettingsInput,
  ALLOWED_EXTENSIONS,
  MAX_UPLOAD_BYTES,
  type MessageResult,
} from './types.js';
import { createHash, randomUUID } from 'node:crypto';
import { basename, extname, resolve, join, dirname } from 'node:path';
import {
  AppError,
  normalizePhone,
  type Attachment,
  type WhatsAppProvider,
  HttpWhatsAppProvider,
} from './whatsapp.js';
import { Repository, loadSecretBox } from './database.js';
import express from 'express';
import { Router, type ErrorRequestHandler, type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import helmet from 'helmet';
import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// ── التحقق من البيانات المدخلة ──

export const settingsSchema = z.object({
  username: z.string().trim().min(1, 'أدخل اسم المستخدم').max(100, 'اسم المستخدم طويل جدًا'),
  password: z.string().max(500, 'كلمة المرور طويلة جدًا').optional(),
  sender: z.string().trim().min(1, 'أدخل رقم جوال المرسل').max(30),
  countryCode: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{0,2}$/, 'أدخل مفتاح دولة صحيحًا، مثل +966'),
}) satisfies z.ZodType<SettingsInput>;
// ── تجهيز الرسالة والمرفق ومنع تكرار الطلب ──

const mimeTypes: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
};

const documents = new Set(['.pdf', '.txt', '.doc', '.docx', '.xls', '.xlsx']);

export function prepareAttachment(file?: Express.Multer.File): Attachment | undefined {
  if (!file) return undefined;
  if (!file.size || file.size > MAX_UPLOAD_BYTES)
    throw new AppError(400, 'INVALID_FILE_SIZE', 'اختر ملفًا غير فارغ لا يتجاوز 10 ميجابايت.');
  const name = basename(file.originalname.replace(/\\/g, '/'))
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .slice(-180);
  const extension = extname(name).toLowerCase();
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(extension))
    throw new AppError(
      400,
      'UNSUPPORTED_FILE',
      'نوع الملف غير مدعوم. اختر صورة أو مستندًا أو ملف صوت أو فيديو.',
    );
  return {
    name,
    mime: mimeTypes[extension]!,
    kind: documents.has(extension) ? 'document' : 'media',
    bytes: file.buffer,
  };
}

export class WhatsAppService {
  constructor(
    private readonly repository: Repository,
    private readonly provider: WhatsAppProvider,
  ) {}

  async send(input: {
    key: string;
    recipient: string;
    message: string;
    attachment?: Attachment;
  }): Promise<MessageResult> {
    const credentials = this.repository.getCredentials();
    const recipient = normalizePhone(input.recipient, credentials.countryCode);
    const message = input.message.trim();
    if (!message && !input.attachment)
      throw new AppError(400, 'EMPTY_MESSAGE', 'اكتب رسالة أو اختر مرفقًا للإرسال.');
    const file = input.attachment;
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          recipient,
          message,
          sender: credentials.sender,
          username: credentials.username,
          fileName: file?.name,
          fileHash: file ? createHash('sha256').update(file.bytes).digest('hex') : undefined,
        }),
      )
      .digest('hex');
    const previous = this.repository.findMessage(input.key);
    if (previous) return this.replay(previous, fingerprint);
    const id = randomUUID();
    const created = this.repository.createMessage({
      id,
      key: input.key,
      fingerprint,
      recipient,
      preview: message.slice(0, 160),
      fileName: file?.name ?? null,
    });
    if (!created) return this.replay(this.repository.findMessage(input.key)!, fingerprint);
    let outcome;
    try {
      outcome = await this.provider.send(credentials, { recipient, message, attachment: file });
    } catch {
      outcome = {
        state: 'unknown' as const,
        description: 'تعذر معرفة نتيجة الإرسال. تحقق من واتساب قبل إعادة المحاولة.',
      };
    }
    const result: MessageResult = { id, ...outcome };
    this.repository.finishMessage(result);
    return result;
  }
  private replay(
    previous: NonNullable<ReturnType<Repository['findMessage']>>,
    fingerprint: string,
  ): MessageResult {
    if (previous.fingerprint !== fingerprint)
      throw new AppError(
        409,
        'IDEMPOTENCY_CONFLICT',
        'استُخدم معرّف العملية لرسالة مختلفة. أعد فتح عملية الإرسال.',
      );
    return {
      id: previous.log.id,
      state: previous.log.state,
      description: previous.log.description,
      replayed: true,
    };
  }
}
// ── مسارات API وصلاحيات الوصول ──

export interface RouterOptions {
  repository: Repository;
  provider: WhatsAppProvider;
  // Mandatory: use the host system's authenticated administrator middleware.
  authorize: RequestHandler;
}

export function createWhatsAppRouter({ repository, provider, authorize }: RouterOptions): Router {
  if (typeof authorize !== 'function') throw new Error('Authorization middleware is required.');
  const router = Router();
  const service = new WhatsAppService(repository, provider);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 2, fieldSize: 20_000, parts: 3 },
  });
  const limited = (limit: number) =>
    rateLimit({
      windowMs: 60_000,
      limit,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {
        error: {
          code: 'RATE_LIMITED',
          message: 'طلبات كثيرة خلال وقت قصير. انتظر دقيقة ثم حاول مجددًا.',
        },
      },
    });
  router.use(authorize);
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.use(limited(100));
  router.get('/settings', (_req, res) => {
    res.json(repository.getPublicSettings());
  });
  router.put('/settings', (req, res) => {
    res.json(repository.saveSettings(settingsSchema.strict().parse(req.body)));
  });
  router.get('/status', async (_req, res) => {
    res.json(await provider.status(repository.getCredentials()));
  });
  router.post('/qr', limited(6), async (_req, res) => {
    res.json(await provider.qr(repository.getCredentials()));
  });
  router.post('/send', limited(10), upload.single('file'), async (req, res) => {
    const key = z
      .string()
      .regex(/^[A-Za-z0-9._:-]{8,120}$/, 'معرّف عملية الإرسال غير صالح.')
      .parse(req.get('Idempotency-Key'));
    const body = z
      .object({
        recipient: z.string().trim().min(1, 'أدخل رقم المستلم').max(30),
        message: z.string().max(10_000, 'الرسالة طويلة جدًا').default(''),
      })
      .strict()
      .parse(req.body);
    const result = await service.send({ key, ...body, attachment: prepareAttachment(req.file) });
    res.status(result.state === 'pending' ? 202 : 200).json(result);
  });
  router.get('/logs', (req, res) => {
    const page = z.coerce.number().int().min(1).max(100_000).default(1).parse(req.query.page);
    res.json(repository.listMessages(page));
  });
  router.use(errorHandler);
  return router;
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: error.issues[0]?.message ?? 'راجع البيانات المدخلة.',
      },
    });
    return;
  }
  if (error instanceof multer.MulterError) {
    res.status(400).json({
      error: {
        code: error.code,
        message:
          error.code === 'LIMIT_FILE_SIZE'
            ? 'حجم الملف يتجاوز 10 ميجابايت.'
            : 'تعذر رفع الملف. اختر مرفقًا واحدًا وراجع حجمه.',
      },
    });
    return;
  }
  if (error && typeof error === 'object' && 'type' in error && error.type === 'entity.too.large') {
    res
      .status(413)
      .json({ error: { code: 'BODY_TOO_LARGE', message: 'حجم الطلب أكبر من المسموح.' } });
    return;
  }
  if (
    error &&
    typeof error === 'object' &&
    'type' in error &&
    error.type === 'entity.parse.failed'
  ) {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'صيغة الطلب غير صالحة.' } });
    return;
  }
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'حدث خطأ داخلي. حاول مرة أخرى أو راجع مسؤول النظام.',
    },
  });
};
// ── حماية المعاينة المحلية ──

// Only for the standalone local demo. A host system MUST use its own authentication.
export function localAccess(port: number): RequestHandler {
  const origins = new Set([
    `http://127.0.0.1:${port}`,
    `http://localhost:${port}`,
    'http://127.0.0.1:5173',
    'http://localhost:5173',
  ]);
  return (req, _res, next) => {
    const address = req.socket.remoteAddress;
    const origin = req.get('Origin');
    const host = req.hostname;
    if (
      !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address ?? '') ||
      !['localhost', '127.0.0.1', '[::1]'].includes(host) ||
      (origin && !origins.has(origin)) ||
      req.get('X-WhatsApp-Client') !== 'web'
    ) {
      next(new AppError(403, 'LOCAL_ACCESS_ONLY', 'هذا التشغيل مخصص للوصول المحلي المصرح به.'));
      return;
    }
    next();
  };
}
// ── تشغيل الموقع محليًا ──

export function startLocalServer() {
  const port = Number(process.env.PORT ?? 3100);

  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid PORT.');

  const directory = resolve(process.env.DATA_DIRECTORY ?? './data');

  mkdirSync(directory, { recursive: true, mode: 0o700 });

  const db = new Database(join(directory, 'whatsapp.sqlite'));

  const repository = new Repository(db, loadSecretBox(directory));

  repository.recoverInterruptedMessages();

  const app = express();

  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: { 'img-src': ["'self'", 'data:'], 'upgrade-insecure-requests': null },
      },
    }),
  );

  app.use(express.json({ limit: '32kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use(
    '/api/whatsapp',
    createWhatsAppRouter({
      repository,
      provider: new HttpWhatsAppProvider(),
      authorize: localAccess(port),
    }),
  );

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'المسار غير موجود.' } });
  });

  const client = resolve(dirname(fileURLToPath(import.meta.url)), 'dist');

  if (existsSync(join(client, 'index.html'))) {
    app.use(express.static(client));
    app.get('/{*path}', (_req, res) => {
      res.sendFile(join(client, 'index.html'));
    });
  }

  app.use(errorHandler);

  const server = app.listen(port, '127.0.0.1', () => {
    console.info(`WhatsApp integration: http://127.0.0.1:${port}`);
  });

  const shutdown = () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.once('SIGINT', shutdown);

  process.once('SIGTERM', shutdown);
  return server;
}

// Importing this module into another system does not start a second server.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startLocalServer();
}
