# ربط واتساب — النسخة المختصرة

شاشة عربية لحفظ بيانات الربط، عرض QR، فحص الحساب، إرسال النصوص والمرفقات، وعرض سجل الإرسال. الحزمة **13 ملفًا**؛ لم تُرفق المكتبات أو ملفات البناء أو بيانات حسابات.

## أين أجد الكود؟

| الملف                    | وظيفته                                                         |
| ------------------------ | -------------------------------------------------------------- |
| `WhatsApp.tsx`           | الشاشة كاملة، مقسمة بتعليقات إلى الإعدادات وQR والإرسال والسجل |
| `whatsapp.ts`            | الاتصال بمزود واتساب، رابط الخدمة ورقم الشركة الثابت `0058`    |
| `database.ts`            | حفظ الإعدادات والسجل في SQLite وتشفير كلمة المرور              |
| `server.ts`              | مسارات API، التحقق من المدخلات، منطق الإرسال والتشغيل المحلي   |
| `types.ts` و`styles.css` | الأنواع المشتركة والتنسيق                                      |
| بقية الملفات             | إعدادات التشغيل والبناء وإصدارات المكتبات وهذا الشرح           |

رابط الخدمة ورقم الشركة في الخلفية ولا يظهران في الشاشة. كلمة المرور تبقى مخفية في الحقل بعد الحفظ، ولا تعيدها API للمتصفح. عند تحديث الصفحة تظهر علامة تدل على أنها محفوظة.

## التشغيل

المتطلبات: Node.js إصدار 22.12 أو أحدث، وpnpm إصدار 11.25.0. من داخل هذا المجلد:

```sh
npm install -g pnpm@11.25.0
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

افتح `http://127.0.0.1:3100`. أدخل اسم المستخدم وكلمة المرور ورقم المرسل ومفتاح الدولة، ثم احفظ واضغط «عرض QR».

للتعديل مع التحديث التلقائي: `pnpm dev` ثم افتح `http://127.0.0.1:5173`. لفحص TypeScript: `pnpm typecheck`.

تظهر مجلدات `node_modules` و`dist` عند التثبيت والبناء، و`data` عند التشغيل. هذه ملفات يولدها البرنامج وليست جزءًا من الملفات الـ13 المسلّمة. يمكن تغيير `PORT` و`DATA_DIRECTORY` بمتغيرات البيئة أو ملف `.env` محلي.

## الدمج في نظام الشركة

استخدم اعتمادات `package.json` وأضف الملفات إلى المشروع. في React استورد `App` من `WhatsApp.tsx` واعرض `<App />` داخل `QueryClientProvider` الموجود في النظام. انقل إعدادات Tailwind من `vite.config.ts` إلى إعدادات النظام، وأدرج `WhatsApp.tsx` ضمن مسارات `content`.

في Express، بعد إعداد JSON وجلسة المستخدم:

```ts
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { Repository, loadSecretBox } from './database.js';
import { HttpWhatsAppProvider } from './whatsapp.js';
import { createWhatsAppRouter, errorHandler } from './server.js';

mkdirSync('./data', { recursive: true });
const repository = new Repository(new Database('./data/whatsapp.sqlite'), loadSecretBox('./data'));
const provider = new HttpWhatsAppProvider();

app.use(
  '/api/whatsapp',
  createWhatsAppRouter({
    repository,
    provider,
    authorize: requireWhatsAppPermission,
  }),
);
app.use(errorHandler);
```

`app` هو تطبيق Express الموجود. استبدل `requireWhatsAppPermission` بفحص تسجيل الدخول والصلاحيات الفعلي في نظام الشركة، واربط حماية CSRF الخاصة به. التشغيل المستقل محلي على الجهاز؛ استيراد `server.ts` لا يشغّل خادمًا إضافيًا. عند بدء عامل واحد مسؤول عن الإرسال، شغّل `repository.recoverInterruptedMessages()` مرة واحدة قبل استقبال الطلبات.

للإرسال من حجز أو فاتورة في الخلفية:

```ts
import { WhatsAppService } from './server.js';

const whatsapp = new WhatsAppService(repository, provider);
const result = await whatsapp.send({
  key: `booking:${booking.id}:confirmation:v1`,
  recipient: booking.customerPhone,
  message: `تم تأكيد حجزك رقم ${booking.id}.`,
});
```

المتغير `booking` يمثل الحجز المحفوظ في نظامك. أعد استخدام المفتاح نفسه عند تكرار الحدث لتجنب الإرسال المكرر. `accepted` تعني قبول الخدمة للطلب؛ الحالات `unconfirmed` و`unknown` تحتاج مراجعة قبل إرسال جديد. لا توجد إعادة إرسال تلقائية.

## البيانات وحدود النسخة

الحزمة خالية من بيانات الحساب المستخدمة أثناء التطوير. يبدأ التشغيل بإعدادات فارغة. احتفظ بقاعدة البيانات ومفتاح `data/encryption.key` معًا في مكان خاص بالخادم؛ لا ترسل مجلد `data` أو `.env` ضمن نسخ التسليم اللاحقة.

تدير النسخة حساب واتساب واحدًا لكل قاعدة بيانات، وتقبل مرفقات حتى 10 ميجابايت. السجل يحفظ المستلم وأول 160 حرفًا من الرسالة واسم المرفق والحالة. الربط مبني على مشروع C# المقدم؛ اختبر الإرسال النصي والمرفقات بحساب اختبار قبل اعتماده في نظام الشركة.
