const SOURCE='https://ruz.narfu.ru/?timetable&group=20991';
function matchesFilter(e, subgroup='all',language='all') {
 if(subgroup!=='all' && /Подгруппа 111621_[12](?:_|$)/.test(e.subgroup) && !e.subgroup.includes('111621_'+subgroup)) return false;
 const lang=/англ|английский/i.test(e.subgroup+' '+e.title)?'en':/нем|Немецкий/i.test(e.subgroup+' '+e.title)?'de':/рус|русский/i.test(e.subgroup+' '+e.title)?'ru':null;
 return language==='all'||!lang||lang===language;
}
const icescape = s=>String(s??'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
function fold(line){let out='',bytes=0;for(const c of line){const n=new TextEncoder().encode(c).length;if(bytes+n>75){out+='\r\n ';bytes=1;}out+=c;bytes+=n;}return out;}
function toICS(data,subgroup='all',language='all') {
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//NARFU Bilingual Timetable//ZH-RU//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:111621 · 中俄双语课表','X-WR-TIMEZONE:Europe/Moscow','REFRESH-INTERVAL;VALUE=DURATION:PT1H','X-PUBLISHED-TTL:PT1H'];
 const stamp=new Date(data.retrievedAt).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
 for(const raw of data.events.filter(e=>matchesFilter(e,subgroup,language))) {
  const e=enrichEvent(raw);
  // Dates are explicitly UTC+03, independent of the phone's timezone.
  const utc=time=>new Date(e.date+'T'+time+':00+03:00').toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  lines.push('BEGIN:VEVENT','UID:'+e.id+'@narfu-bilingual-20991','DTSTAMP:'+stamp,'DTSTART:'+utc(e.start),'DTEND:'+utc(e.end),'SUMMARY:'+icescape((e.zh?e.zh+' / ':'')+e.title),'LOCATION:'+icescape([e.locationZh,e.location].filter(Boolean).join(' / ')),'DESCRIPTION:'+icescape([e.kindZh+' / '+e.kind,'教师 / Преподаватель: '+[e.teacherZh,e.teacher].filter(Boolean).join(' / '),e.subgroupZh+(e.subgroup?' / '+e.subgroup:''),'学校课表 / Источник: '+SOURCE].filter(Boolean).join('\n')),'URL:'+SOURCE,'END:VEVENT');
 }
 lines.push('END:VCALENDAR');return lines.map(fold).join('\r\n')+'\r\n';
}

