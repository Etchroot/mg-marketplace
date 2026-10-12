import path from 'node:path';
import type {Topic} from '../contracts.js';
import {hashAt} from '../storage/atomic.js';
export const essayTopic:Topic={id:'topic-application-essays',key:'application-essays',title:'자기소개서',aliases:['자소서','지원서','자기 소개서']};
export const topicPath=(t:Topic)=>'30_Topics/'+(t.id===essayTopic.id?'자기소개서':t.key)+'.md';
export function readableName(title:string):string {
  let name=Array.from(title.normalize('NFC').replace(/[<>:"/\\|?*\x00-\x1f\[\]#]/g,'_').replace(/\s+/g,' ').replace(/^[. ]+|[. ]+$/g,'')).slice(0,100).join('').replace(/[. ]+$/g,'')||'자료';
  if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))name='자료 — '+name;
  return name;
}
export const rawName=(title:string,original:string)=>readableName(title)+(path.posix.extname(original.replace(/\\/g,'/'))||'.md');
export async function summaryPath(root:string,category:string,title:string,id:string,revision:number,reserved:Set<string>):Promise<string>{
  const base='20_Summaries/'+category+'/'+readableName(title);const rev=revision>1?' — r'+String(revision).padStart(3,'0'):'';
  for(let n=0;;n++){
    const candidate=base+(n?' — '+id.slice(0,8)+(n>1?' — '+n:''):'')+rev+'.md';
    if(!reserved.has(candidate.normalize('NFC').toLowerCase())&&await hashAt(root,candidate)===null){reserved.add(candidate.normalize('NFC').toLowerCase());return candidate;}
  }
}
