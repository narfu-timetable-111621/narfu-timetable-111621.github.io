import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs/promises';
const source=await fs.readFile(new URL('./push-client.js',import.meta.url),'utf8');
function client({apple=false,installed=true,permission='default'}={}){
 const elements=new Map(),calls=[],saved=new Map();let prompts=0,subscriptions=0;
 const el=id=>{if(!elements.has(id))elements.set(id,{value:id==='subgroup'||id==='language'?'all':'15',checked:true,disabled:true,hidden:false,textContent:'',dataset:{},addEventListener(){}});return elements.get(id);};
 const subscription={toJSON:()=>({endpoint:'test'}),unsubscribe:async()=>true};
 const registration={pushManager:{getSubscription:async()=>null,subscribe:async()=>{subscriptions++;return subscription;}}};
 const notification={permission,requestPermission:async()=>{prompts++;notification.permission='granted';return 'granted';}};
 const window={PushManager:function(){},Notification:notification,matchMedia:()=>({matches:installed})};
 const scope=vm.createContext({window,Notification:notification,navigator:{userAgent:apple?'iPhone':'Desktop',standalone:installed,serviceWorker:{register:async()=>registration,ready:Promise.resolve(registration)}},store:{get:()=>null,set:(k,v)=>saved.set(k,v)},$:el,uiLanguage:'both',tr:(a,b)=>a+' / '+b,applyLanguage(){},URL,AbortSignal,Uint8Array,atob,fetch:async(url,init)=>{calls.push({url,init});return Response.json(url.endsWith('config')?{enabled:true,publicKey:Buffer.alloc(65,3).toString('base64url')}:{ok:true,connected:false});}});
 vm.runInContext(source,scope);return {scope,el,calls,saved,prompts:()=>prompts,subscriptions:()=>subscriptions};
}
test('opening settings loads configuration without requesting permission or subscribing',async()=>{
 const h=client();await h.scope.window.initPushSettings();assert.equal(h.prompts(),0);assert.equal(h.subscriptions(),0);assert.equal(h.el('push-enable').disabled,false);
});
test('permission is requested only by tapping enable, then the device preferences are saved',async()=>{
 const h=client();await h.scope.window.initPushSettings();await h.el('push-enable').onclick();assert.equal(h.prompts(),1);assert.equal(h.subscriptions(),1);
 const body=JSON.parse(h.calls.find(c=>c.url.endsWith('subscribe')).init.body);assert.equal(body.changes,true);assert.equal(body.reminders,true);assert.equal(body.language,'all');assert.equal(h.el('push-test').disabled,false);
});
test('an iPhone browser tab shows installation instructions without prompting',async()=>{
 const h=client({apple:true,installed:false});await h.scope.window.initPushSettings();assert.equal(h.prompts(),0);assert.equal(h.calls.length,0);assert.match(h.el('push-status').textContent,/主屏幕/);
});
test('the complete page accepts the date from a notification click',async()=>{
 const page=await fs.readFile(new URL('./docs/index.html',import.meta.url),'utf8');
 const start=page.indexOf('const requestedDate='),end=page.indexOf(';',page.indexOf('let data=BOOTSTRAP_DATA',start))+1;
 assert.ok(start>=0);const code=page.slice(start,end);
 const scope=vm.createContext({URL,Date,location:{href:'https://narfu-live-111621.vercel.app/?date=2027-02-12'},BOOTSTRAP_DATA:{},monday:d=>d,todayMSK:()=> '2026-11-03'});
 vm.runInContext(code,scope);assert.equal(vm.runInContext('selected',scope),'2027-02-12');
});
