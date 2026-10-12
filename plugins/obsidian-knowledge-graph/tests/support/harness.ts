import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { KnowledgeService } from '../../src/tools/handlers.js';
export async function createHarness() {
  const dir = await mkdtemp(path.join(tmpdir(), 'kg-한글 경로-'));
  const vault = path.join(dir, 'vault'); const inputs = path.join(dir, 'inputs');
  await mkdir(vault); await mkdir(inputs);
  const configPath = path.join(dir, 'settings', 'config.json');
  const service = new KnowledgeService(configPath);
  const config = {schema_version: 1 as const, vault_path: vault, allowed_input_roots: [inputs], git: {enabled: false, remote: 'origin', branch: 'main',push_on_capture:true}, notion: {enabled: false as const}};
  const invoke = (name: string, args: Record<string, unknown> = {}) => service.invoke(name, args);
  async function setup() { const p = await invoke('kg_setup_preview', config); await invoke('kg_setup_commit', {preview_id: p.preview_id}); }
  async function capture(text: string | Uint8Array, title = 'AI 자소서', type = 'essay', options: Record<string, unknown> = {}) {
    const source = await writeInput(title + '.md', text);
    const p = await invoke('kg_capture_preview', {source_path: source, title, type, ...options});
    return invoke('kg_capture_commit', {preview_id: p.preview_id});
  }
  async function writeInput(name: string, text: string | Uint8Array) { const file = path.join(inputs, name); await writeFile(file, text); return file; }
  async function record(id: string) { return JSON.parse(await readFile(path.join(vault, '90_Records', id + '.json'), 'utf8')); }
  async function rawBytes(id: string, revision = 1) { const r = await record(id); return readFile(path.join(vault, r.versions.find((v: any) => v.revision === revision).raw_path)); }
  async function draft(id: string, extra: Record<string, unknown> = {}) {
    const r = await record(id); const revision = r.latest_revision;
    const v=r.versions.find((v:any)=>v.revision===revision);
    const text = v.extracted_path?await readFile(path.join(vault,v.extracted_path),'utf8'):new TextDecoder().decode(await rawBytes(id, revision));
    return {record_id: id, revision, category: 'Essays', title: r.title, topics: ['topic-ai-native'], keywords: ['AI 네이티브'], entities: [], use_cases: ['지원동기'], overview: 'AI 네이티브 업무 경험', facts: [{text: 'AI 경험', evidence: [{record_id: id, revision, line_start: 1, line_end: 1, quote: text.split(/\r?\n/)[0]}]}], interpretations: [], relations: [], ...extra};
  }
  async function organize(id: string, extra: Record<string, unknown> = {}) { const p = await invoke('kg_organize_preview', {drafts: [await draft(id, extra)]}); return invoke('kg_organize_commit', {preview_id: p.preview_id}); }
  return {dir, vault, inputs, configPath, config, service, invoke, setup, capture, writeInput, record, rawBytes, draft, organize, dispose: () => rm(dir, {recursive: true, force: true})};
}
