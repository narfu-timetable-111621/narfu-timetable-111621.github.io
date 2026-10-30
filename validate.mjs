import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname),docs=path.join(root,'docs'),page=await fs.readFile(path.join(docs,'index.html'),'utf8'),data=JSON.parse(await fs.readFile(path.join(docs,'data/timetable.json')));
new Function(page.match(/<script>([\s\S]*?)<\/script>/)[1]);new Function(await fs.readFile(path.join(docs,'preferences.js'),'utf8'));new Function(await fs.readFile(path.join(docs,'sw.js'),'utf8'));
assert.ok(data.events.length>0);assert.ok(data.events.every(e=>e.teacherFullRu&&e.teacherZh));assert.ok(page.includes('minimum-scale=1'));assert.ok(page.includes("fetch('./data/timetable.json?check='"));assert.ok(!page.includes("fetch('/api/"));assert.ok(!/\b(?:src|href)="\//.test(page));assert.ok(page.includes("register('./sw.js'"));
for(const group of ['all','1','2'])for(const lang of ['all','ru','en','de']){const calendar=await fs.readFile(path.join(docs,'calendars',group+'-'+lang+'.ics'),'utf8');assert.ok(calendar.includes('BEGIN:VCALENDAR'));}
assert.ok(!(await fs.readFile(path.join(docs,'preferences.js'),'utf8')).includes('requestPermission'));
console.log('PASS: relative Pages paths, sync data, twelve filtered calendars, teacher full names, mobile viewport and script syntax.');
