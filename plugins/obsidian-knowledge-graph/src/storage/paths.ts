import path from 'node:path';
import {realpath, lstat} from 'node:fs/promises';
import {fail} from '../contracts.js';
export function contained(root:string, target:string):boolean {
  const rel=path.relative(root,target);
  return !path.isAbsolute(rel) && rel !== '..' && !rel.startsWith('..'+path.sep);
}
export async function resolveInside(root:string, relative:string):Promise<string> {
  if(!relative || path.isAbsolute(relative) || /^[a-z]:/i.test(relative) || relative.includes('\0') || relative.includes(':')) fail('OUTSIDE_ROOT');
  const normalized=relative.replace(/\\/g,'/');
  if(normalized.split('/').some(s=>s==='..'||/[. ]$/.test(s))) fail('OUTSIDE_ROOT');
  const actualRoot=await realpath(root); const target=path.resolve(actualRoot, normalized);
  if(!contained(actualRoot,target)) fail('OUTSIDE_ROOT');
  let parent=target;
  for(;;) {
    try {await lstat(parent); const actual=await realpath(parent); if(!contained(actualRoot,actual)) fail('OUTSIDE_ROOT'); break;}
    catch(e) {if((e as NodeJS.ErrnoException).code!=='ENOENT') throw e; const up=path.dirname(parent); if(up===parent) fail('OUTSIDE_ROOT'); parent=up;}
  }
  return target;
}
export async function inputPath(roots:string[], absolute:string):Promise<string> {
  if(!path.isAbsolute(absolute)) fail('OUTSIDE_ROOT');
  for(const root of roots) {
    if(contained(root,absolute)) return resolveInside(root,path.relative(root,absolute));
  }
  return fail('OUTSIDE_ROOT');
}
export const slash=(p:string)=>p.split(path.sep).join('/');
