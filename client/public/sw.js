/* 重塑系统 Service Worker
 * 版本更新时修改 CACHE_VERSION 即可触发新缓存
 */
const CACHE_VERSION = 'chongsheng-v3';
const STATIC_CACHE = `static-${CACHE_VERSION}`;

// 需要预缓存的核心静态资源路径壳
// 实际运行时静态资源由 stale-while-revalidate 策略动态缓存
const PRECACHE_URLS = [
  './',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

const API_PREFIXES = ['/api/', '/openapi/', '/__runtime__/'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/**
 * 判断是否为 API / OpenAPI / runtime 请求
 * 这类请求一律走网络，不缓存
 */
function isApiRequest(url) {
  return API_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

/**
 * 判断是否为导航请求（HTML 文档加载）
 */
function isNavigateRequest(request, url) {
  if (request.mode === 'navigate') return true;
  // 路径以 / 结尾且不是静态资源文件 → 视为导航
  const path = url.pathname;
  if (request.method === 'GET' && (path === '/' || path.endsWith('/'))) {
    return !path.match(/\.(js|css|svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot|otf|webmanifest|json|map)$/i);
  }
  return false;
}

/**
 * 判断是否为静态资源请求（带 hash 的 JS/CSS/图片等）
 */
function isStaticAsset(url) {
  const path = url.pathname;
  if (url.origin !== self.location.origin) return false;
  if (isApiRequest(url)) return false;
  const staticExts = [
    '.js',
    '.css',
    '.svg',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.ico',
    '.woff',
    '.woff2',
    '.ttf',
    '.eot',
    '.otf',
    '.webmanifest',
    '.json',
    '.map',
  ];
  return staticExts.some((ext) => path.endsWith(ext));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 仅处理 GET 请求
  if (request.method !== 'GET') return;

  // API / OpenAPI / runtime 请求：纯网络，不缓存
  if (isApiRequest(url)) {
    event.respondWith(fetch(request));
    return;
  }

  // 导航请求（HTML 文档）：network-first，确保发布后立即加载新版
  if (isNavigateRequest(request, url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 只缓存成功的同源响应
          if (response && response.status === 200 && response.type === 'basic') {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // 网络失败时回退到缓存的首页壳
          return caches.match('./');
        }),
    );
    return;
  }

  // 静态资源（带 hash 文件名）：stale-while-revalidate
  // 立即返回缓存，同时后台更新，下次加载生效
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.status === 200 && response.type === 'basic') {
              const responseClone = response.clone();
              caches.open(STATIC_CACHE).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return response;
          })
          .catch(() => cached || new Response('Offline', { status: 503 }));
        return cached || networkFetch;
      }),
    );
    return;
  }

  // 其他请求：直接走网络
  event.respondWith(fetch(request));
});
