import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
for(const [entry,out] of [['src/mcp/server.ts','dist/mcp.cjs'],['src/cli/main.ts','dist/cli.cjs']])await build({entryPoints:[entry],outfile:out,bundle:true,platform:'node',format:'cjs',target:'node24',legalComments:'eof'});
console.log('Built standalone MCP and CLI bundles.');
