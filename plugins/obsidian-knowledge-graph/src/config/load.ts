import {readFile,mkdir,realpath} from 'node:fs/promises';
import path from 'node:path';
import {ConfigSchema,parse,fail,type Config} from '../contracts.js';
import {contained} from '../storage/paths.js';
export async function loadConfig(file:string):Promise<Config>{
  try{return parse(ConfigSchema,JSON.parse(await readFile(file,'utf8')));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')fail('CONFIG_REQUIRED');throw e;}
}
export async function validateConfig(input:unknown,configPath:string):Promise<Config>{
  const c=parse(ConfigSchema,input);
  if(!path.isAbsolute(c.vault_path)||c.allowed_input_roots.some(r=>!path.isAbsolute(r)))fail('INVALID_INPUT','Absolute paths required');
  await mkdir(c.vault_path,{recursive:true});c.vault_path=await realpath(c.vault_path);
  c.allowed_input_roots=await Promise.all(c.allowed_input_roots.map(r=>realpath(r)));
  if(contained(c.vault_path,path.resolve(configPath)))fail('INVALID_INPUT','Config must be outside the Vault');
  if(c.runtime_path && path.resolve(c.runtime_path)!==path.join(c.vault_path,'.kg-runtime'))fail('INVALID_INPUT','Runtime must be Vault/.kg-runtime');
  return c;
}
