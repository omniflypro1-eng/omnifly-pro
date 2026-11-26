import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  type AccountStatus,
  type ApiErrorBody,
  type LogPage,
  type MessageResult,
  type PublicSettings,
  type QrResult,
  type SettingsInput,
  ALLOWED_EXTENSIONS,
  MAX_UPLOAD_BYTES,
  stateLabels,
} from './types.js';
import * as React from 'react';
import {
  forwardRef,
  type InputHTMLAttributes,
  type HTMLAttributes,
  useEffect,
  useState,
  type FormEvent,
  useRef,
} from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import {
  AlertCircle,
  CheckCircle2,
  Info,
  X,
  Eye,
  EyeOff,
  Loader2,
  Save,
  ShieldCheck,
  QrCode,
  RefreshCw,
  Smartphone,
  FileCheck2,
  History,
  Paperclip,
  Send,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Settings2,
} from 'lucide-react';
import {
  useMutation,
  useQuery,
  keepPreviousData,
  useQueryClient,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/noto-sans-arabic';
import './styles.css';

// ── أدوات تنسيق الواجهة ──

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
// ── اتصال الشاشة بالسيرفر ──

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('X-WhatsApp-Client', 'web');
  let response: Response;
  try {
    response = await fetch(`/api/whatsapp${path}`, {
      ...init,
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(
      'NETWORK_ERROR',
      'تعذر الاتصال بالنظام. إذا كنت ترسل رسالة، تحقق من سجل الإرسال قبل إعادة المحاولة.',
    );
  }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (data as ApiErrorBody | null)?.error;
    throw new ApiError(
      error?.code ?? 'REQUEST_FAILED',
      error?.message ?? 'تعذر إتمام العملية. حاول مرة أخرى.',
    );
  }
  return data as T;
}

export const api = {
  settings: () => request<PublicSettings>('/settings'),
  saveSettings: (value: SettingsInput) =>
    request<PublicSettings>('/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    }),
  status: () => request<AccountStatus>('/status'),
  qr: () => request<QrResult>('/qr', { method: 'POST' }),
  logs: (page: number) => request<LogPage>(`/logs?page=${page}`),
  send: (data: { recipient: string; message: string; file?: File; key: string }) => {
    const body = new FormData();
    body.set('recipient', data.recipient);
    body.set('message', data.message);
    if (data.file) body.set('file', data.file);
    return request<MessageResult>('/send', {
      method: 'POST',
      headers: { 'Idempotency-Key': data.key },
      body,
    });
  },
};
// ── مكونات الواجهة المشتركة ──

const variants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45',
  {
    variants: {
      variant: {
        default: 'bg-primary text-white hover:bg-primary-hover shadow-sm',
        outline: 'border border-emerald-700/30 bg-white text-primary hover:bg-emerald-50',
        ghost: 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
      },
      size: { default: 'h-11 px-5', sm: 'h-9 px-3 text-xs', icon: 'h-10 w-10' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof variants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(variants({ variant, size, className }))} ref={ref} {...props} />;
  },
);

Button.displayName = 'Button';

export const inputClass =
  'flex w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/10 disabled:bg-slate-50 disabled:text-slate-500 transition-shadow';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(inputClass, 'h-12', className)} {...props} />
  ),
);

Input.displayName = 'Input';

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-slate-200/90 bg-white p-6 shadow-card sm:p-7',
        className,
      )}
      {...props}
    />
  );
}

export type NoticeValue = { kind: 'success' | 'error' | 'info'; message: string };

export function Notice({ value, onClose }: { value: NoticeValue; onClose?: () => void }) {
  const Icon =
    value.kind === 'success' ? CheckCircle2 : value.kind === 'error' ? AlertCircle : Info;
  return (
    <div
      role={value.kind === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-3 rounded-xl border p-4 text-sm leading-7',
        value.kind === 'error'
          ? 'border-rose-200 bg-rose-50 text-rose-800'
          : value.kind === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-amber-200 bg-amber-50 text-amber-900',
      )}
    >
      <Icon size={19} className="mt-1 shrink-0" />
      <span className="flex-1">{value.message}</span>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق التنبيه"
          className="mt-1 rounded focus-visible:ring-2"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
// ── نموذج بيانات الربط وكلمة المرور ──

interface Props {
  settings: PublicSettings;
  onSaved: (settings: PublicSettings) => void;
  onDirty: (dirty: boolean) => void;
  onCheck: () => void;
  checking: boolean;
  sending: boolean;
}

export function SettingsForm({ settings, onSaved, onDirty, onCheck, checking, sending }: Props) {
  const [username, setUsername] = useState(settings.username);
  const [password, setPassword] = useState('');
  const [savedPassword, setSavedPassword] = useState('');
  const [sender, setSender] = useState(settings.sender);
  const [countryCode, setCountryCode] = useState(settings.countryCode);
  const [showPassword, setShowPassword] = useState(false);
  const dirty =
    username !== settings.username ||
    sender !== settings.sender ||
    countryCode !== settings.countryCode ||
    (password !== '' && password !== savedPassword);
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  const save = useMutation({
    mutationFn: api.saveSettings,
    onSuccess: (value, submitted) => {
      setUsername(value.username);
      setSender(value.sender);
      setCountryCode(value.countryCode);
      if (submitted.password) setSavedPassword(submitted.password);
      setShowPassword(false);
      onSaved(value);
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (save.isPending) return;
    save.mutate({
      username,
      sender,
      countryCode,
      password: password && password !== savedPassword ? password : undefined,
    });
  }
  return (
    <Card aria-labelledby="settings-title" className="flex flex-col">
      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
          <h2 id="settings-title" className="section-title">
            بيانات الربط
          </h2>
          <p className="muted-copy mt-1">أدخل بيانات اشتراكك لربط رقم واتساب</p>
        </div>
        <span className="rounded-xl bg-emerald-50 p-2.5 text-primary">
          <ShieldCheck size={21} />
        </span>
      </div>
      <form onSubmit={submit} className="flex flex-1 flex-col gap-6">
        <fieldset
          disabled={save.isPending || sending}
          className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2"
        >
          <div>
            <label htmlFor="username" className="field-label">
              اسم المستخدم
            </label>
            <Input
              id="username"
              name="username"
              autoComplete="username"
              required
              maxLength={100}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="أدخل اسم المستخدم"
            />
          </div>
          <div>
            <label htmlFor="password" className="field-label">
              كلمة المرور
            </label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required={!settings.hasPassword}
                maxLength={500}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={settings.hasPassword ? '••••••••' : 'أدخل كلمة المرور'}
                className="pl-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                aria-pressed={showPassword}
                className="absolute inset-y-0 left-0 flex w-11 items-center justify-center rounded-lg text-slate-400 hover:text-primary focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {settings.hasPassword && (
              <p className="mt-2 text-[10px] leading-5 text-slate-400">
                {password && password !== savedPassword
                  ? 'سيتم تحديث كلمة المرور عند الحفظ'
                  : 'كلمة المرور محفوظة. يمكنك إدخال كلمة جديدة لتغييرها'}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="sender" className="field-label">
              رقم جوال المرسل
            </label>
            <Input
              id="sender"
              name="sender"
              type="tel"
              dir="ltr"
              autoComplete="tel-national"
              required
              maxLength={30}
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              placeholder="5XXXXXXXX"
            />
          </div>
          <div>
            <label htmlFor="country" className="field-label">
              مفتاح الدولة
            </label>
            <Input
              id="country"
              name="country"
              type="tel"
              dir="ltr"
              required
              maxLength={4}
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              placeholder="+966"
            />
          </div>
        </fieldset>
        {save.error && <Notice value={{ kind: 'error', message: save.error.message }} />}
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-1">
          <Button
            type="submit"
            disabled={save.isPending || sending || (!dirty && settings.hasPassword)}
          >
            {save.isPending ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}{' '}
            {save.isPending ? 'جارٍ الحفظ…' : 'حفظ الإعدادات'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!settings.hasPassword || dirty || checking || save.isPending || sending}
            onClick={onCheck}
          >
            {checking && <Loader2 size={16} className="animate-spin" />}فحص الحساب
          </Button>
          {dirty && settings.hasPassword && (
            <span className="text-[10px] text-amber-700">تغييرات غير محفوظة</span>
          )}
        </div>
      </form>
    </Card>
  );
}
// ── عرض رمز QR ──

export function QrCard({
  linked,
  ready,
  result,
  loading,
  error,
  onGenerate,
}: {
  linked: boolean;
  ready: boolean;
  result?: QrResult;
  loading: boolean;
  error?: string;
  onGenerate: () => void;
}) {
  return (
    <Card className="flex flex-col items-center text-center" aria-labelledby="qr-title">
      <h2 id="qr-title" className="section-title w-full text-right">
        ربط واتساب
      </h2>
      <div className="my-5 flex h-[190px] w-[190px] shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white p-2.5">
        {loading ? (
          <Loader2
            size={36}
            className="animate-spin text-primary"
            aria-label="جارٍ تحميل رمز الربط"
          />
        ) : linked ? (
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-full bg-emerald-50 p-5">
              <CheckCircle2 size={48} className="text-primary" />
            </div>
            <span className="text-sm font-semibold text-primary">الحساب مرتبط</span>
          </div>
        ) : result && ready ? (
          <img
            src={result.image}
            alt="رمز ربط حساب واتساب"
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 text-slate-300">
            <QrCode size={76} strokeWidth={1.1} />
            <span className="text-[11px] text-slate-400">سيظهر رمز الربط هنا</span>
          </div>
        )}
      </div>
      <p className="max-w-[290px] text-xs leading-7 text-slate-500">
        {linked
          ? 'يمكنك الآن إرسال الرسائل والمرفقات من نظامك'
          : ready
            ? 'امسح الرمز من الأجهزة المرتبطة في واتساب'
            : 'احفظ بيانات الربط لعرض رمز QR'}
      </p>
      {error && (
        <p role="alert" className="mt-3 text-xs leading-6 text-rose-700">
          {error}
        </p>
      )}
      <Button
        variant="outline"
        className="mt-5 min-w-40"
        disabled={!ready || loading || linked}
        onClick={onGenerate}
      >
        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        {result ? 'تحديث QR' : 'عرض QR'}
      </Button>
      <div className="mt-5 flex items-center gap-1.5 text-[10px] text-slate-400">
        <Smartphone size={13} />
        <span>{result ? 'يجري فحص حالة الربط تلقائيًا' : 'اربط الرقم قبل أول عملية إرسال'}</span>
      </div>
    </Card>
  );
}
// ── إرسال الرسالة والمرفق ──

export function SendForm({
  ready,
  onBusy,
  onResult,
  onLogs,
}: {
  ready: boolean;
  onBusy: (busy: boolean) => void;
  onResult: () => void;
  onLogs: () => void;
}) {
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File>();
  const [fileVersion, setFileVersion] = useState('');
  const [notice, setNotice] = useState<NoticeValue>();
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const attempt = useRef<{ signature: string; key: string }>();
  const send = useMutation({ mutationFn: api.send });

  function selectFile(selected?: File) {
    if (!selected) return;
    const extension = '.' + selected.name.split('.').pop()?.toLowerCase();
    if (
      !(ALLOWED_EXTENSIONS as readonly string[]).includes(extension) ||
      !selected.size ||
      selected.size > MAX_UPLOAD_BYTES
    ) {
      setNotice({ kind: 'error', message: 'اختر ملفًا مدعومًا غير فارغ لا يتجاوز 10 ميجابايت.' });
      if (input.current) input.current.value = '';
      return;
    }
    setFile(selected);
    setFileVersion(crypto.randomUUID());
    setNotice(undefined);
  }
  function removeFile() {
    setFile(undefined);
    setFileVersion('');
    if (input.current) input.current.value = '';
  }
  function presentResult(result: MessageResult) {
    const kind =
      result.state === 'accepted' ? 'success' : result.state === 'failed' ? 'error' : 'info';
    setNotice({ kind, message: result.description });
    if (result.state === 'accepted') {
      setMessage('');
      removeFile();
      attempt.current = undefined;
    }
    // Explicit rejection permits a user-initiated retry; uncertain outcomes retain their key.
    if (result.state === 'failed') attempt.current = undefined;
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready || busy.current) return;
    if (!message.trim() && !file) {
      setNotice({ kind: 'error', message: 'اكتب رسالة أو اختر مرفقًا للإرسال.' });
      return;
    }
    const signature = JSON.stringify([recipient.trim(), message.trim(), fileVersion]);
    if (attempt.current?.signature !== signature)
      attempt.current = { signature, key: crypto.randomUUID() };
    busy.current = true;
    onBusy(true);
    setNotice(undefined);
    try {
      presentResult(await send.mutateAsync({ recipient, message, file, key: attempt.current.key }));
    } catch (error) {
      setNotice({
        kind: 'error',
        message: error instanceof Error ? error.message : 'تعذر إتمام الإرسال.',
      });
    } finally {
      busy.current = false;
      onBusy(false);
      onResult();
    }
  }
  return (
    <Card aria-labelledby="send-title">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h2 id="send-title" className="section-title">
            إرسال رسالة
          </h2>
          <p className="muted-copy mt-1">أرسل رسالة أو مرفقًا إلى عميلك</p>
        </div>
        <div className="rounded-xl bg-emerald-50 p-2.5 text-primary">
          <Send size={20} />
        </div>
      </div>
      <form onSubmit={submit} className="space-y-5">
        <fieldset
          disabled={!ready || send.isPending}
          className="grid gap-6 lg:grid-cols-[1.35fr_1fr]"
        >
          <div className="space-y-5">
            <div>
              <label htmlFor="recipient" className="field-label">
                رقم جوال المستلم
              </label>
              <Input
                id="recipient"
                type="tel"
                dir="ltr"
                required
                maxLength={30}
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="+966 5XXXXXXXX"
              />
            </div>
            <div>
              <label htmlFor="message" className="field-label">
                نص الرسالة
              </label>
              <textarea
                id="message"
                maxLength={10_000}
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="اكتب رسالتك هنا…"
                className={cn(inputClass, 'min-h-[112px] resize-y py-3 leading-7')}
              />
            </div>
          </div>
          <div className="flex flex-col">
            <span id="attachment-label" className="field-label">
              المرفق <span className="mr-1 font-normal text-slate-400">(اختياري)</span>
            </span>
            <input
              ref={input}
              type="file"
              accept={ALLOWED_EXTENSIONS.join(',')}
              className="sr-only"
              tabIndex={-1}
              aria-label="اختيار مرفق"
              onChange={(e) => selectFile(e.target.files?.[0])}
            />
            <div
              className={cn(
                'flex min-h-[220px] flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 transition-colors',
                dragging ? 'border-primary bg-emerald-50' : 'border-slate-200 bg-slate-50/40',
              )}
              onDragOver={(e) => {
                e.preventDefault();
                if (ready && !send.isPending) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (ready && !send.isPending) selectFile(e.dataTransfer.files[0]);
              }}
            >
              {file ? (
                <>
                  <FileCheck2 size={34} strokeWidth={1.5} className="mb-3 text-primary" />
                  <p dir="auto" className="max-w-full truncate text-sm font-medium text-slate-700">
                    {file.name}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    {(file.size / 1024 / 1024).toLocaleString('ar', { maximumFractionDigits: 2 })}{' '}
                    ميجابايت
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-3 text-rose-600"
                    onClick={removeFile}
                  >
                    <X size={14} />
                    إزالة المرفق
                  </Button>
                </>
              ) : (
                <>
                  <Paperclip size={32} strokeWidth={1.6} className="mb-3 text-slate-500" />
                  <button
                    type="button"
                    className="rounded px-2 py-1 text-sm font-semibold text-primary hover:underline focus-visible:ring-2 disabled:opacity-50"
                    onClick={() => input.current?.click()}
                  >
                    اضغط لاختيار ملف
                  </button>
                  <p className="mt-2 text-center text-xs leading-7 text-slate-400">
                    أو اسحب الملف وأفلته هنا
                    <br />
                    صورة، مستند، صوت أو فيديو · حتى 10 ميجابايت
                  </p>
                </>
              )}
            </div>
          </div>
        </fieldset>
        {notice && <Notice value={notice} onClose={() => setNotice(undefined)} />}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-5">
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={!ready || send.isPending}>
              {send.isPending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
              {send.isPending ? 'جارٍ الإرسال…' : 'إرسال الرسالة'}
            </Button>
            {!ready && <span className="text-[10px] text-slate-400">احفظ بيانات الربط أولًا</span>}
          </div>
          <Button type="button" variant="ghost" size="sm" className="text-primary" onClick={onLogs}>
            <History size={16} />
            عرض سجل الإرسال
          </Button>
        </div>
      </form>
    </Card>
  );
}
// ── سجل الإرسال ──

export function LogsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [page, setPage] = useState(1);
  const logs = useQuery({
    queryKey: ['whatsapp', 'logs', page],
    queryFn: () => api.logs(page),
    enabled: open,
    placeholderData: keepPreviousData,
    refetchInterval: (query) =>
      open && query.state.data?.items.some((item) => item.state === 'pending') ? 3000 : false,
  });
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[2px]" />
        <Dialog.Content
          dir="rtl"
          className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl focus:outline-none sm:p-8"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="flex items-center gap-2 text-lg font-bold">
                <History size={22} className="text-primary" />
                سجل الإرسال
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-xs leading-7 text-slate-500">
                نتيجة كل عملية كما أكدتها الخدمة. قبول الطلب لا يؤكد تسليمه للمستلم.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="إغلاق سجل الإرسال">
                <X size={20} />
              </Button>
            </Dialog.Close>
          </div>
          <div className="my-5 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {logs.data ? `${logs.data.total.toLocaleString('ar')} عملية` : ''}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void logs.refetch()}
              disabled={logs.isFetching}
            >
              <RefreshCw size={14} className={logs.isFetching ? 'animate-spin' : ''} />
              تحديث
            </Button>
          </div>
          {logs.error ? (
            <Notice value={{ kind: 'error', message: logs.error.message }} />
          ) : logs.isPending ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-primary" />
            </div>
          ) : !logs.data?.items.length ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center">
              <History size={35} className="mx-auto mb-4 text-slate-300" />
              <p className="text-sm text-slate-500">لا توجد عمليات إرسال حتى الآن</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    {['المستلم', 'الرسالة', 'الحالة', 'التاريخ'].map((title) => (
                      <th key={title} className="whitespace-nowrap p-3 font-medium">
                        {title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.data.items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="p-3">
                        <span dir="ltr" className="inline-block font-medium">
                          {item.recipient}
                        </span>
                      </td>
                      <td className="min-w-[160px] max-w-[260px] p-3">
                        <p className="line-clamp-2 leading-6">{item.preview || 'مرفق'}</p>
                        {item.fileName && (
                          <p className="mt-1 truncate text-[10px] text-slate-400" dir="auto">
                            {item.fileName}
                          </p>
                        )}
                      </td>
                      <td className="min-w-[180px] p-3">
                        <span
                          className={
                            item.state === 'accepted'
                              ? 'text-primary'
                              : item.state === 'failed'
                                ? 'text-rose-700'
                                : 'text-amber-700'
                          }
                        >
                          {stateLabels[item.state]}
                        </span>
                        <p className="mt-1 text-[10px] leading-5 text-slate-400">
                          {item.description}
                        </p>
                      </td>
                      <td className="whitespace-nowrap p-3 text-[10px] text-slate-500">
                        {new Date(item.createdAt).toLocaleString('ar', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-6 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1 || logs.isFetching}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronRight size={14} />
              السابق
            </Button>
            <span className="text-xs text-slate-400">الصفحة {page.toLocaleString('ar')}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={
                !logs.data || page * logs.data.pageSize >= logs.data.total || logs.isFetching
              }
              onClick={() => setPage((p) => p + 1)}
            >
              التالي
              <ChevronLeft size={14} />
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
// ── الشاشة الرئيسية وحالة الحساب ──

export function App() {
  const client = useQueryClient();
  const [dirty, setDirty] = useState(false);
  const [sending, setSending] = useState(false);
  const [pollUntil, setPollUntil] = useState(0);
  const [logsOpen, setLogsOpen] = useState(false);
  const [notice, setNotice] = useState<NoticeValue>();
  const settings = useQuery({
    queryKey: ['whatsapp', 'settings'],
    queryFn: api.settings,
    staleTime: Infinity,
  });
  const ready = !!settings.data?.hasPassword && !dirty;
  const status = useQuery({
    queryKey: ['whatsapp', 'status', settings.data?.revision],
    queryFn: api.status,
    enabled: ready && pollUntil > Date.now(),
    refetchInterval: (query) =>
      ready && pollUntil > Date.now() && !query.state.data?.linked ? 15_000 : false,
  });
  const qr = useMutation({
    mutationFn: api.qr,
    onSuccess: () => setPollUntil(Date.now() + 120_000),
  });
  const linked = ready && status.data?.linked === true;
  function saved(value: PublicSettings) {
    client.setQueryData(['whatsapp', 'settings'], value);
    client.removeQueries({ queryKey: ['whatsapp', 'status'] });
    setPollUntil(0);
    qr.reset();
    setDirty(false);
    setNotice({
      kind: 'success',
      message: 'تم حفظ بيانات الربط. يمكنك الآن فحص الحساب أو عرض رمز QR.',
    });
  }
  const statusLabel = !settings.data?.hasPassword
    ? 'بانتظار الإعداد'
    : dirty
      ? 'تغييرات غير محفوظة'
      : status.isFetching
        ? 'جارٍ فحص الحساب'
        : status.error
          ? 'تعذر فحص الحساب'
          : linked
            ? 'واتساب مرتبط'
            : status.data?.found === false
              ? 'الحساب غير متوفر'
              : status.data
                ? 'بانتظار الربط'
                : 'لم يتم فحص الحساب';
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-3 px-5 text-xs text-slate-400 sm:px-8">
          <Settings2 size={16} />
          <span>الإعدادات</span>
          <ChevronLeft size={13} />
          <span className="font-medium text-slate-600">واتساب</span>
        </div>
      </header>
      <main className="mx-auto max-w-[1280px] px-5 pb-10 pt-8 sm:px-8 sm:pt-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100/70 text-primary">
              <MessageCircle size={32} strokeWidth={1.8} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-[28px]">
                إعدادات واتساب
              </h1>
              <p className="mt-2 text-xs leading-6 text-slate-500 sm:text-sm">
                اربط حسابك وأرسل الرسائل والمرفقات من نظامك
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2">
            <span
              role="status"
              className={cn(
                'inline-flex items-center gap-2.5 rounded-lg px-3.5 py-2 text-[11px] font-semibold',
                linked ? 'bg-emerald-100/80 text-emerald-800' : 'bg-amber-100/70 text-amber-800',
              )}
            >
              {status.isFetching ? (
                <Loader2 size={12} className="animate-spin" />
              ) : linked ? (
                <CheckCircle2 size={13} />
              ) : (
                <span className="h-2 w-2 rounded-full bg-amber-500" />
              )}
              {statusLabel}
            </span>
            {ready && status.data?.found && (
              <span className="text-[10px] text-slate-400">
                {status.data.days > 0
                  ? `متبقي ${status.data.days.toLocaleString('ar')} يومًا في الاشتراك`
                  : 'راجع صلاحية الاشتراك'}
              </span>
            )}
          </div>
        </div>
        {notice && (
          <div className="mb-5">
            <Notice value={notice} onClose={() => setNotice(undefined)} />
          </div>
        )}
        {status.error && ready && (
          <div className="mb-5">
            <Notice value={{ kind: 'error', message: status.error.message }} />
          </div>
        )}
        {settings.isPending ? (
          <div aria-label="جارٍ تحميل الإعدادات" className="space-y-5 animate-pulse">
            <div className="h-[390px] rounded-2xl bg-slate-200/60" />
            <div className="h-[320px] rounded-2xl bg-slate-200/60" />
          </div>
        ) : settings.error || !settings.data ? (
          <div className="space-y-4">
            <Notice
              value={{ kind: 'error', message: settings.error?.message ?? 'تعذر تحميل الإعدادات.' }}
            />
            <Button variant="outline" onClick={() => void settings.refetch()}>
              إعادة المحاولة
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid items-stretch gap-5 lg:grid-cols-[1.65fr_1fr]">
              <SettingsForm
                settings={settings.data}
                onSaved={saved}
                onDirty={setDirty}
                sending={sending || qr.isPending}
                checking={status.isFetching}
                onCheck={() => {
                  setNotice(undefined);
                  void status.refetch();
                }}
              />
              <QrCard
                linked={linked}
                ready={ready}
                result={qr.data}
                loading={qr.isPending}
                error={qr.error?.message}
                onGenerate={() => {
                  setNotice(undefined);
                  qr.mutate();
                }}
              />
            </div>
            <SendForm
              key={settings.data.revision}
              ready={ready}
              onBusy={setSending}
              onLogs={() => setLogsOpen(true)}
              onResult={() => {
                void client.invalidateQueries({ queryKey: ['whatsapp', 'logs'] });
              }}
            />
          </div>
        )}
        <footer className="mt-7 text-center text-[10px] leading-6 text-slate-400">
          إدارة ربط واتساب والرسائل من مكان واحد
        </footer>
      </main>
      <LogsDialog open={logsOpen} onOpenChange={setLogsOpen} />
    </div>
  );
}
// ── تشغيل واجهة React ──

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false, staleTime: 15_000 },
    mutations: { retry: false },
  },
});

export function mountWhatsApp(element: HTMLElement) {
  ReactDOM.createRoot(element).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </React.StrictMode>,
  );
}
