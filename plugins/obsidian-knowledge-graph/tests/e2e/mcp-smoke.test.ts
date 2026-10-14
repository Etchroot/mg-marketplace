import {test,expect} from 'vitest';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'node:path';import {mkdir,cp,writeFile,readdir} from 'node:fs/promises';
import {createHarness} from '../support/harness.js';
test('bundled MCP lists and invokes tools from a Korean installation path and unrelated cwd',async()=>{
  const h=await createHarness();const client=new Client({name:'kg-test',version:'1'});
  try{const installed=path.join(h.dir,'설치 경로');await mkdir(installed);await cp('dist/mcp.cjs',path.join(installed,'mcp.cjs'));
    const transport=new StdioClientTransport({command:process.execPath,args:[path.join(installed,'mcp.cjs'),'--config',h.configPath],cwd:h.inputs,stderr:'pipe'});
    await client.connect(transport);const tools=await client.listTools();expect(tools.tools).toHaveLength(17);expect(tools.tools.some(t=>t.name==='kg_status')).toBe(true);
    const result=await client.callTool({name:'kg_status',arguments:{}});expect((result.structuredContent as any).configured).toBe(false);
    const invalid=await client.callTool({name:'kg_capture_preview',arguments:{text:'raw',title:'a',type:'bad'}});expect(invalid.isError).toBe(true);
  }finally{await client.close();await h.dispose();}
});

test('packaged MCP exposes direct Inbox registration and revision preservation from an unrelated session folder',async()=>{
  const h=await createHarness();const client=new Client({name:'kg-inbox-test',version:'1'});
  try{await h.setup();const inbox='00_Inbox/메모.md';await writeFile(path.join(h.vault,inbox),'기존 문장\r\n');
    await client.connect(new StdioClientTransport({command:process.execPath,args:[path.resolve('dist/mcp.cjs'),'--config',h.configPath],cwd:h.inputs,stderr:'pipe'}));
    const call=async(name:string,args:Record<string,unknown>={})=>{const result=await client.callTool({name,arguments:args});expect(result.isError).not.toBe(true);return result.structuredContent as any;};
    expect((await call('kg_inbox_list')).unregistered_inbox_count).toBe(1);
    expect((await call('kg_read',{inbox_path:inbox,view:'raw'})).text).toBe('기존 문장\n');
    const args={inbox_path:inbox,title:'메모',type:'other'};const p=await call('kg_capture_preview',args);await call('kg_capture_commit',{preview_id:p.preview_id});
    expect((await call('kg_capture_preview',args)).already_registered).toBe(true);expect(await readdir(path.join(h.vault,'00_Inbox'))).toEqual(['메모.md']);
    await writeFile(path.join(h.vault,inbox),'수정한 문장');const revised=await call('kg_capture_preview',{record_id:p.record_id,modified_revision:1,title:'메모',type:'other'});await call('kg_capture_commit',{preview_id:revised.preview_id});
    expect((await h.rawBytes(p.record_id,1)).toString()).toBe('기존 문장\r\n');expect((await h.rawBytes(p.record_id,2)).toString()).toBe('수정한 문장');
  }finally{await client.close();await h.dispose();}
});
