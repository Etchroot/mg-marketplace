import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {homedir} from 'node:os';
import {KnowledgeService} from '../tools/handlers.js';
import {selectConfig} from '../config/location.js';
import {loadConfig} from '../config/load.js';
import {withVaultLock} from '../storage/lock.js';
import {apply,preview,cleanInbox} from '../storage/journal.js';
import {migrateReadable} from '../organize/migrate.js';
import {records} from '../records/repository.js';
import {validateReferences} from '../notes/validate.js';
async function main(){
  const args=process.argv.slice(2);const opt=(key:string)=>{const i=args.indexOf(key);return i<0?undefined:args[i+1];};
  const config=selectConfig(args,process.env,homedir());const service=new KnowledgeService(config);
  const command=args[0];
  if(command==='migrate-readable'){
    const c=await loadConfig(config);const result=await withVaultLock(c.vault_path,async()=>{
      const op=await migrateReadable(c.vault_path);if(!args.includes('--apply'))return preview(op);
      const result=await apply(c.vault_path,op);const check=await validateReferences(c.vault_path);if(check.errors.length)throw new Error('Migration validation failed');
      await cleanInbox(c.vault_path,(await records(c.vault_path)).flatMap(r=>r.versions.filter(v=>v.state==='organized').map(v=>`00_Inbox/${r.record_id}/r${String(v.revision).padStart(3,'0')}/source.md`)));
      return result;
    });console.log(JSON.stringify(result));return;
  }
  if(command==='eval'){
    const dataset=opt('--dataset');if(!dataset)throw new Error('--dataset required');const data=JSON.parse(await readFile(dataset,'utf8'));const report=[];
    for(const q of data.questions){const r=await service.invoke('kg_search',q.input);const ids=r.items.map((x:any)=>x.record_id);const passed=q.expected_ids.every((id:string)=>ids.includes(id))&&(!q.expect_empty||ids.length===0);report.push({id:q.id,passed,returned_count:ids.length,response_chars:JSON.stringify(r).length});}
    const result={total:report.length,passed:report.filter(r=>r.passed).length,results:report};const out=opt('--output');if(out){await import('node:fs/promises').then(m=>m.mkdir(path.dirname(out),{recursive:true}));await writeFile(out,JSON.stringify(result,null,2));}console.log(JSON.stringify(result));if(result.passed!==result.total)process.exitCode=1;return;
  }
  const names:Record<string,string>={status:'kg_status',validate:'kg_validate',search:'kg_search',read:'kg_read',invoke:args[1],recover:'kg_recover'};
  const tool=command==='catalog'&&args[1]==='rebuild'?'kg_rebuild_catalog':names[command];if(!tool)throw new Error('Use status, validate, search --input, read --input, catalog rebuild, invoke TOOL --input, or eval');
  const input=opt('--input');console.log(JSON.stringify(await service.invoke(tool,input?JSON.parse(await readFile(input,'utf8')):{})));
}
main().catch(e=>{process.stderr.write(JSON.stringify({error:{code:e.code??'INVALID_INPUT'}})+'\n');process.exitCode=1;});
