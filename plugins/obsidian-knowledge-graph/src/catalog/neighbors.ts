import {fail,type Snapshot} from '../contracts.js';
export function neighbors(s:Snapshot,seedIds:string[],hops=1,maxNodes=20){
  const nodes=new Map<string,{id:string;title:string;record_id?:string;revision?:number}>();
  for(const t of s.topics)nodes.set(t.id,{id:t.id,title:t.title});
  for(const r of s.records)if(r.summary_id)nodes.set(r.summary_id,{id:r.summary_id,title:r.title,record_id:r.record_id,revision:r.revision});
  const canonical=(id:string)=>nodes.has(id)?id:s.records.filter(r=>r.record_id===id&&r.summary_id).sort((a,b)=>b.revision-a.revision)[0]?.summary_id;
  const visited=new Set<string>();let frontier:string[]=[];let truncated=false;
  for(const seed of seedIds){const id=canonical(seed);if(!id)fail('SOURCE_MISSING');if(visited.size<maxNodes){visited.add(id);frontier.push(id);}else truncated=true;}
  const graph=s.edges.map(e=>({...e,target:canonical(e.target)??e.target})).filter(e=>nodes.has(e.source)&&nodes.has(e.target));
  for(let depth=0;depth<hops;depth++){const next:string[]=[];for(const id of frontier){for(const e of graph){const other=e.source===id?e.target:e.target===id?e.source:null;if(other&&!visited.has(other)){if(visited.size>=maxNodes){truncated=true;continue;}visited.add(other);next.push(other);}}}frontier=next;}
  return {nodes:[...visited].map(id=>nodes.get(id)!),edges:graph.filter(e=>visited.has(e.source)&&visited.has(e.target)),truncated,hops,max_nodes:maxNodes};
}
