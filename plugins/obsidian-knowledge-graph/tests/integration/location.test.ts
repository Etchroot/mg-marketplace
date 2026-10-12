import {test,expect} from 'vitest';import {mkdir,writeFile} from 'node:fs/promises';import path from 'node:path';
import {selectConfig} from '../../src/config/location.js';import {createHarness} from '../support/harness.js';
test('explicit config wins and installed bundles share a stable external settings location',async()=>{
  const h=await createHarness();try{const base=path.join(h.dir,'.config','obsidian-knowledge-graph');await mkdir(base,{recursive:true});await writeFile(path.join(base,'location.json'),JSON.stringify({config_path:h.configPath}));expect(selectConfig([],{},h.dir)).toBe(h.configPath);expect(selectConfig(['--config',path.join(h.dir,'override.json')],{KG_CONFIG_PATH:h.configPath},h.dir)).toBe(path.join(h.dir,'override.json'));expect(()=>selectConfig(['--config','relative.json'],{},h.dir)).toThrow();}finally{await h.dispose();}
});
