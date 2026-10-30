import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
import vm from 'node:vm';
const root=path.resolve(import.meta.dirname),docs=path.join(root,'docs'),page=await fs.readFile(path.join(docs,'index.html'),'utf8'),data=JSON.parse(await fs.readFile(path.join(docs,'data/timetable.json')));
const live=page.includes('const LIVE_ENDPOINT=');
new Function(page.match(/<script>([\s\S]*?)<\/script>/)[1]);new Function(await fs.readFile(path.join(docs,'preferences.js'),'utf8'));new Function(await fs.readFile(path.join(docs,'sw.js'),'utf8'));
assert.ok(data.events.length>0);assert.ok(data.events.every(e=>e.date&&e.start&&e.end&&e.title));assert.ok(data.events.filter(e=>e.teacherFullRu).every(e=>e.teacher===e.teacherFullRu&&e.teacherZh));assert.ok(page.includes('minimum-scale=1'));assert.ok(page.includes(live?'new URL(LIVE_ENDPOINT)':"fetch('./data/timetable.json?check='"));assert.ok(!page.includes("fetch('/api/"));assert.ok(!/\b(?:src|href)="\//.test(page));assert.ok(page.includes("register('./sw.js'"));
for(const group of ['all','1','2'])for(const lang of ['all','ru','en','de']){const calendar=await fs.readFile(path.join(docs,'calendars',group+'-'+lang+'.ics'),'utf8');assert.ok(calendar.includes('BEGIN:VCALENDAR'));}
assert.ok(!(await fs.readFile(path.join(docs,'preferences.js'),'utf8')).includes('requestPermission'));
// Exercise the generated browser code: old data is a delay, not a fetch failure.
const client=page.match(/<script>([\s\S]*?)<\/script>/)[1];
const syncCode=client.slice(client.indexOf('function status(mode,error)'),client.indexOf("$('days').addEventListener"));
for(const scenario of live?['fresh','error','offline']:['fresh','stale','error','offline']){
 const elements=new Map(),cached={...data,retrievedAt:new Date(Date.now()-3600000).toISOString()};
 const response={...data,via:live?'live-proxy':data.via,retrievedAt:scenario==='fresh'?new Date().toISOString():cached.retrievedAt};
 const context=vm.createContext({Date,URL,AbortSignal,navigator:{onLine:scenario!=='offline'},data:cached,lastSuccess:0,busy:false,lastAttempt:0,
  $:id=>{if(!elements.has(id))elements.set(id,{textContent:'',disabled:false,style:{},classList:{toggle(){}}});return elements.get(id);},
  tr:(zh,ru)=>zh+' / '+ru,stamp:value=>value,applyLanguage(){},render(){},store:{set(){}},
  fetch:async()=>{if(scenario==='error'||scenario==='offline')throw new Error('Network failure');return {ok:true,json:async()=>response};}});
 vm.runInContext(syncCode,context);await context.sync();
 assert.equal(elements.get('refresh').disabled,false);
 const state=elements.get('syncstate').textContent,notice=elements.get('notice').textContent;
 if(scenario==='fresh'){assert.match(state,/已读取最新发布|已与学校同步/);assert.equal(notice,'');}
 if(scenario==='stale'){assert.match(state,/后台更新延迟/);assert.doesNotMatch(notice,/学校同步暂时不可用|读取失败/);assert.ok(context.lastSuccess>0);}
 if(scenario==='error')assert.match(state,/课表读取失败/);
 if(scenario==='offline')assert.match(state,/离线课表/);
 if(scenario==='error'||scenario==='offline')assert.equal(context.data,cached);
}
console.log('PASS: relative Pages paths, sync data, twelve filtered calendars, teacher full names, mobile viewport and script syntax.');
console.log('PASS: fresh, delayed, network-failure and offline sync states preserve the correct data and status.');
