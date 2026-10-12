import path from 'node:path';
import {readFileSync} from 'node:fs';
import {fail} from '../contracts.js';
export function selectConfig(argv:string[],env:NodeJS.ProcessEnv,home:string):string {
  const i=argv.indexOf('--config');let selected=i>=0?argv[i+1]:env.KG_CONFIG_PATH;
  if(i>=0&&!selected)fail('INVALID_INPUT');
  if(!selected){const base=path.join(home,'.config','obsidian-knowledge-graph');try{const loc=JSON.parse(readFileSync(path.join(base,'location.json'),'utf8'));selected=loc.config_path;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}if(!selected)selected=path.join(base,'config.json');}
  if(typeof selected!=='string'||!path.isAbsolute(selected))fail('INVALID_INPUT','Absolute config path required');return selected;
}
