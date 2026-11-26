import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { startLocalServer } from './server.mjs';

const directory = dirname(fileURLToPath(import.meta.url));
process.chdir(directory);
process.env.PORT ??= '3120';
process.env.DATA_DIRECTORY ??= join(directory, 'data');

try {
  const server = startLocalServer();
  server.once('error', (error) => {
    console.error(
      error.code === 'EADDRINUSE'
        ? 'المنفذ مستخدم. أغلق النسخة الأخرى أو غيّر متغير PORT ثم أعد التشغيل.'
        : 'تعذر تشغيل البرنامج. تأكد من فك الضغط والسماح بالكتابة في مجلد التشغيل.',
    );
    process.exitCode = 1;
  });
  server.once('listening', () => {
    const url = `http://127.0.0.1:${process.env.PORT}/`;
    console.info('اترك هذه النافذة مفتوحة أثناء الاستخدام. للإيقاف اضغط Ctrl+C.');
    if (process.env.WHATSAPP_NO_BROWSER !== '1') {
      const browser = spawn('cmd.exe', ['/d', '/c', 'start', '', url], {
        windowsHide: true,
        stdio: 'ignore',
      });
      browser.on('error', () => console.info('افتح العنوان الموضح أعلاه في المتصفح.'));
      browser.unref();
    }
  });
} catch {
  console.error('تعذر بدء التشغيل. فك الضغط بالكامل داخل مجلد تملك صلاحية الكتابة فيه.');
  process.exitCode = 1;
}
