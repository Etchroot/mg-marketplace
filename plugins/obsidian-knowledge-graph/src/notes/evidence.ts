import {fail,type Evidence,type RecordData} from '../contracts.js';
import {record,version,allowed} from '../records/repository.js';
import {bytes,sha256,textBytes} from '../storage/atomic.js';
export async function validateEvidence(root:string,e:Evidence,cache:Map<string,RecordData>):Promise<void>{
  const r=cache.get(e.record_id)??await record(root,e.record_id);cache.set(r.record_id,r);allowed(r);
  const v=version(r,e.revision);const raw=await bytes(root,v.raw_path);
  if(sha256(raw)!==v.sha256)fail('HASH_CONFLICT');
  const extracted=v.extracted_path?await bytes(root,v.extracted_path):undefined;
  if(extracted&&sha256(extracted)!==v.extracted_sha256)fail('HASH_CONFLICT');
  const text=extracted?new TextDecoder('utf-8',{fatal:true}).decode(extracted):textBytes(raw,v.original_name);
  if(text===null)fail('UNSUPPORTED_MEDIA');
  const lines=text.replace(/\r\n/g,'\n').split('\n');
  if(e.line_end<e.line_start||e.line_end>lines.length||!lines.slice(e.line_start-1,e.line_end).join('\n').includes(e.quote.replace(/\r\n/g,'\n')))fail('INVALID_INPUT','Evidence does not match source lines');
}
