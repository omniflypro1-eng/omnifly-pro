export interface SettingsInput {
  username: string;
  password?: string;
  sender: string;
  countryCode: string;
}

export interface PublicSettings {
  username: string;
  sender: string;
  countryCode: string;
  hasPassword: boolean;
  revision: number;
}

export interface AccountStatus {
  found: boolean;
  linked: boolean;
  days: number;
}

export interface QrResult {
  image: string;
  generatedAt: string;
}

export type MessageState = 'pending' | 'accepted' | 'unconfirmed' | 'failed' | 'unknown';

export interface MessageResult {
  id: string;
  state: MessageState;
  description: string;
  replayed?: boolean;
}

export interface MessageLog extends MessageResult {
  recipient: string;
  preview: string;
  fileName: string | null;
  createdAt: string;
}

export interface LogPage {
  items: MessageLog[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.txt',
  '.mp3',
  '.mp4',
] as const;

export const stateLabels: Record<MessageState, string> = {
  pending: 'قيد المعالجة',
  accepted: 'قبلتها الخدمة',
  unconfirmed: 'غير مؤكدة',
  failed: 'فشلت العملية',
  unknown: 'النتيجة غير معروفة',
};
