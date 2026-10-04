// Every file the app ships. The dev server serves exactly these, and
// `npm run release` copies exactly these into dist/. Keep APP_FILES in sw.js in step.
export const SHIPPED_FILES = [
  'index.html', 'styles.css', 'app.js', 'progressions.js', 'pwa.js', 'version.js', 'sw.js',
  'manifest.webmanifest', 'favicon.svg',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png',
];
