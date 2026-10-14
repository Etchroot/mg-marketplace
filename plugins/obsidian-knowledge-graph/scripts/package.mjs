import {cp,mkdir,readFile,readdir,lstat} from 'node:fs/promises';
import path from 'node:path';
const index=process.argv.indexOf('--output');
const output=path.resolve(index>=0?process.argv[index+1]:'artifacts/obsidian-knowledge-graph');
if(output===process.cwd())throw new Error('Package output must differ from source');
await mkdir(output,{recursive:true});
const entries=['.gitignore','.gitattributes','plugin.json','.codex-plugin','.claude-plugin','mcp.json','.mcp.json','skills','templates','schemas','docs','README.md','LICENSE','THIRD_PARTY_NOTICES.md','dist/mcp.cjs','dist/cli.cjs','scripts/bridge.mjs','src','tests','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','tsconfig.json','vitest.config.ts','scripts/build.mjs','scripts/package.mjs','scripts/check-package.mjs','eval/questions.json'];
for(const file of entries)await cp(file,path.join(output,file),{recursive:true,dereference:false});
console.log('Packaged '+output);
