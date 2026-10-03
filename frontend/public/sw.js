// Network required for business data. Never cache sessions, API responses or saved documents.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 if(event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(()=>new Response('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Casamelia — connection required</title><body style="font-family:Arial;padding:32px;color:#222629"><h1>CASAMELIA</h1><p>Connect to the internet to open your shared quotations.</p><p>No quotation data is stored offline.</p><button style="padding:14px" onclick="location.reload()">Try again</button></body></html>',{headers:{'Content-Type':'text/html; charset=utf-8'}})));
});
