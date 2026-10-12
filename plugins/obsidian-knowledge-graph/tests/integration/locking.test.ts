import {test,expect} from 'vitest';
import {withVaultLock} from '../../src/storage/lock.js';
import {createHarness} from '../support/harness.js';
test('competing writer times out without deleting a live lock',async()=>{
  const h=await createHarness();let release!:()=>void;const held=new Promise<void>(r=>release=r);let entered!:()=>void;const ready=new Promise<void>(r=>entered=r);
  try{const a=withVaultLock(h.vault,async()=>{entered();await held;});await ready;
    await expect(withVaultLock(h.vault,async()=>1,50)).rejects.toMatchObject({code:'VAULT_BUSY'});release();await a;
    expect(await withVaultLock(h.vault,async()=>2)).toBe(2);
  }finally{release();await h.dispose();}
});
