import {stringify} from 'yaml';
import {randomUUID} from 'node:crypto';
import type {SummaryDraft,RecordData,Version,Topic,CatalogRow} from '../contracts.js';
import {managed} from './parser.js';
import path from 'node:path';
import {topicPath} from './names.js';
export const label=(s:string)=>s.replace(/[\[\]|\r\n]/g,' ');
export const encodePath=(p:string)=>p.split('/').map(s=>encodeURIComponent(s).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase())).join('/');
export const link=(p:string,title:string,from:string)=>`[[${p}|${label(title)}]] ([파일](${encodePath(path.posix.relative(path.posix.dirname(from),p))}))`;
export function renderSummary(r:RecordData,v:Version,d:SummaryDraft,topics:Topic[],targets:Map<string,{path:string;title:string}>):string {
  const meta={schema_version:1,id:v.summary_id??randomUUID(),type:'summary',record_id:r.record_id,source_revision:v.revision,source_sha256:v.sha256,title:d.title,record_type:r.record_type,category:d.category,document_status:v.document_status??r.document_status,topics:d.topics,keywords:d.keywords,entities:d.entities,use_cases:d.use_cases,overview:d.overview,summary_origin:'agent',relations:d.relations};
  const evidence=d.facts.flatMap(f=>f.evidence);
  const topicLinks=d.topics.map(id=>{const t=topics.find(t=>t.id===id)!;return '- '+link(topicPath(t),t.title,v.summary_path!);});
  const otherLinks=d.relations.filter(rel=>!(rel.kind==='covers_topic'&&d.topics.includes(rel.target_id))).map(rel=>{const target=targets.get(rel.target_id)!;return '- '+link(target.path,target.title,v.summary_path!)+' — '+rel.kind;});
  return '---\n'+stringify(meta)+'---\n\n# '+label(d.title)+'\n\n## 한눈에 보기\n'+d.overview+'\n\n## 핵심 사실과 경험\n'+d.facts.map(f=>'- '+f.text).join('\n')+'\n\n## 활용 맥락 (해석)\n'+[...d.use_cases,...d.interpretations].map(t=>'- '+t).join('\n')+'\n\n## 원문 근거\n'+evidence.map(e=>`- r${e.revision} L${e.line_start}–${e.line_end}: ${e.quote}`).join('\n')+'\n\n## 원본\n'+link(v.raw_path,'원본 r'+v.revision,v.summary_path!)+'\n\n<!-- kg:links:start -->\n## 관련 주제와 자료\n'+[...topicLinks,...otherLinks].join('\n')+'\n<!-- kg:links:end -->\n';
}
export function renderTopic(t:Topic,rows:CatalogRow[],existing?:string):string {
  const body=rows.filter(r=>r.topics.includes(t.id)&&r.summary_path).map(r=>'- '+link(r.summary_path!,r.title,topicPath(t))).sort().join('\n');
  if(existing)return managed(existing,body);
  return '---\n'+stringify({schema_version:1,id:t.id,type:'topic',title:t.title,aliases:t.aliases})+'---\n\n# '+t.title+'\n\n<!-- kg:links:start -->\n'+body+'\n<!-- kg:links:end -->\n';
}
