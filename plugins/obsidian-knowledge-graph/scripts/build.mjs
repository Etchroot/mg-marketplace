import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
for(const [entry,out] of [['src/mcp/server.ts','dist/mcp.cjs'],['src/cli/main.ts','dist/cli.cjs']])await build({entryPoints:[entry],outfile:out,bundle:true,platform:'node',format:'cjs',target:'node24',legalComments:'eof'});
const generated=await build({stdin:{contents:"import {z} from 'zod'; import {schemas} from './src/tools/schemas.js'; import {RecordSchema,SummaryDraftSchema,ConfigSchema} from './src/contracts.js'; export const definitions=Object.fromEntries(Object.entries({...schemas,record:RecordSchema,summary:SummaryDraftSchema,config:ConfigSchema}).map(([name,schema])=>[name,z.toJSONSchema(schema,{unrepresentable:'any'})]));",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',target:'node24',write:false});
const {definitions}=await import('data:text/javascript;base64,'+Buffer.from(generated.outputFiles[0].contents).toString('base64'));
await mkdir('schemas',{recursive:true});for(const [name,schema] of Object.entries(definitions))await writeFile('schemas/'+name+'.schema.json',JSON.stringify(schema,null,2)+'\n');
console.log('Built standalone MCP and CLI bundles.');
