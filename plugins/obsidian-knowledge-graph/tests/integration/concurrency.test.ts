import {test,expect} from 'vitest';import {spawn} from 'node:child_process';
import {writeFile} from 'node:fs/promises';import path from 'node:path';
import {createHarness} from '../support/harness.js';
test('separate MCP processes cannot both commit conflicting previews',async()=>{
  const h=await createHarness();try{await h.setup();
    const a=await h.invoke('kg_capture_preview',{text:'one',title:'one',type:'essay'});const b=await h.invoke('kg_capture_preview',{text:'two',title:'two',type:'essay'});
    const cli=path.resolve('dist/cli.cjs');const inputA=path.join(h.dir,'a.json'),inputB=path.join(h.dir,'b.json');await writeFile(inputA,JSON.stringify({preview_id:a.preview_id}));await writeFile(inputB,JSON.stringify({preview_id:b.preview_id}));
    const invoke=(file:string)=>new Promise<{code:number;output:string}>(resolve=>{const p=spawn(process.execPath,[cli,'invoke','kg_capture_commit','--config',h.configPath,'--input',file],{cwd:h.inputs,windowsHide:true});let output='';p.stdout.on('data',b=>output+=b);p.stderr.on('data',b=>output+=b);p.on('close',code=>resolve({code:code??1,output}));});
    const r=await Promise.all([invoke(inputA),invoke(inputB)]);expect(r.filter(x=>x.code===0)).toHaveLength(1);expect(r.find(x=>x.code!==0)!.output).toContain('HASH_CONFLICT');expect((await h.invoke('kg_inbox_list')).items).toHaveLength(1);
  }finally{await h.dispose();}
});
