import {SOURCE,OFFICIAL_CALENDAR,translate,enrichEvent} from './school.mjs';

// Parse the school's published iCalendar feed, including its folded UTF-8 lines.
function text(value='') {
 return value.replace(/\\([nN,;\\])/g,(_,c)=>/[nN]/.test(c)?'\n':c).trim();
}
function timestamp(value,params='') {
 const m=value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
 if(!m)throw new Error('Unsupported school calendar date');
 if(!m[7]&&params&&!/TZID=(?:"?)(?:Europe\/Moscow|\(GMT\+03:00\) Moscow[^;]*)/i.test(params))throw new Error('Unsupported calendar timezone');
 const iso=`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${m[7]?'Z':'+03:00'}`;
 const instant=new Date(iso);
 if(!Number.isFinite(instant.getTime()))throw new Error('Invalid school calendar date');
 const local=new Date(instant.getTime()+3*3600000).toISOString();
 return {date:local.slice(0,10),time:local.slice(11,16),instant:instant.getTime()};
}
function hash(s){let n=2166136261;for(const c of s){n^=c.codePointAt(0);n=Math.imul(n,16777619);}return(n>>>0).toString(36);}
function add(date,days){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
function monday(date){const d=new Date(date+'T12:00:00Z');return add(date,-(d.getUTCDay()+6)%7);}
function place(location){
 const m=location.match(/^А-(Л|НСД)(\d+)(?:к(\d+))?\/(.+)$/u);
 if(!m)return {room:location,location,locationZh:location?'教室 '+location:null};
 const [,street,house,building,room]=m;
 return {room,location:`ауд. ${room}, ${street==='Л'?'пр. Ломоносова':'наб. Северной Двины'}, д. ${house}${building?', корп. '+building:''}`};
}
const KINDS={'Лабораторная работа':'实验课','Лекция':'讲座','Практическое занятие':'实践课','Экзамен':'考试','Консультация':'答疑课','Дифференцированный зачет':'评分考查','Дифференцированный зачёт':'评分考查','Зачет':'考查','Зачёт':'考查','Зачет с оценкой':'评分考查','Зачёт с оценкой':'评分考查'};

export function parseCalendar(ics) {
 const unfolded=ics.replace(/^\uFEFF/,'').replace(/\r?\n[ \t]/g,'');
 if(!/^BEGIN:VCALENDAR\r?\n/.test(unfolded)||! /END:VCALENDAR\s*$/.test(unfolded))throw new Error('Invalid school calendar');
 const events=[],seen=new Set();let rawCount=0,groupVerified=false;
 for(const block of unfolded.split('BEGIN:VEVENT').slice(1)) {
  const end=block.indexOf('END:VEVENT');if(end<0)throw new Error('Truncated school event');
  const fields={};
  for(const line of block.slice(0,end).split(/\r?\n/)){
   const colon=line.indexOf(':');if(colon<0)continue;
   const [name,...params]=line.slice(0,colon).split(';');
   fields[name.toUpperCase()]={value:line.slice(colon+1),params:params.join(';')};
  }
  if(fields.STATUS?.value==='CANCELLED')continue;
  if(fields.RRULE||fields['RECURRENCE-ID'])throw new Error('School recurrence format changed');
  if(!fields.SUMMARY||!fields.DTSTART||!fields.DTEND)throw new Error('Incomplete school event');
  rawCount++;
  const start=timestamp(fields.DTSTART.value,fields.DTSTART.params),endTime=timestamp(fields.DTEND.value,fields.DTEND.params);
  if(start.date!==endTime.date||endTime.instant<=start.instant)throw new Error('Unexpected lesson duration');
  const title=text(fields.SUMMARY.value),description=text(fields.DESCRIPTION?.value),lines=description.split('\n').map(s=>s.trim());
  if(!title)throw new Error('Empty course title');
  const group=lines.find(s=>/^[ГП]:/.test(s))||'';
  if(/\b111621\b/.test(group))groupVerified=true;
  const subgroup=/^П:/.test(group)?'Поток "'+group.slice(2).trim()+'"':/^Г:/.test(group)&&group.slice(2).trim()!=='111621'?'Подгруппа '+group.slice(2).trim():'';
  const kindIndex=lines.findIndex(s=>Object.hasOwn(KINDS,s));
  const titleIndex=lines.indexOf(title);
  const kind=kindIndex>=0?lines[kindIndex]:(titleIndex>=0?lines[titleIndex+1]||'':'');
  const teacher=kindIndex>=0?lines[kindIndex+1]||'':titleIndex>=0?lines[titleIndex+2]||'':'';
  const calendarLocation=text(fields.LOCATION?.value);
  const location=place(calendarLocation);
  const event={date:start.date,start:start.time,end:endTime.time,slot:lines[0]?.match(/^(\d+)п/)?.[1]||'',title,zh:title==='Учебная практика, проектно-исследовательский семинар'?'教学实习与项目研究研讨课':translate(title),teacher,kind,...location,subgroup,calendarLocation};
  // The school emits duplicate entries with different UIDs. Keep differing groups/teachers/rooms.
  const key=JSON.stringify(event);if(seen.has(key))continue;seen.add(key);
  event.id='ical-'+hash(key);
  const enriched=enrichEvent(event);
  events.push({...enriched,kindZh:KINDS[kind]||enriched.kindZh,locationZh:location.locationZh||enriched.locationZh});
 }
 if(!events.length||!groupVerified)throw new Error('Unable to verify calendar group 111621');
 events.sort((a,b)=>(a.date+a.start+a.title+a.subgroup).localeCompare(b.date+b.start+b.title+b.subgroup));
 const rangeStart=events[0].date,rangeEnd=events.at(-1).date;
 const days=[],weeks=[];
 for(let date=monday(rangeStart);date<=add(monday(rangeEnd),6);date=add(date,1)){
  if(days.length>740)throw new Error('Unexpected calendar date range');
  days.push(date);if(monday(date)===date)weeks.push(date);
 }
 return {group:'111621',groupId:'20991',timezone:'Europe/Moscow',events,days,weeks,rangeStart,rangeEnd,sourceStatus:'Полный календарь САФУ · '+rangeStart+' — '+rangeEnd,sourceUrl:SOURCE,calendarSourceUrl:OFFICIAL_CALENDAR,sourceFormat:'icalendar',rawEventCount:rawCount,duplicateCount:rawCount-events.length};
}
