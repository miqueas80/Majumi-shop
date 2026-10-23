/* MAJUMI PWA: caching limitado a recursos PUBLICOS, nunca al servidor de pedidos. */
const CACHE='majumi-public-v3';
const PUBLIC_ASSETS=['./','./index.html','./store.css?v=3','./store.js?v=3','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PUBLIC_ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('majumi-public-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
 const url=new URL(req.url);
 if(url.pathname.includes('/api/'))return;
 const scope=new URL('./',self.registration.scope).pathname;
 if(!url.pathname.startsWith(scope))return;
 const rel=url.pathname.slice(scope.length);
 if(rel.startsWith('admin')||rel.startsWith('api')||rel.startsWith('checkout')||rel.startsWith('payment'))return;
 if(!['','index.html','store.css','store.js','manifest.webmanifest','icon.svg'].includes(rel))return;
 if(req.mode==='navigate'){
   event.respondWith(fetch(req).then(res=>res.ok?res:caches.match('./index.html')).catch(()=>caches.match('./index.html')));
   return;
 }
 event.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(res=>{
   if(res.ok&&res.type==='basic')caches.open(CACHE).then(cache=>cache.put(req,res.clone())).catch(()=>{});
   return res;
 })));
});
