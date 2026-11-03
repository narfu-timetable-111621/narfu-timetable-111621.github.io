self.addEventListener('push',event=>{
 let message;try{message=event.data.json();}catch{message={title:'课表通知 / Расписание',body:'请打开课表查看 / Откройте расписание'};}
 let target;try{target=new URL(message.url||'./',BASE);if(target.origin!==BASE.origin||!target.pathname.startsWith(BASE.pathname))target=BASE;}catch{target=BASE;}
 event.waitUntil(self.registration.showNotification(String(message.title||'课表通知 / Расписание'),{body:String(message.body||'请打开课表 / Откройте расписание'),icon:new URL('./icon.png?v=8',BASE).href,badge:new URL('./icon-192.png?v=8',BASE).href,tag:String(message.tag||'narfu-notice'),data:{url:target.href}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  let target;try{target=new URL(event.notification.data?.url||'./',BASE);if(target.origin!==BASE.origin||!target.pathname.startsWith(BASE.pathname))target=BASE;}catch{target=BASE;}
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const current=windows.find(client=>{try{return new URL(client.url).origin===BASE.origin;}catch{return false;}});
  if(current){try{await current.navigate(target.href);}catch{}return current.focus();}
  return self.clients.openWindow(target.href);
 })());
});
