import fs from 'node:fs/promises';import path from 'node:path';
const root=path.resolve(import.meta.dirname);const latest=JSON.parse(await fs.readFile(path.join(root,'docs/data/timetable.json'),'utf8'));if(latest.testFixture)throw new Error('Cannot preserve test fixture as a verified snapshot');
let old;try{old=JSON.parse(await fs.readFile(path.join(root,'snapshot/timetable.json'),'utf8'));}catch{}
const shape=d=>JSON.stringify({weeks:d.weeks,days:d.days,events:d.events});
if(!old||shape(old)!==shape(latest)||old.retrievedAt.slice(0,10)!==latest.retrievedAt.slice(0,10)){await fs.mkdir(path.join(root,'snapshot'),{recursive:true});await fs.writeFile(path.join(root,'snapshot/timetable.json'),JSON.stringify(latest));console.log('Verified school snapshot updated.');}else console.log('Saved school snapshot unchanged today.');
