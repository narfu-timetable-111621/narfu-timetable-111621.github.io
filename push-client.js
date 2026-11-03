 const PUSH_API='https://narfu-live-111621.vercel.app/api/push/';
 let pushRegistration,pushConfig,pushSubscription,pushConnected=false,pushBusy=false,pushBound=false;
 let pushOptions;try{pushOptions=JSON.parse(store.get('narfu-push-options-v2'))||{};}catch{pushOptions={};}
 function pushMessage(zh,ru){const el=$('push-status');if(!el)return;el.dataset.i18nZh=zh;el.dataset.i18nRu=ru;el.textContent=tr(zh,ru);applyLanguage();}
 function pushPreferences(){return {minutes:Number($('push-minutes')?.value||pushOptions.minutes||15),reminders:$('push-reminders')?.checked??pushOptions.reminders!==false,changes:$('push-changes')?.checked??pushOptions.changes!==false,subgroup:$('subgroup').value,language:$('language').value,uiLanguage};}
 async function pushCall(action,body){
  const response=await fetch(PUSH_API+action,{method:body?'POST':'GET',credentials:'omit',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{Accept:'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(25000)});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'通知请求失败 / Ошибка запроса');return result;
 }
 function pushButtons(){
  const permitted=typeof Notification!=='undefined'&&Notification.permission==='granted';
  $('push-enable').disabled=pushBusy||!pushRegistration||!pushConfig?.enabled||Notification.permission==='denied';
  $('push-enable').hidden=pushConnected&&permitted;
  for(const id of ['push-save','push-test','push-disable'])$(id).disabled=pushBusy||!pushConnected||!permitted;
 }
 function pushStore(){pushOptions=pushPreferences();store.set('narfu-push-options-v2',JSON.stringify(pushOptions));}
 async function pushSave(){
  if(!pushSubscription)return;const prefs=pushPreferences();
  await pushCall('subscribe',{subscription:pushSubscription.toJSON(),...prefs});pushConnected=true;pushStore();
  pushMessage('系统通知已连接。将按当前分组与语言提醒。','Уведомления подключены с учётом выбранных подгруппы и языка.');
 }
 async function pushTask(action){
  if(pushBusy)return;pushBusy=true;pushButtons();
  try{await action();}catch(error){pushMessage(error.message,error.message);}finally{pushBusy=false;pushButtons();}
 }
 async function pushEnable(){
  // Keep requestPermission immediately inside the user's tap; no network await first.
  if(pushBusy||!pushRegistration||!pushConfig?.enabled)return;
  const permission=await Notification.requestPermission();
  if(permission!=='granted'){pushMessage('未获通知权限。请在 iPhone 设置的通知中允许本课表。','Уведомления не разрешены. Измените разрешение в настройках iPhone.');pushButtons();return;}
  await pushTask(async()=>{
   const key=pushConfig.publicKey.replace(/-/g,'+').replace(/_/g,'/');
   pushSubscription=await pushRegistration.pushManager.getSubscription()||await pushRegistration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:Uint8Array.from(atob(key),c=>c.charCodeAt(0))});
   await pushSave();
  });
 }
 window.savePushIfConnected=async()=>{
  if(!pushConnected||pushBusy)return;
  try{await pushSave();}catch{pushMessage('筛选已更新，但通知设置暂未保存，请重试。','Фильтр изменён, но настройки уведомлений не сохранены. Повторите.');}
 };
 window.initPushSettings=async()=>{
  if(!$('push-enable'))return;
  if(!pushBound){
   $('push-minutes').value=String(pushOptions.minutes||15);$('push-reminders').checked=pushOptions.reminders!==false;$('push-changes').checked=pushOptions.changes!==false;
   $('push-enable').onclick=pushEnable;
   $('push-save').onclick=()=>pushTask(pushSave);
   $('push-test').onclick=()=>pushTask(async()=>{await pushCall('test',{subscription:pushSubscription.toJSON()});pushMessage('测试通知已被推送服务接受，请检查通知中心或锁屏。','Push-сервис принял тест. Проверьте центр уведомлений или экран блокировки.');});
   $('push-disable').onclick=()=>pushTask(async()=>{await pushCall('unsubscribe',{subscription:pushSubscription.toJSON()});await pushSubscription.unsubscribe();pushSubscription=null;pushConnected=false;pushMessage('本设备通知已关闭，不影响其他同学。','Уведомления на этом устройстве отключены. Другие устройства не затронуты.');});
   for(const id of ['subgroup','language'])$(id).addEventListener('change',window.savePushIfConnected);
   pushBound=true;
  }
  const apple=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const installed=navigator.standalone||window.matchMedia('(display-mode: standalone)').matches;
  if(apple&&!installed){pushMessage('请从手机主屏幕上的课表图标打开，再开启通知。无需重新添加现有图标。','Откройте расписание значком на главном экране iPhone, затем включите уведомления. Повторно добавлять значок не нужно.');return;}
  if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window)){pushMessage('此浏览器暂不支持系统推送。iPhone 需要 iOS 16.4 或更新版本，并从主屏幕打开。','Системные push-уведомления не поддерживаются. На iPhone нужны iOS 16.4+ и запуск с главного экрана.');return;}
  try{
   pushConfig=await pushCall('config');
   if(!pushConfig.enabled){pushMessage('通知后台尚未启用，请稍后再试。','Сервер уведомлений ещё не включён. Повторите позже.');return;}
   await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});pushRegistration=await navigator.serviceWorker.ready;
   pushSubscription=await pushRegistration.pushManager.getSubscription();
   if(pushSubscription&&Notification.permission==='granted'){
    const result=await pushCall('status',{subscription:pushSubscription.toJSON()});pushConnected=result.connected;
   }else pushConnected=false;
   if(Notification.permission==='denied')pushMessage('系统已禁止通知，请到手机设置的通知中允许本课表。','Уведомления запрещены. Разрешите их в настройках телефона.');
   else if(pushConnected)pushMessage('系统通知已连接。可发送测试通知检查锁屏显示。','Уведомления подключены. Отправьте тест для проверки экрана блокировки.');
   else pushMessage('尚未开启。点击下方按钮后，在系统窗口中允许通知。','Уведомления выключены. Нажмите кнопку ниже и разрешите их в системном окне.');
   pushButtons();
  }catch(error){pushMessage('暂时无法连接通知后台，请稍后重试。','Не удалось подключиться к серверу уведомлений. Повторите позже.');}
 };
