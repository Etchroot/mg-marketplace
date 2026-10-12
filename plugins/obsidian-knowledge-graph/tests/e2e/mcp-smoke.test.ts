import {test,expect} from 'vitest';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'node:path';import {mkdir,cp} from 'node:fs/promises';
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
