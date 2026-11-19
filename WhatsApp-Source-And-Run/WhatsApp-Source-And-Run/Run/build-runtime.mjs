// Rebuild the portable Windows x64 runtime after installing and building Source.
// Run from any directory: node Run/build-runtime.mjs
import {
  cpSync,
  existsSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const destination = dirname(fileURLToPath(import.meta.url));
const source = resolve(process.argv[2] ?? join(destination, '../Source'));
if (process.platform !== 'win32' || process.arch !== 'x64') {
  throw new Error('Build this portable edition using Node.js for Windows x64.');
}
if (!existsSync(join(source, 'dist/index.html'))) {
  throw new Error('Run pnpm install --frozen-lockfile and pnpm build in Source first.');
}
const requireSource = createRequire(join(source, 'package.json'));
const requireVite = createRequire(requireSource.resolve('vite/package.json'));
const { build } = requireVite('esbuild');
const result = await build({
  absWorkingDir: source,
  entryPoints: ['server.ts'],
  outfile: join(destination, 'server.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22.12',
  sourcemap: false,
  metafile: true,
  legalComments: 'inline',
  banner: {
    js: "import { createRequire as portableCreateRequire } from 'node:module';\nconst require = portableCreateRequire(import.meta.url);",
  },
  external: ['./better_sqlite3.node'],
  plugins: [
    {
      name: 'portable-sqlite-location',
      setup(builder) {
        builder.onResolve({ filter: /^bindings$/ }, (args) => {
          if (!args.importer.replaceAll('\\', '/').includes('/better-sqlite3/')) return;
          return { path: 'sqlite-binding', namespace: 'portable' };
        });
        builder.onLoad({ filter: /.*/, namespace: 'portable' }, () => ({
          // Only the native module location changes; the application source stays intact.
          contents:
            'module.exports = function (name) { if (name !== "better_sqlite3.node") throw new Error("Unexpected native module"); return require("./better_sqlite3.node"); };',
          loader: 'js',
        }));
      },
    },
  ],
});

const sqliteRoot = dirname(requireSource.resolve('better-sqlite3/package.json'));
cpSync(
  join(sqliteRoot, 'build/Release/better_sqlite3.node'),
  join(destination, 'better_sqlite3.node'),
);
cpSync(process.execPath, join(destination, 'node.exe'));
cpSync(join(source, 'dist'), join(destination, 'dist'), { recursive: true });

// Include third-party notices with the compiled libraries and font.
const packages = new Map();
function findPackage(filename) {
  let directory = dirname(realpathSync(filename));
  while (directory !== dirname(directory)) {
    const manifest = join(directory, 'package.json');
    if (existsSync(manifest)) {
      const data = JSON.parse(readFileSync(manifest, 'utf8'));
      if (data.name && data.version) return { directory, data };
    }
    directory = dirname(directory);
  }
  throw new Error('Package metadata missing.');
}
function collectPackage(filename) {
  const item = findPackage(filename);
  const id = item.data.name + '@' + item.data.version;
  if (packages.has(id)) return;
  packages.set(id, item);
  const requirePackage = createRequire(join(item.directory, 'package.json'));
  for (const dependency of Object.keys(item.data.dependencies ?? {})) {
    let entry;
    try {
      entry = requirePackage.resolve(dependency + '/package.json');
    } catch {
      entry = requirePackage.resolve(dependency);
    }
    collectPackage(entry);
  }
}
for (const dependency of Object.keys(
  JSON.parse(readFileSync(join(source, 'package.json'), 'utf8')).dependencies,
)) {
  let entry;
  try {
    entry = requireSource.resolve(dependency + '/package.json');
  } catch {
    entry = requireSource.resolve(dependency);
  }
  collectPackage(entry);
}
const notices = [
  'THIRD-PARTY SOFTWARE NOTICES\nBundled application dependencies and their notices.\n',
];
const missingNotices = [];
for (const [id, item] of [...packages].sort(([a], [b]) => a.localeCompare(b))) {
  notices.push(
    '\n' +
      '='.repeat(72) +
      '\n' +
      id +
      '\nLicense: ' +
      JSON.stringify(item.data.license ?? 'See package') +
      '\n',
  );
  const licenseFiles = readdirSync(item.directory).filter((name) =>
    /^(license|licence|copying|notice)(\.|$|-)/i.test(name),
  );
  if (!licenseFiles.length && item.data.name === 'react-remove-scroll-bar') {
    const url =
      'https://raw.githubusercontent.com/theKashey/react-remove-scroll-bar/master/LICENSE';
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error('Could not retrieve the scroll-bar library license.');
    const text = await response.text();
    if (!text.includes('Permission is hereby granted'))
      throw new Error('Unexpected library license response.');
    notices.push(url + '\n' + text);
  } else if (!licenseFiles.length) missingNotices.push(id);
  for (const name of licenseFiles)
    notices.push(name + '\n' + readFileSync(join(item.directory, name), 'utf8'));
}
writeFileSync(join(destination, 'THIRD-PARTY-NOTICES.txt'), notices.join('\n'));
if (missingNotices.length)
  throw new Error('Missing third-party notices: ' + missingNotices.join(', '));
const licenseUrl = `https://raw.githubusercontent.com/nodejs/node/${process.version}/LICENSE`;
const response = await fetch(licenseUrl, { signal: AbortSignal.timeout(30_000) });
if (!response.ok) throw new Error('Could not download the matching Node.js license.');
const nodeLicense = await response.text();
if (!nodeLicense.includes('Permission is hereby granted'))
  throw new Error('Unexpected Node.js license response.');
writeFileSync(
  join(destination, 'NODE-LICENSE.txt'),
  `Node.js ${process.version}\n${licenseUrl}\n\n${nodeLicense}`,
);
console.log(
  JSON.stringify({
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    bundledInputs: Object.keys(result.metafile.inputs).length,
    notices: packages.size,
    missingNotices,
  }),
);
