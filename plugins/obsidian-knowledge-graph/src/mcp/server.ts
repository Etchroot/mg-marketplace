import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {ListToolsRequestSchema,CallToolRequestSchema} from '@modelcontextprotocol/sdk/types.js';
import {z} from 'zod';
import {homedir} from 'node:os';
import path from 'node:path';
import {KnowledgeService} from '../tools/handlers.js';
import {schemas,descriptions,type ToolName} from '../tools/schemas.js';
import {selectConfig} from '../config/location.js';
import {VERSION} from '../version.js';
export function configPath():string {
  return selectConfig(process.argv.slice(2),process.env,homedir());
}
async function main(){
  const service=new KnowledgeService(configPath());const server=new Server({name:'obsidian-knowledge-graph',version:VERSION},{capabilities:{tools:{}}});
  server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:Object.entries(schemas).map(([name,schema])=>({name,description:descriptions[name as ToolName],inputSchema:z.toJSONSchema(schema,{unrepresentable:'any'}) as {type:'object'},annotations:{readOnlyHint:['kg_status','kg_inbox_list','kg_read','kg_search','kg_neighbors','kg_validate'].includes(name),destructiveHint:false,openWorldHint:name.startsWith('kg_sync')||name==='kg_retry'}}))}));
  server.setRequestHandler(CallToolRequestSchema,async(request)=>{
    try{const result=await service.invoke(request.params.name,(request.params.arguments??{}) as Record<string,unknown>);return {content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result};}
    catch(e){const code=(e as {code?:string}).code??'INTERNAL_ERROR';return {isError:true,content:[{type:'text',text:JSON.stringify({error:{code},hint:'Check settings, input scope, source hash, or operation status; no raw text is logged.'})}]};}
  });
  await server.connect(new StdioServerTransport());
}
main().catch(()=>{process.stderr.write('Knowledge graph startup failed. Check Node 24 and the absolute config path.\n');process.exitCode=1;});
