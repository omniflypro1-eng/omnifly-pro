import { parsePhoneNumberFromString } from 'libphonenumber-js';
import QRCode from 'qrcode';
import { z } from 'zod';
import { type AccountStatus, type MessageResult, type QrResult } from './types.js';
import { type Credentials } from './database.js';

// ── إعدادات الخدمة الثابتة ومصدر صورة QR ──

// Fixed provider configuration. This module is never imported by the browser.
export const PROVIDER_URL = 'https://api2.4whatsapp.com/api/Agent_Client_';

export const COMPANY_CODE = '0058';

// Additional image origin observed in the authenticated Getbarcode response.
export const QR_IMAGE_ORIGINS = new Set(['https://bus.wmessages.blog']);

export const REQUEST_TIMEOUT_MS = 30_000;

export const UPLOAD_TIMEOUT_MS = 60_000;
// ── أخطاء الخدمة ──

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
// ── توحيد أرقام الجوال ──

export function normalizePhone(value: string, countryCode: string): string {
  let number = value
    .trim()
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x6f0))
    .replace(/[\s()\-]/g, '');
  const country = countryCode.replace(/^\+/, '');
  if (number.startsWith('00')) number = '+' + number.slice(2);
  if (!number.startsWith('+')) {
    number = number.startsWith(country) ? '+' + number : '+' + country + number.replace(/^0/, '');
  }
  if (!/^\+[1-9]\d{6,14}$/.test(number)) throw invalidNumber();
  const parsed = parsePhoneNumberFromString(number);
  if (!parsed?.isPossible()) throw invalidNumber();
  return parsed.number;
}

function invalidNumber() {
  return new AppError(400, 'INVALID_PHONE', 'رقم الجوال غير صحيح. تحقق من الرقم ومفتاح الدولة.');
}
// ── الاتصال بخدمة واتساب: الحالة وQR والإرسال ──

export interface Attachment {
  name: string;
  mime: string;
  kind: 'document' | 'media';
  bytes: Buffer;
}

export interface OutgoingMessage {
  recipient: string;
  message: string;
  attachment?: Attachment;
}

export type ProviderOutcome = Pick<MessageResult, 'state' | 'description'>;

export interface WhatsAppProvider {
  status(credentials: Credentials): Promise<AccountStatus>;
  qr(credentials: Credentials): Promise<QrResult>;
  send(credentials: Credentials, message: OutgoingMessage): Promise<ProviderOutcome>;
}

type Fetch = typeof fetch;

const statusSchema = z.object({ found: z.boolean(), linked: z.boolean(), days: z.number().int() });

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function limitedBytes(response: Response, limit: number): Promise<Buffer> {
  if (Number(response.headers.get('content-length')) > limit)
    throw new AppError(502, 'RESPONSE_TOO_LARGE', 'رد الخدمة أكبر من الحجم المتوقع.');
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new AppError(502, 'RESPONSE_TOO_LARGE', 'رد الخدمة أكبر من الحجم المتوقع.');
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

export class HttpWhatsAppProvider implements WhatsAppProvider {
  constructor(private readonly request: Fetch = fetch) {}

  private async call(
    url: string,
    init: RequestInit = {},
    timeout = REQUEST_TIMEOUT_MS,
  ): Promise<Response> {
    try {
      return await this.request(url, {
        ...init,
        redirect: 'error',
        signal: AbortSignal.timeout(timeout),
      });
    } catch {
      // Never forward fetch errors: a QR URL contains the account password.
      throw new AppError(
        502,
        'PROVIDER_UNREACHABLE',
        'تعذر الاتصال بالخدمة. تحقق من الإنترنت ثم حاول مجددًا.',
      );
    }
  }

  async status(credentials: Credentials): Promise<AccountStatus> {
    const response = await this.call(`${PROVIDER_URL}/accountState`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phones: credentials.sender, token: credentials.password }),
    });
    if (!response.ok)
      throw new AppError(
        502,
        'STATUS_FAILED',
        'تعذر فحص الحساب. تحقق من بيانات الربط وصلاحية الاشتراك.',
      );
    const parsed = statusSchema.safeParse(
      parseJson((await limitedBytes(response, 1024 * 1024)).toString('utf8')),
    );
    if (!parsed.success)
      throw new AppError(
        502,
        'UNEXPECTED_STATUS',
        'رد فحص الحساب غير معروف. يلزم مراجعة صيغة الرد من الخدمة.',
      );
    return parsed.data;
  }

  async qr(credentials: Credentials): Promise<QrResult> {
    const segments = [
      COMPANY_CODE,
      credentials.username,
      credentials.password,
      credentials.sender.slice(1),
      '1',
    ].map(encodeURIComponent);
    const response = await this.call(`${PROVIDER_URL}/Getbarcode/${segments.join('/')}`);
    if (!response.ok)
      throw new AppError(502, 'QR_FAILED', 'تعذر جلب رمز الربط. تحقق من بيانات الاشتراك.');
    const outer = asRecord(
      parseJson((await limitedBytes(response, 3 * 1024 * 1024)).toString('utf8')),
    );
    if (outer.status !== true)
      throw new AppError(
        502,
        'QR_REJECTED',
        'لم تُرجع الخدمة رمز ربط. افحص حالة الحساب وبيانات الاشتراك.',
      );
    const code = String(outer.qcode ?? '');
    if (!['1', '2'].includes(code))
      throw new AppError(
        502,
        'UNEXPECTED_QR',
        'صيغة رد رمز الربط غير معروفة. يلزم مراجعتها مع مزود الخدمة.',
      );
    const nested = typeof outer.data === 'string' ? parseJson(outer.data) : outer.data;
    const payload = outer.qr ?? asRecord(nested).qr ?? nested;
    if (typeof payload !== 'string' || !payload.trim() || payload === 'null')
      throw new AppError(
        502,
        'QR_MISSING',
        'رمز الربط غير متوفر. افحص حالة الحساب ثم أعد المحاولة.',
      );
    let image: string;
    if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(payload)) {
      if (payload.length > 3 * 1024 * 1024)
        throw new AppError(502, 'QR_TOO_LARGE', 'صورة الربط أكبر من الحجم المتوقع.');
      image = payload;
    } else if (/^https?:\/\//i.test(payload)) {
      // Fetch provider QR images server-side. Session/password-bearing URLs never reach React.
      let url: URL;
      try {
        url = new URL(payload);
      } catch {
        throw new AppError(502, 'INVALID_QR_URL', 'رابط صورة الربط غير صالح.');
      }
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.port ||
        !(
          url.hostname === '4whatsapp.com' ||
          url.hostname.endsWith('.4whatsapp.com') ||
          QR_IMAGE_ORIGINS.has(url.origin)
        )
      ) {
        throw new AppError(
          502,
          'UNTRUSTED_QR_HOST',
          'مصدر صورة الربط غير معتمد. يلزم مراجعة عنوان الصورة مع مزود الخدمة.',
        );
      }
      const picture = await this.call(url.toString());
      const mime = picture.headers.get('content-type')?.split(';')[0]?.trim();
      if (!picture.ok || !mime || !['image/png', 'image/jpeg', 'image/webp'].includes(mime))
        throw new AppError(502, 'QR_IMAGE_FAILED', 'تعذر تحميل صورة الربط من الخدمة.');
      image = `data:${mime};base64,${(await limitedBytes(picture, 2 * 1024 * 1024)).toString('base64')}`;
    } else {
      if (code !== '1')
        throw new AppError(
          502,
          'UNEXPECTED_QR',
          'صيغة صورة الربط غير معروفة. يلزم مراجعتها مع مزود الخدمة.',
        );
      if (payload.length > 2000) throw new AppError(502, 'INVALID_QR', 'محتوى رمز الربط غير صالح.');
      image = await QRCode.toDataURL(payload, { width: 320, margin: 2, errorCorrectionLevel: 'M' });
    }
    return { image, generatedAt: new Date().toISOString() };
  }

  async send(credentials: Credentials, outgoing: OutgoingMessage): Promise<ProviderOutcome> {
    const form = new FormData();
    form.set('phones', credentials.sender.slice(1));
    form.set('account', '0');
    form.set('doctype', outgoing.attachment?.kind ?? 'text');
    form.set('recipient', outgoing.recipient);
    form.set('message', outgoing.message);
    // Provider wire format remains "token"; the product field is always "كلمة المرور".
    form.set('token', credentials.password);
    if (outgoing.attachment) {
      const file = outgoing.attachment;
      form.set(
        'document_file',
        new Blob([new Uint8Array(file.bytes)], { type: file.mime }),
        file.name,
      );
    }
    try {
      const response = await this.call(
        PROVIDER_URL,
        { method: 'POST', body: form },
        outgoing.attachment ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS,
      );
      if (response.status >= 500)
        return {
          state: 'unknown',
          description: 'حدث خطأ في الخدمة. تحقق من واتساب قبل إعادة الإرسال.',
        };
      if (!response.ok)
        return {
          state: 'failed',
          description: `رفضت الخدمة الطلب (HTTP ${response.status}). تحقق من الاشتراك والرقم والمرفق.`,
        };
      const payload = parseJson((await limitedBytes(response, 1024 * 1024)).toString('utf8'));
      const record = asRecord(payload);
      if (payload === false || record.status === false || record.success === false) {
        return {
          state: 'failed',
          description: 'رفضت الخدمة عملية الإرسال. تحقق من الربط وبيانات الرسالة.',
        };
      }
      if (payload === true || record.status === true || record.success === true) {
        return {
          state: 'accepted',
          description: 'قبلت الخدمة طلب الإرسال. هذا لا يؤكد تسليم الرسالة للمستلم.',
        };
      }
      return {
        state: 'unconfirmed',
        description: 'استجابت الخدمة دون تأكيد واضح للإرسال. تحقق من واتساب قبل إعادة المحاولة.',
      };
    } catch {
      // The request may have reached the provider before a timeout. Never auto-retry a send.
      return {
        state: 'unknown',
        description: 'انقطع الاتصال قبل معرفة النتيجة. تحقق من واتساب قبل إعادة الإرسال.',
      };
    }
  }
}
