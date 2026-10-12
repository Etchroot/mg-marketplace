import {sha256,bytes,textBytes} from '../storage/atomic.js';
import {fail,type Snapshot,type CatalogRow} from '../contracts.js';
import {coverage} from './build.js';
export const normalize=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/[\s_\-]+/g,'').trim();
export interface SearchInput {terms:string[];record_types?:string[];document_status?:string;date_from?:string;date_to?:string;versions?:'latest'|'all';limit?:number;cursor?:string;fallback?:'none'|'raw_text'}
export function filtered(s:Snapshot,i:SearchInput):CatalogRow[]{
  const latest=new Map<string,number>();for(const r of s.records)latest.set(r.record_id,Math.max(latest.get(r.record_id)??0,r.revision));
  return s.records.filter(r=>(i.versions==='all'||r.revision===latest.get(r.record_id))&&(!i.record_types||i.record_types.includes(r.record_type))&&(!i.document_status||r.document_status===i.document_status)&&(!i.date_from||!!r.occurred_on&&r.occurred_on>=i.date_from)&&(!i.date_to||!!r.occurred_on&&r.occurred_on<=i.date_to));
}
export async function search(root:string,s:Snapshot,i:SearchInput){
  const rows=filtered(s,i);const terms=[...new Set(i.terms.map(normalize))];const query=sha256(JSON.stringify({...i,cursor:undefined}));
  let offset=0;if(i.cursor){const token=JSON.parse(Buffer.from(i.cursor,'base64url').toString());if(token.query!==query||token.fingerprint!==s.fingerprint||!Number.isSafeInteger(token.offset)||token.offset<0)fail('INVALID_INPUT','Stale search cursor');offset=token.offset;}
  const variants=terms.map(t=>{const topic=s.topics.find(x=>[x.title,...x.aliases,x.id].some(a=>normalize(a)===t));return {terms:topic?[...new Set([t,normalize(topic.title),...topic.aliases.map(normalize)])]:[t],topicId:topic?.id};});
  const hits=[];
  for(const r of rows){let score=0;const reasons:string[]=[];
    for(const group of variants){let matched=0;for(const [field,weight] of [['title',8],['keywords',5],['entities',4],['use_cases',2],['overview',1]] as const){
      const value=r[field];const text=Array.isArray(value)?value:[value];
      if(group.terms.some(t=>text.some(v=>normalize(v).includes(t)))){matched+=weight;reasons.push(field);}}
      if(group.topicId&&r.topics.includes(group.topicId)){matched+=6;reasons.push('topic');}
      if(matched===0){score=0;break;}score+=matched;
    }
    let snippet=r.overview||r.title;
    if(score===0&&i.fallback==='raw_text'&&['text','provided'].includes(r.extraction)){
      let raw:string|null=null;
      if(r.extraction==='text')raw=textBytes(await bytes(root,r.raw_path),r.raw_path);
      else if(r.extracted_path){try{const b=await bytes(root,r.extracted_path);if(sha256(b)===r.extracted_sha256&&sha256(await bytes(root,r.raw_path))===r.source_sha256)raw=textBytes(b,r.extracted_path);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}
      if(raw&&variants.every(g=>g.terms.some(t=>normalize(raw).includes(t)))){score=1;reasons.push(r.extraction==='provided'?'extracted_text':'raw_text');const pos=raw.toLowerCase().indexOf(i.terms[0].toLowerCase());snippet=raw.slice(Math.max(0,pos-50),Math.max(0,pos-50)+200);}}
    if(score>0)hits.push({record_id:r.record_id,revision:r.revision,summary_id:r.summary_id,title:r.title,record_type:r.record_type,state:r.state,score,snippet:snippet.slice(0,200),match_reasons:[...new Set(reasons)]});
  }
  hits.sort((a,b)=>b.score-a.score||a.record_id.localeCompare(b.record_id)||a.revision-b.revision);const limit=i.limit??10;
  const end=offset+limit;return {items:hits.slice(offset,end),has_more:end<hits.length,next_cursor:end<hits.length?Buffer.from(JSON.stringify({query,fingerprint:s.fingerprint,offset:end})).toString('base64url'):null,coverage:await coverage(root,rows),scope:{record_count:rows.length,terms:i.terms,versions:i.versions??'latest',fallback:i.fallback??'none'}};
}
