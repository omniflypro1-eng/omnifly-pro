import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import {
  type LogPage,
  type MessageLog,
  type MessageResult,
  type PublicSettings,
  type SettingsInput,
} from './types.js';
import { AppError, normalizePhone } from './whatsapp.js';

// ── تشفير كلمة المرور ──

export class SecretBox {
  constructor(private readonly key: Buffer) {
    if (key.length !== 32) throw new Error('Encryption key must contain exactly 32 bytes.');
  }
  seal(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map((p) => p.toString('base64')).join('.');
  }
  open(value: string): string {
    const parts = value.split('.');
    if (parts.length !== 3) throw new Error('Invalid encrypted credential.');
    const [iv, tag, data] = parts.map((p) => Buffer.from(p, 'base64')) as [Buffer, Buffer, Buffer];
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }
}

export function loadSecretBox(directory: string): SecretBox {
  const configuredKey = process.env.WHATSAPP_ENCRYPTION_KEY;
  if (configuredKey) return new SecretBox(Buffer.from(configuredKey, 'base64'));
  const file = join(directory, 'encryption.key');
  if (!existsSync(file)) writeFileSync(file, randomBytes(32), { mode: 0o600, flag: 'wx' });
  return new SecretBox(readFileSync(file));
}
// ── حفظ الإعدادات وسجل الإرسال في SQLite ──

export interface Credentials {
  username: string;
  password: string;
  sender: string;
  countryCode: string;
  revision: number;
}

type SettingsRow = {
  username: string;
  password: string;
  sender: string;
  country_code: string;
  revision: number;
};

type MessageRow = {
  id: string;
  request_key: string;
  fingerprint: string;
  recipient: string;
  preview: string;
  file_name: string | null;
  state: MessageResult['state'];
  description: string;
  created_at: string;
};

export class Repository {
  constructor(
    private readonly db: Database.Database,
    private readonly secrets: SecretBox,
  ) {
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    db.exec(`
      CREATE TABLE IF NOT EXISTS whatsapp_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1), username TEXT NOT NULL,
        password TEXT NOT NULL, sender TEXT NOT NULL, country_code TEXT NOT NULL,
        revision INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS whatsapp_messages (
        id TEXT PRIMARY KEY, request_key TEXT NOT NULL UNIQUE, fingerprint TEXT NOT NULL,
        recipient TEXT NOT NULL, preview TEXT NOT NULL, file_name TEXT,
        state TEXT NOT NULL CHECK (state IN ('pending','accepted','unconfirmed','failed','unknown')),
        description TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS whatsapp_messages_date ON whatsapp_messages(created_at DESC);
    `);
  }

  // Standalone server calls this once, before accepting requests after a restart.
  recoverInterruptedMessages(): void {
    this.db
      .prepare(
        "UPDATE whatsapp_messages SET state = 'unknown', description = ? WHERE state = 'pending'",
      )
      .run('توقف النظام أثناء الإرسال. تحقق من واتساب قبل إعادة الإرسال.');
  }

  private settingsRow(): SettingsRow | undefined {
    return this.db.prepare('SELECT * FROM whatsapp_settings WHERE id = 1').get() as
      SettingsRow | undefined;
  }
  getPublicSettings(): PublicSettings {
    const row = this.settingsRow();
    return row
      ? {
          username: row.username,
          sender: row.sender,
          countryCode: row.country_code,
          hasPassword: true,
          revision: row.revision,
        }
      : { username: '', sender: '', countryCode: '+966', hasPassword: false, revision: 0 };
  }
  getCredentials(): Credentials {
    const row = this.settingsRow();
    if (!row) throw new AppError(409, 'SETTINGS_REQUIRED', 'احفظ بيانات الربط أولًا.');
    return {
      username: row.username,
      password: this.secrets.open(row.password),
      sender: row.sender,
      countryCode: row.country_code,
      revision: row.revision,
    };
  }
  saveSettings(input: SettingsInput): PublicSettings {
    const sender = normalizePhone(input.sender, input.countryCode);
    const country = '+' + input.countryCode.replace(/^\+/, '');
    return this.db.transaction(() => {
      const existing = this.settingsRow();
      if (!input.password && !existing)
        throw new AppError(
          400,
          'PASSWORD_REQUIRED',
          'أدخل كلمة المرور عند حفظ بيانات الربط لأول مرة.',
        );
      const password = input.password ? this.secrets.seal(input.password) : existing!.password;
      this.db
        .prepare(
          `INSERT INTO whatsapp_settings (id, username, password, sender, country_code, revision)
        VALUES (1, ?, ?, ?, ?, 1) ON CONFLICT(id) DO UPDATE SET
        username=excluded.username, password=excluded.password, sender=excluded.sender,
        country_code=excluded.country_code, revision=whatsapp_settings.revision+1`,
        )
        .run(input.username, password, sender, country);
      return this.getPublicSettings();
    })();
  }
  findMessage(key: string): { log: MessageLog; fingerprint: string } | undefined {
    const row = this.db
      .prepare('SELECT * FROM whatsapp_messages WHERE request_key = ?')
      .get(key) as MessageRow | undefined;
    return row ? { log: this.mapMessage(row), fingerprint: row.fingerprint } : undefined;
  }
  createMessage(input: {
    id: string;
    key: string;
    fingerprint: string;
    recipient: string;
    preview: string;
    fileName: string | null;
  }): boolean {
    return (
      this.db
        .prepare(
          `INSERT OR IGNORE INTO whatsapp_messages
      (id, request_key, fingerprint, recipient, preview, file_name, state, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
        )
        .run(
          input.id,
          input.key,
          input.fingerprint,
          input.recipient,
          input.preview,
          input.fileName,
          'الطلب قيد المعالجة.',
          new Date().toISOString(),
        ).changes === 1
    );
  }
  finishMessage(result: MessageResult): void {
    this.db
      .prepare('UPDATE whatsapp_messages SET state = ?, description = ? WHERE id = ?')
      .run(result.state, result.description, result.id);
  }
  listMessages(page: number, pageSize = 20): LogPage {
    const rows = this.db
      .prepare(
        'SELECT * FROM whatsapp_messages ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?',
      )
      .all(pageSize, (page - 1) * pageSize) as MessageRow[];
    const count = this.db.prepare('SELECT COUNT(*) AS total FROM whatsapp_messages').get() as {
      total: number;
    };
    return { items: rows.map((row) => this.mapMessage(row)), total: count.total, page, pageSize };
  }
  private mapMessage(row: MessageRow): MessageLog {
    return {
      id: row.id,
      recipient: row.recipient,
      preview: row.preview,
      fileName: row.file_name,
      state: row.state,
      description: row.description,
      createdAt: row.created_at,
    };
  }
}
