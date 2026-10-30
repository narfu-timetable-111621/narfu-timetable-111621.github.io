import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import vm from 'node:vm';
import {wireLiveSync} from './live-client.mjs';
const original=await fs.readFile(new URL('./docs/index.html',import.meta.url),'utf8');
const page=await wireLiveSync(original,'https://api.example/api/timetable');
const client=page.match(/<script>([\s\S]*?)<\/script>/)[1];new Function(client);
const syncCode=client.slice(client.indexOf('function status(mode,error)'),client.indexOf("$('days').addEventListener"));
const template=JSON.parse(await fs.readFile(new URL('./docs/data/timetable.json',import.meta.url),'utf8'));
const liveData=start=>({...template,fresh:true,via:'live-proxy',retrievedAt:new Date().toISOString(),events:[{...template.events[0],start,end:'09:35'}]});
function context(fetchImpl){
 const elements=new Map(),cached={...template,retrievedAt:new Date(Date.now()-3600000).toISOString()};
 const scope=vm.createContext({Date,URL,AbortSignal,navigator:{onLine:true},data:cached,lastSuccess:0,busy:false,lastAttempt:0,
  $:id=>{if(!elements.has(id))elements.set(id,{textContent:'',disabled:false,style:{},classList:{toggle(){}}});return elements.get(id);},
  tr:(zh,ru)=>zh+' / '+ru,stamp:value=>value,applyLanguage(){},render(){},store:{set(){}},fetch:fetchImpl});
 vm.runInContext(syncCode,scope);return {scope,elements,cached};
}
test('each refresh contacts the live backend and displays a changed class time',async()=>{
 let calls=0;const {scope,elements}=context(async(url,options)=>{assert.match(url,/^https:\/\/api.example\/api\/timetable\?check=/);assert.equal(options.cache,'no-store');assert.equal(options.credentials,'omit');return Response.json(liveData(++calls===1?'08:00':'07:00'));});
 await scope.sync();assert.equal(scope.data.events[0].start,'08:00');await scope.sync();assert.equal(scope.data.events[0].start,'07:00');assert.equal(calls,2);assert.match(elements.get('syncstate').textContent,/已与学校同步/);assert.equal(elements.get('refresh').disabled,false);
});
test('a failed live read retains previous classes and visibly reports failure',async()=>{
 const {scope,elements,cached}=context(async()=>new Response('Unavailable',{status:502}));
 await scope.sync();assert.equal(scope.data,cached);assert.match(elements.get('notice').textContent,/本次未能同步学校最新课表/);assert.equal(elements.get('refresh').disabled,false);
});
test('old published JSON cannot be reported as a live school update',async()=>{
 const {scope,elements,cached}=context(async()=>Response.json({...template,fresh:true,via:'github-actions'}));
 await scope.sync();assert.equal(scope.data,cached);assert.match(elements.get('notice').textContent,/旧数据/);
});
test('the download uses the displayed data, with explicit Moscow-to-UTC time conversion',async()=>{
 const {scope}=context(async()=>Response.json(liveData('07:00')));await scope.sync();
 scope.enrichEvent=e=>e;scope.TextEncoder=TextEncoder;
 vm.runInContext(await fs.readFile(new URL('./calendar-client.js',import.meta.url),'utf8'),scope);
 const ics=scope.toICS(scope.data,'all','all');
 assert.ok(ics.includes('DTSTART:'+scope.data.events[0].date.replaceAll('-','')+'T040000Z'));
 assert.ok(page.includes("new Blob([toICS(data,$('subgroup').value,$('language').value)]"));
});
test('service worker activation finishes even if a page navigation never settles',async()=>{
 const listeners=new Map(),deleted=[];let claimed=0,activation;
 const self={location:{href:'https://narfu-timetable-111621.github.io/sw.js'},addEventListener:(name,fn)=>listeners.set(name,fn),clients:{claim:async()=>{claimed++;},matchAll:async()=>[{url:'https://narfu-timetable-111621.github.io/',navigate:()=>new Promise(()=>{})}]}};
 const scope=vm.createContext({self,URL,caches:{keys:async()=>['narfu-gh-shell-v3','narfu-gh-shell-v5'],delete:async key=>deleted.push(key)}});
 vm.runInContext(await fs.readFile(new URL('./docs/sw.js',import.meta.url),'utf8'),scope);
 listeners.get('activate')({waitUntil:promise=>{activation=promise;}});
 let timer;try{await Promise.race([activation,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Activation blocked by page navigation')),500);})]);}finally{clearTimeout(timer);}
 assert.equal(claimed,1);assert.deepEqual(deleted,['narfu-gh-shell-v3']);
});
