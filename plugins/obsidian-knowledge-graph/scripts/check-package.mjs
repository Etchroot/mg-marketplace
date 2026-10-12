import {readFile,readdir,lstat,stat} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(process.argv[2]??'.');
const read=async file=>JSON.parse(await readFile(path.join(root,file),'utf8'));
const plugin=await read('plugin.json');
if(plugin.name!=='obsidian-knowledge-graph'||!/^\d+\.\d+\.\d+$/.test(plugin.version))throw new Error('Invalid identity');
for(const file of ['.codex-plugin/plugin.json','.claude-plugin/plugin.json']){const m=await read(file);if(m.name!==plugin.name||m.version!==plugin.version)throw new Error('Manifest mismatch');}
if(plugin.extensions['com.openai'].interface.shortDescription.length>30)throw new Error('Subtitle too long');
for(const file of ['dist/mcp.cjs','dist/cli.cjs','LICENSE','THIRD_PARTY_NOTICES.md','docs/setup.md'])await stat(path.join(root,file));
const servers=(await read('mcp.json')).mcpServers;if(!servers['obsidian-knowledge-graph']||servers['obsidian-knowledge-graph'].type!=='stdio')throw new Error('Invalid MCP entry');
for(const name of ['setup','capture','organize','search','sync','maintenance']){const skill=(await readFile(path.join(root,'skills',name,'SKILL.md'),'utf8')).replace(/\r\n/g,'\n');if(!skill.startsWith('---\n')||!skill.includes('name: '+name+'\n'))throw new Error('Skill frontmatter');}
if(root!==process.cwd()){
  const walk=async(dir)=>{for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);const s=await lstat(p);if(s.isSymbolicLink()||/^(node_modules|\.git|\.kg-runtime|\.env.*|config\.json|90_Records|00_Inbox)$/.test(e.name))throw new Error('Private or linked entry '+p);if(s.isDirectory())await walk(p);}};await walk(root);
}
console.log('Package identity, payload paths, skills, MCP, and private-file exclusions validated.');
