import {test,expect} from 'vitest';
import {prepare,get,save,apply,change} from '../../src/storage/journal.js';
import {writeAtomic,sha256} from '../../src/storage/atomic.js';
import {createHarness} from '../support/harness.js';
test('interruption after rename before journal advance resumes without duplicating or overwriting',async()=>{
  const h=await createHarness();try{await h.setup();
    const a=await change(h.vault,'00_Inbox/a.md','first');const b=await change(h.vault,'00_Inbox/b.md','second');
    const op=await prepare(h.vault,'capture',[a,b],[]);op.state='applying';await save(h.vault,op);
    await writeAtomic(h.vault,a.path,Buffer.from(a.content!,'base64'),null);
    const result=await apply(h.vault,await get(h.vault,op.operation_id),true);
    expect(result.local_state).toBe('succeeded');expect((await get(h.vault,op.operation_id)).applied).toBe(2);
    expect(await apply(h.vault,await get(h.vault,op.operation_id),true)).toEqual(result);
  }finally{await h.dispose();}
});
test('resume preserves an external edit after interruption',async()=>{
  const h=await createHarness();try{await h.setup();const a=await change(h.vault,'00_Inbox/a.md','new');const op=await prepare(h.vault,'capture',[a],[]);op.state='applying';await save(h.vault,op);
    await writeAtomic(h.vault,a.path,'human');await expect(apply(h.vault,op,true)).rejects.toMatchObject({code:'HASH_CONFLICT'});
  }finally{await h.dispose();}
});
