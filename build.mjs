import fs from 'node:fs/promises';
import path from 'node:path';
import worker,{SOURCE,parseTimetable,enrichEvent,toICS} from './worker.mjs';
import {wireLiveSync} from './live-client.mjs';
const liveConfig=JSON.parse(await fs.readFile(new URL('./live-sync.json',import.meta.url),'utf8'));
const root=path.resolve(import.meta.dirname);
const output=path.join(root,'docs');
await fs.mkdir(path.join(output,'data'),{recursive:true});
await fs.mkdir(path.join(output,'calendars'),{recursive:true});
let html;
const fixture=process.env.NARFU_TEST_FIXTURE;
if(fixture){if(process.env.GITHUB_ACTIONS)throw new Error('Test fixtures cannot be published by Actions');html=await fs.readFile(fixture,'utf8');}
else{
 let failure;
 for(let attempt=0;attempt<2;attempt++){
  try{const r=await fetch(SOURCE,{headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'},signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error('School HTTP '+r.status);html=await r.text();if(html.length>2000000)throw new Error('Unexpected school page size');break;}catch(e){failure=e;}
 }
 if(!html)throw failure;
}
const parsed=parseTimetable(html);
if(!parsed.events.length||!parsed.weeks.length)throw new Error('No valid school schedule; keep the previous deployment');
const now=new Date().toISOString();
const data={...parsed,events:parsed.events.map(enrichEvent),retrievedAt:now,checkedAt:now,fresh:true,via:'github-actions',testFixture:!!fixture};
await fs.writeFile(path.join(output,'data/timetable.json'),JSON.stringify(data));
const base='https://timetable.invalid';
let page=await(await worker.fetch(new Request(base+'/'),{},{})).text();
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const mondayDate=new Date(today+'T12:00:00Z');mondayDate.setUTCDate(mondayDate.getUTCDate()-(mondayDate.getUTCDay()+6)%7);const monday=mondayDate.toISOString().slice(0,10),start=data.weeks.includes(monday)?monday:data.weeks[0];
const endDate=new Date(start+'T12:00:00Z');endDate.setUTCDate(endDate.getUTCDate()+6);const end=endDate.toISOString().slice(0,10);
const seed={...data,weeks:[start],days:data.days.filter(d=>d>=start&&d<=end),events:data.events.filter(e=>e.date>=start&&e.date<=end),fresh:false,via:'preloaded-week'};
page=page.replace(/^const BOOTSTRAP_DATA=.+;$/m,'const BOOTSTRAP_DATA='+JSON.stringify(seed)+';');
// Every local resource is relative, for both organization roots and project sites.
page=page.replaceAll('src="/','src="./').replaceAll('href="/','href="./');
page=page.replace("script.src='/preferences.js?v=6'","script.src='./preferences.js?v=github-2'");
page=page.replace("navigator.serviceWorker.register('/sw.js')","navigator.serviceWorker.register('./sw.js',{scope:'./'})");
page=page.replace("fetch('/api/timetable'","fetch('./data/timetable.json?check='+Date.now()");
page=page.replace('const result=await res.json();','const result=await res.json();result.fresh=!result.testFixture&&Date.now()-new Date(result.retrievedAt).getTime()<=20*60000;');
// Loading an old publication successfully is different from a network failure.
function status(mode,error){
 const outdated=mode!=='fresh';
 $('synctitle').classList.toggle('warn',outdated);
 const labels={fresh:['已读取最新发布课表','Загружена последняя публикация'],loading:['正在读取课表','Загрузка расписания'],stale:['后台更新延迟 · 显示已保存课表','Обновление задерживается · Сохранённое расписание'],offline:['离线课表','Нет сети'],error:['课表读取失败 · 显示已保存课表','Ошибка загрузки · Сохранённое расписание']};
 const label=labels[mode]||labels.error;$('syncstate').textContent=tr(...label);
 $('synctime').textContent=(data?tr('学校数据获取：','Данные САФУ получены: ')+stamp(data.retrievedAt)+' MSK\n':'')+(lastSuccess?tr('网页最近读取：','Последняя загрузка: ')+stamp(new Date(lastSuccess).toISOString())+' MSK\n':'')+(data?.sourceStatus?tr('学校状态：','Статус САФУ: ')+data.sourceStatus:'');
 $('synctime').style.whiteSpace='pre-line';
 const saved=data?stamp(data.retrievedAt)+' MSK':'';
 const messages={fresh:'',loading:tr('正在读取最新发布的数据，暂显示已保存课表。','Загружаем последнюю публикацию; пока показано сохранённое расписание.'),stale:tr('后台自动更新延迟，学校数据最后获取于 '+saved+'。当前显示已保存课表；临时改课请核对学校官网。','Автообновление задерживается. Данные САФУ получены '+saved+'. Показано сохранённое расписание; срочные изменения проверьте на сайте САФУ.'),offline:tr('当前离线，显示已保存课表。重新联网后自动读取。','Нет сети. Показано сохранённое расписание; загрузка возобновится при подключении.'),error:tr('暂时无法读取课表文件，显示已保存课表。请联网后重试。','Не удалось загрузить файл расписания. Показаны сохранённые данные; проверьте подключение и повторите.')};
 $('notice').textContent=messages[mode]??messages.error;
 applyLanguage();
}
const statusPattern=/function status\(mode,error\)\{[\s\S]*?(?=\nasync function sync\(\))/;
if(!statusPattern.test(page))throw new Error('Missing client sync status function');
page=page.replace(statusPattern,()=>status.toString());
page=page.replace("if(result.fresh){lastSuccess=Date.now();store.set('narfu-success',String(lastSuccess));}","lastSuccess=Date.now();store.set('narfu-success',String(lastSuccess));");
page=page.replace("status(navigator.onLine?'stale':'offline'","status(navigator.onLine?'error':'offline'");
page=page.replace("fetch('/calendar.ics?subgroup='+$('subgroup').value+'&language='+$('language').value", "fetch('./calendars/'+$('subgroup').value+'-'+$('language').value+'.ics'");
page=page.replace('↻ 立即检查更新 / Обновить','↻ 获取最新课表 / Обновить');
page=page.replace('打开页面、重新联网、返回前台（距上次检查超过 1 分钟）和前台每 5 分钟自动检查；服务器最多缓存 2 分钟。网页关闭后不持续检查，不发送通知。','后台目标每 5 分钟检查学校课表，定时检查和发布偶有延迟。打开页面、重新联网、返回前台和前台每 5 分钟读取最近发布的数据；按钮不会强制学校立即更新。数据超过 20 分钟未同步时会显示提醒。');
page=page.replace('Проверка при открытии, восстановлении сети, возврате в приложение (через 1 минуту) и каждые 5 минут на экране. Кэш сервера — до 2 минут. В закрытом приложении проверка не работает, уведомления не отправляются.','Сервер проверяет расписание примерно каждые 5 минут; проверка и публикация могут задерживаться. Страница загружает последние опубликованные данные при открытии и каждые 5 минут. При задержке более 20 минут появляется предупреждение.');
page=page.replace('双语自动订阅：在苹果日历添加本站 /calendar.ics 地址；只覆盖学校网页当前六周。','双语自动订阅：按当前分组选择生成专用日历地址，只覆盖学校网页当前六周。苹果决定订阅刷新时间。');
page=page.replace('Двуязычная подписка: добавьте адрес этого сайта с /calendar.ics; охватывает текущие шесть недель.','Двуязычная подписка учитывает выбранные фильтры и текущие шесть недель. Частоту обновления подписки определяет Apple.');
page=page.replace('href="./calendar.ics"','href="./calendars/all-all.ics"');
page=page.replace('<p>可加 ?subgroup=1&amp;language=ru 只保留第 1 组、俄语课程及公共课。<br>Параметры ?subgroup=1&amp;language=ru оставляют подгруппу 1, русский язык и общие занятия.</p>','<button id="copybilingualcal" class="syncbtn">复制当前分组的双语订阅地址 / Скопировать адрес подписки</button><p>更改上面的分组与语言筛选后，再复制对应地址到苹果“日历”的订阅日历中。<br>Выберите подгруппу и язык, затем скопируйте адрес в подписку Apple.</p>');
page=page.replace(' applyLanguage();\n}'," const cal=$('bilingualcal');if(cal)cal.href=new URL('./calendars/'+$('subgroup').value+'-'+$('language').value+'.ics',location.href).href;\n applyLanguage();\n}");
page=page.replace("$('copycal').onclick=", "$('copybilingualcal').onclick=async()=>{try{await navigator.clipboard.writeText($('bilingualcal').href);toast(tr('已复制双语订阅地址','Адрес подписки скопирован'));}catch{toast($('bilingualcal').href)}};\n$('copycal').onclick=");
const helpSections=/<details id="help">[\s\S]*?<\/details>\s*<details>[\s\S]*?<\/details>/;
if(!helpSections.test(page))throw new Error('Missing help and calendar sections');
page=page.replace(helpSections,`<details id="help" data-fixed-language="zh"><summary>iPhone 使用与同步说明</summary>
<p><b>添加到主屏幕</b><br>用 Safari 打开本页，轻点共享 → 添加到主屏幕 → 打开“作为网页 App 打开” → 添加。</p>
<p>后台目标每 5 分钟检查学校课表，定时检查和发布偶有延迟。打开页面、重新联网、返回前台和前台每 5 分钟读取最近发布的数据；按钮不会强制学校立即更新。数据超过 20 分钟未同步时会显示提醒。</p></details>
<details id="apple-calendar" data-fixed-language="zh"><summary>苹果日历</summary>
<p>学校俄文订阅：点击下面按钮，或在苹果“日历”→“添加日历”→“添加订阅日历”中粘贴地址。</p>
<a class="calendarlink" href="webcal://ruz.narfu.ru/?icalendar&oid=20991&cod=111621">订阅学校日历 ↗</a><button id="copycal" class="syncbtn">复制官方订阅地址</button>
<p>官方订阅含全部分组，内容为俄文；刷新由苹果日历控制，本站筛选不影响它。</p>
<button id="downloadcal" class="syncbtn">导出双语 .ics</button><p>导出是当前筛选的快照，不自动更新；含课程、老师和楼址的中俄双语。</p>
<p>双语自动订阅：按当前分组选择生成专用日历地址，只覆盖学校网页当前六周。苹果决定订阅刷新时间。</p><a class="calendarlink" id="bilingualcal" href="./calendars/all-all.ics">双语订阅地址</a>
<button id="copybilingualcal" class="syncbtn">复制当前分组的双语订阅地址</button><p>更改上面的分组与语言筛选后，再复制对应地址到苹果“日历”的订阅日历中。</p></details>`);
page=page.replace('<br><a href="https://ruz.narfu.ru/?timetable&group=20991" target="_blank" rel="noopener">学校课表 / Оригинал ↗</a>','');
if(liveConfig.endpoint)page=await wireLiveSync(page,liveConfig.endpoint);
// Keep the old GitHub link useful while using the same-origin route verified in Russia.
page=page.replace('<script>',"<script>\nif(location.hostname==='narfu-timetable-111621.github.io'){location.replace('https://narfu-live-111621.vercel.app/');}\n");
await fs.writeFile(path.join(output,'index.html'),page);
const originalPref=await(await worker.fetch(new Request(base+'/preferences.js'),{},{})).text();
const languagePart=originalPref.slice(0,originalPref.indexOf(' const selectedMinutes=')).replace('script,style,textarea,option[data-i18n-zh]','script,style,textarea,option[data-i18n-zh],[data-fixed-language]');
const pref=languagePart+`
 window.openPreferences=async()=>{try{if(!$('preferences')){const r=await fetch('./settings.html?v=github-2');if(!r.ok)throw new Error();$('settings-slot').innerHTML=await r.text();$('ui-language').onchange=()=>{uiLanguage=$('ui-language').value;store.set('narfu-ui-language',uiLanguage);render();};}$('ui-language').value=uiLanguage;applyLanguage();$('preferences').showModal();}catch{toast(tr('设置暂时无法加载，请重试','Не удалось загрузить настройки. Повторите позже.'));}};
 applyLanguage();render();
})();
`;
await fs.writeFile(path.join(output,'preferences.js'),pref);
const originalSettings=await(await worker.fetch(new Request(base+'/settings.html'),{},{})).text();
const style=originalSettings.match(/<style>[\s\S]*?<\/style>/)[0];
const settings=style+`<dialog id="preferences" class="settings-dialog"><div class="settings-heading"><h2>设置 / Настройки</h2><button class="settings-close" onclick="this.closest('dialog').close()" aria-label="关闭 / Закрыть">×</button></div><label for="ui-language">显示语言 / Язык интерфейса</label><select id="ui-language"><option value="both">中俄双语 / 中文 + Русский</option><option value="zh">中文 / Китайский</option><option value="ru">Русский / 俄语</option></select><a class="calendarlink" href="https://ruz.narfu.ru/?timetable&group=20991" target="_blank" rel="noopener">查看学校原始课表 / Оригинал расписания ↗</a><button onclick="this.closest('dialog').close()">完成 / Готово</button></dialog>`;
await fs.writeFile(path.join(output,'settings.html'),settings);
for(const name of ['logo.svg','icon.svg','icon.png','icon-192.png','icon-512.png']){const r=await worker.fetch(new Request(base+'/'+name),{},{});if(!r.ok)throw new Error('Missing asset '+name);await fs.writeFile(path.join(output,name),Buffer.from(await r.arrayBuffer()));}
await fs.writeFile(path.join(output,'manifest.webmanifest'),JSON.stringify({id:'./',name:'САФУ · 中俄双语课表',short_name:'NArFU课表',lang:'zh-CN',start_url:'./',scope:'./',display:'standalone',background_color:'#f5f4ee',theme_color:'#174e45',icons:[{src:'./icon-192.png?v=8',sizes:'192x192',type:'image/png',purpose:'any'},{src:'./icon-512.png?v=8',sizes:'512x512',type:'image/png',purpose:'any'}]}));
for(const subgroup of ['all','1','2'])for(const language of ['all','ru','en','de'])await fs.writeFile(path.join(output,'calendars',subgroup+'-'+language+'.ics'),toICS(data,subgroup,language));
const sw=`const CACHE='narfu-gh-shell-${liveConfig.endpoint?'v5':'v3'}';const BASE=new URL('./',self.location.href);const CORE=['./','./manifest.webmanifest','./logo.svg?v=8','./icon.png?v=8','./preferences.js?v=github-2','./settings.html?v=github-2'].map(p=>new URL(p,BASE).href);
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));});
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys(),old=keys.filter(k=>k.startsWith('narfu-gh-shell-')&&k!==CACHE);await Promise.all(old.map(k=>caches.delete(k)));await self.clients.claim();})()));
self.addEventListener('fetch',event=>{const u=new URL(event.request.url);if(event.request.method!=='GET'||u.origin!==BASE.origin||!u.pathname.startsWith(BASE.pathname)||u.pathname.includes('/data/')||u.pathname.includes('/calendars/'))return;event.respondWith(caches.open(CACHE).then(async cache=>{const saved=await cache.match(event.request);const network=fetch(event.request).then(r=>{if(r.ok){const copy=r.clone();event.waitUntil(cache.put(event.request,copy));}return r;});if(saved){event.waitUntil(network.catch(()=>{}));return saved;}return network.catch(()=>new Response('首次打开请联网 / Для первого запуска нужен Интернет',{status:503}));}));});`;
await fs.writeFile(path.join(output,'sw.js'),sw);await fs.writeFile(path.join(output,'.nojekyll'),'');
await fs.writeFile(path.join(output,'robots.txt'),'User-agent: *\nDisallow: /\n');
console.log(JSON.stringify({events:data.events.length,weeks:data.weeks.length,schoolCheckedAt:now,testFixture:!!fixture,output:'docs'}));
