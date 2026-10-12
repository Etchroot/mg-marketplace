import {parse as yaml} from 'yaml';
import {parse,TopicId,fail,type CatalogRow,type Snapshot,type RecordData,type Topic,type Edge} from '../contracts.js';
import {records} from '../records/repository.js';
import {bytes,sha256,json,writeAtomic,hashAt} from '../storage/atomic.js';
import {note} from '../notes/parser.js';
export const defaultTopics:Topic[]=[{id:'topic-ai-native',key:'ai-native',title:'AI 네이티브',aliases:['AI-native','AI native','AI네이티브']},{id:'topic-workflow-automation',key:'workflow-automation',title:'업무 자동화',aliases:['workflow automation']}];
export async function vocabulary(root:string,text?:string):Promise<Topic[]> {
  const doc=yaml(text??(await bytes(root,'99_System/vocabulary.yaml')).toString());
  if(!Array.isArray(doc?.topics))fail('INVALID_INPUT');
  const result:Topic[]=doc.topics.map((t:Topic)=>{
    parse(TopicId,t.id);if(!/^[a-z0-9][a-z0-9-]{0,79}$/.test(t.key)||typeof t.title!=='string'||!Array.isArray(t.aliases)||!t.aliases.every(a=>typeof a==='string'))fail('INVALID_INPUT');return t;
  });
  if(new Set(result.map(t=>t.id)).size!==result.length||new Set(result.map(t=>t.key)).size!==result.length)fail('INVALID_INPUT');return result;
}
export async function buildCatalog(root:string,projected?:RecordData[],overrides=new Map<string,string>(),topicsOverride?:Topic[]):Promise<Snapshot>{
  const all=projected??await records(root);const topics=topicsOverride??await vocabulary(root);const rows:CatalogRow[]=[];const edges:Edge[]=[];
  for(const r of all.sort((a,b)=>a.record_id.localeCompare(b.record_id))){
    if(r.policy.agent_access!=='allowed')continue;
    for(const v of r.versions){
      let m:Record<string,unknown>={};
      if(v.summary_path){const content=overrides.get(v.summary_path)??(await bytes(root,v.summary_path)).toString('utf8');m=note(content).meta;
        if(m.id!==v.summary_id||m.record_id!==r.record_id||m.source_revision!==v.revision||m.source_sha256!==v.sha256)fail('HASH_CONFLICT','Summary metadata mismatch');}
      const strings=(key:string):string[]=>{const a=m[key]??[];if(!Array.isArray(a)||!a.every(x=>typeof x==='string'))fail('INVALID_INPUT');return a as string[];};
      const row:CatalogRow={record_id:r.record_id,revision:v.revision,title:r.title,record_type:r.record_type,document_status:v.document_status??r.document_status,occurred_on:v.occurred_on??r.occurred_on,raw_path:v.raw_path,source_sha256:v.sha256,summary_id:v.summary_id,summary_path:v.summary_path,extraction:v.extraction,state:v.state,topics:strings('topics'),keywords:strings('keywords'),entities:strings('entities'),use_cases:strings('use_cases'),overview:typeof m.overview==='string'?m.overview:'',github:r.policy.github};
      if(v.extracted_path){row.extracted_path=v.extracted_path;row.extracted_sha256=v.extracted_sha256;}rows.push(row);
      if(row.summary_id){for(const id of row.topics)edges.push({source:row.summary_id,target:id,kind:'covers_topic',evidence:[]});
        const rels=m.relations??[];if(!Array.isArray(rels))fail('INVALID_INPUT');for(const rel of rels){if(typeof rel?.target_id!=='string'||typeof rel.kind!=='string')fail('INVALID_INPUT');edges.push({source:row.summary_id,target:rel.target_id,kind:rel.kind,evidence:rel.evidence??[]});}}
    }
  }
  rows.sort((a,b)=>a.record_id.localeCompare(b.record_id)||a.revision-b.revision);edges.sort((a,b)=>json(a).localeCompare(json(b)));
  return {records:rows,topics:topics.slice().sort((a,b)=>a.id.localeCompare(b.id)),edges,fingerprint:sha256(json({rows,topics,edges}))};
}
export function catalogFiles(s:Snapshot):Map<string,string>{return new Map([
  ['99_System/catalog/records.json',json({schema_version:1,records:s.records})],
  ['99_System/catalog/topics.json',json({schema_version:1,topics:s.topics})],
  ['99_System/catalog/edges.json',json({schema_version:1,edges:s.edges})],
  ['99_System/catalog/manifest.json',json({schema_version:1,fingerprint:s.fingerprint,normalization_version:1,records_path:'records.json',topics_path:'topics.json',edges_path:'edges.json'})]
]);}
export async function rebuild(root:string):Promise<Snapshot>{const s=await buildCatalog(root);for(const [p,c] of catalogFiles(s))await writeAtomic(root,p,c);return s;}
export async function loadCatalog(root:string):Promise<Snapshot>{
  const a=JSON.parse((await bytes(root,'99_System/catalog/records.json')).toString());
  const b=JSON.parse((await bytes(root,'99_System/catalog/topics.json')).toString());
  const c=JSON.parse((await bytes(root,'99_System/catalog/edges.json')).toString());
  const m=JSON.parse((await bytes(root,'99_System/catalog/manifest.json')).toString());
  return {records:a.records,topics:b.topics,edges:c.edges,fingerprint:m.fingerprint};
}
export async function coverage(root:string,rows:CatalogRow[]):Promise<{inbox_count:number;unsearchable_count:number;stale_summary_count:number}>{
  let stale=0,unsearchable=0;for(const r of rows){const current=await hashAt(root,r.raw_path);if(r.summary_path&&current!==r.source_sha256)stale++;if(r.extraction==='unsupported'||r.extraction==='provided'&&(current!==r.source_sha256||!r.extracted_path||await hashAt(root,r.extracted_path)!==r.extracted_sha256))unsearchable++;}
  return {inbox_count:rows.filter(r=>r.state==='inbox').length,unsearchable_count:unsearchable,stale_summary_count:stale};
}
