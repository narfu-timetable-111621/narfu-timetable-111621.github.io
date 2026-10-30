import fs from 'node:fs/promises';

async function sync(){
 if(busy)return;busy=true;lastAttempt=Date.now();$('refresh').disabled=true;status('loading');
 try{
  const url=new URL(LIVE_ENDPOINT);url.searchParams.set('check',String(Date.now()));
  const res=await fetch(url.href,{cache:'no-store',credentials:'omit',headers:{Accept:'application/json'},signal:AbortSignal.timeout(23000)});
  if(!res.ok)throw new Error('HTTP '+res.status);
  const result=await res.json(),retrieved=Date.parse(result.retrievedAt);
  if(result.groupId!=='20991'||result.sourceUrl!=='https://ruz.narfu.ru/?timetable&group=20991'||result.via!=='live-proxy'||result.fresh!==true||!Array.isArray(result.events)||!Array.isArray(result.weeks)||!result.weeks.length||!Number.isFinite(retrieved)||Date.now()-retrieved>60000||retrieved-Date.now()>60000||!result.events.every(e=>e.date&&e.start&&e.end&&e.title))throw new Error('Unverified live timetable');
  data=result;store.set('narfu-timetable-v1',JSON.stringify(data));lastSuccess=Date.now();store.set('narfu-success',String(lastSuccess));render();status('fresh');
 }catch(e){render();status(navigator.onLine?'error':'offline',e.name==='TimeoutError'?'连接超时 / Время ожидания истекло':'本次未能获取学校最新课表 / Не удалось обновить расписание САФУ');}
 finally{busy=false;$('refresh').disabled=false;}
}

export async function wireLiveSync(page,endpoint,{allowLocal=false}={}){
 const url=new URL(endpoint);
 if(url.username||url.password||url.hash||url.search||(!allowLocal&&url.protocol!=='https:')||(allowLocal&&!['https:','http:'].includes(url.protocol)))throw new Error('Expected a public HTTPS timetable endpoint without credentials');
 if(page.includes('const LIVE_ENDPOINT='))return page.replace(/const LIVE_ENDPOINT="[^"\n]+";/,()=>`const LIVE_ENDPOINT=${JSON.stringify(url.href)};`);
 const pattern=/async function sync\(\)\{[\s\S]*?(?=\n\$\('days'\)\.addEventListener)/;
 if(!pattern.test(page))throw new Error('Missing sync function');
 page=page.replace(pattern,()=>`const LIVE_ENDPOINT=${JSON.stringify(url.href)};\n`+sync.toString());
 page=page.replace("fresh:['已读取最新发布课表','Загружена последняя публикация']","fresh:['已与学校同步','Синхронизировано с САФУ']");
 page=page.replace('正在读取最新发布的数据，暂显示已保存课表。','正在读取学校当前课表，暂显示已保存课表。').replace('Загружаем последнюю публикацию; пока показано сохранённое расписание.','Получаем текущее расписание САФУ; пока показаны сохранённые данные.');
 page=page.replace('暂时无法读取课表文件，显示已保存课表。请联网后重试。','本次未能同步学校最新课表，下方仍为旧数据。请稍后重试。').replace('Не удалось загрузить файл расписания. Показаны сохранённые данные; проверьте подключение и повторите.','Не удалось обновить расписание САФУ. Показаны прежние данные; повторите позже.');
 page=page.replace('后台目标每 5 分钟检查学校课表，定时检查和发布偶有延迟。打开页面、重新联网、返回前台和前台每 5 分钟读取最近发布的数据；按钮不会强制学校立即更新。数据超过 20 分钟未同步时会显示提醒。','打开页面后自动读取学校当前课表；页面打开期间每 5 分钟更新一次，重新联网和返回前台时也会检查。点击“获取最新课表”会立即重新向学校读取，再显示中俄双语。同步失败时保留旧数据并提示。');
 // Export exactly the data currently displayed, including a course just rescheduled by the school.
 const calendar=await fs.readFile(new URL('./calendar-client.js',import.meta.url),'utf8');
 const download=/\$\('downloadcal'\)\.onclick=async\(\)=>\{[\s\S]*?(?=\ntry\{const saved=)/;
 if(!download.test(page))throw new Error('Missing calendar export');
 page=page.replace(download,()=>calendar+`\n$('downloadcal').onclick=()=>{if(!data)return;const blob=new Blob([toICS(data,$('subgroup').value,$('language').value)],{type:'text/calendar;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='111621-zh-ru.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);toast(tr('已导出当前显示的课表快照','Скачан снимок текущего расписания'));};\n`);
 return page;
}
