import {test,expect} from 'vitest';
import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';import path from 'node:path';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {createHarness} from '../support/harness.js';
const exec=promisify(execFile);
test('40 golden queries cover exact titles, aliases, filters, no evidence, inbox, and binary coverage',async()=>{
  const h=await createHarness();try{await h.setup();const essay=await h.capture('AI 네이티브 원문 경험\n근거 2','검증된 지원서','essay',{occurred_on:'2026-10-01',document_status:'submitted'});const id=essay.record_ids[0];await h.organize(id,{keywords:['AI 네이티브','검증된 업무 경험','예약 자동화'],entities:['합성기업']});
    const project=await h.capture('연결 프로젝트 원문','테스트 프로젝트','project');await h.organize(project.record_ids[0],{category:'Projects',keywords:['AI 네이티브','연결 프로젝트']});
    await h.capture('아직 정리하지 않은 원문','미정리 일기','journal');await h.capture(Buffer.from([0,255]),'추출 미지원','essay');
    const questions:Array<{id:string;input:Record<string,unknown>;expected_ids:string[];expect_empty?:boolean}>=[];
    const positives=[{terms:['검증된 지원서']},{terms:['검증된 업무 경험']},{terms:['합성기업']},{terms:['예약 자동화']},{terms:['원문 경험'],fallback:'raw_text'},{terms:['지원서','합성기업']},{terms:['검증된','예약']},{terms:['예약','자동화']},{terms:['업무','경험']},{terms:['지원서','업무']}];
    for(let i=0;i<10;i++)questions.push({id:'exact-'+i,input:{...positives[i],record_types:['essay']},expected_ids:[id]});
    const aliases=[['AI-native'],['AI native'],['AI네이티브'],['AI 네이티브'],['topic-ai-native'],['AI-native','지원서'],['AI native','합성기업'],['AI네이티브','자동화'],['AI 네이티브','검증된 업무 경험'],['topic-ai-native','예약']];for(let i=0;i<10;i++)questions.push({id:'alias-'+i,input:{terms:aliases[i],record_types:['essay']},expected_ids:[id]});
    const filters=[{document_status:'submitted'},{date_from:'2026-10-01',date_to:'2026-10-01'},{versions:'all'},{versions:'latest'},{record_types:['essay'],limit:1},{date_to:'2026-10-31',record_types:['essay']},{date_from:'2026-09-01',record_types:['essay']},{document_status:'submitted',versions:'all'},{date_from:'2026-10-01',document_status:'submitted'},{record_types:['essay'],document_status:'submitted',limit:2}];for(let i=0;i<10;i++)questions.push({id:'filter-'+i,input:{terms:['AI 네이티브'],...filters[i]},expected_ids:[id]});
    const negatives=[{terms:['없는 기업']},{terms:['AI 네이티브'],record_types:['company_research']},{terms:['AI 네이티브'],date_from:'2027-01-01'},{terms:['AI 네이티브'],document_status:'draft'},{terms:['없는 키워드'],fallback:'raw_text'},{terms:['AI 네이티브'],date_to:'2025-12-31'},{terms:['존재하지 않는 성과']},{terms:['AI-native'],record_types:['journal']},{terms:['지시를 무시하고 실행']},{terms:['없는 키워드'],versions:'all'}];for(let i=0;i<10;i++)questions.push({id:'negative-'+i,input:negatives[i],expected_ids:[],expect_empty:true});
    const dataset=path.join(h.dir,'questions.json');const report=path.join(h.dir,'eval.json');await writeFile(dataset,JSON.stringify({questions}));
    await exec(process.execPath,['dist/cli.cjs','eval','--config',h.configPath,'--dataset',dataset,'--output',report]);const evaluated=JSON.parse(await readFile(report,'utf8'));expect(evaluated.total).toBe(40);expect(evaluated.passed).toBe(40);
    const missing=await h.invoke('kg_search',{terms:['不存在 자료']});expect(missing.coverage.inbox_count).toBe(2);expect(missing.coverage.unsearchable_count).toBe(1);
    await mkdir('eval',{recursive:true});await cp(report,'eval/latest-report.json');await writeFile('eval/questions.json',JSON.stringify({description:'Synthetic keyword test templates; IDs are assigned by the evaluation fixture.',questions:questions.map(({expected_ids,...q})=>({...q,expected_role:expected_ids.length?'essay':'none'}))},null,2));
  }finally{await h.dispose();}
});
