const CACHE='galaxia-shell-v45';
const SHELL=['./','./index.html','./app.css','./app.js','./install.js','./theme.js','./dates.js','./insights.js','./icon.svg','./garden.svg','./manifest.webmanifest'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(url.origin!==location.origin)return;
 if(url.pathname.includes('/api/')||url.pathname.includes('/auth/'))return;
 if(event.request.mode==='navigate'){event.respondWith(fetch(event.request,{cache:'no-store'}).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put('./index.html',copy));return r;}).catch(()=>caches.match('./index.html')));return;}
 event.respondWith(fetch(event.request,{cache:'no-store'}).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));}return r;}).catch(()=>caches.match(event.request)));
});
self.addEventListener('push',event=>{
 const data=event.data?.json?.()||{};
 event.waitUntil(self.registration.showNotification(data.title||'Nuestra galaxia',{body:data.body||'Hay algo nuevo esperándote.',icon:'./icon.svg',badge:'./icon.svg',data:{url:data.url||'./'}}));
});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>list[0]?list[0].focus():clients.openWindow(event.notification.data?.url||'./')));});
