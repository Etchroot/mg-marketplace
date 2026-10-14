import {z} from 'zod';
export class KnowledgeError extends Error {
  constructor(readonly code: string, message = code) {super(message); this.name = 'KnowledgeError';}
}
export function fail(code: string, message?: string): never {throw new KnowledgeError(code, message);}
export const UUID = z.uuid();
export const TopicId = z.string().regex(/^topic-[a-z0-9][a-z0-9-]{0,79}$/);
export const RecordType = z.enum(['essay','journal','company_research','work','project','experience','reference','other']);
export const Category = z.enum(['Essays','Journal','Companies','Work','Projects','References']);
export const Policy = z.object({agent_access: z.enum(['allowed','excluded']), github: z.boolean(), notion: z.boolean()}).strict();
export const ConfigSchema = z.object({
  schema_version: z.literal(1), vault_path: z.string().min(1), allowed_input_roots: z.array(z.string().min(1)),
  git: z.object({enabled: z.boolean().default(false), remote: z.string().regex(/^[a-zA-Z0-9_-]+$/).default('origin'), branch: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9/_-]*$/).default('main'), push_on_capture: z.boolean().default(true)}).default({enabled:false,remote:'origin',branch:'main',push_on_capture:true}),
  notion: z.object({enabled: z.literal(false).default(false), parent_page_id: z.null().optional(), credential_ref: z.null().optional()}).default({enabled:false}),
  runtime_path: z.string().optional(),
  search: z.object({limit:z.number().int().min(1).max(10),default_hops:z.number().int().min(1).max(2),max_hops:z.number().int().max(2),max_nodes:z.number().int().min(1).max(20)}).optional(),
  read: z.object({default_chars:z.number().int().min(1).max(8000),max_chars:z.number().int().min(1).max(8000)}).optional()
}).strict();
export type Config = z.infer<typeof ConfigSchema>;
export const VersionSchema = z.object({revision:z.number().int().positive(), raw_path:z.string(), inbox_origin:z.string().optional(), parent_revision:z.number().int().positive().optional(), original_name:z.string(), document_status:z.enum(['draft','final','submitted']).optional(),occurred_on:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),sha256:z.string().regex(/^[a-f0-9]{64}$/), byte_length:z.number().int().nonnegative(), extraction:z.enum(['text','unsupported','provided']), state:z.enum(['inbox','organized']), summary_id:UUID.optional(),summary_path:z.string().optional(),extracted_path:z.string().optional(),extracted_sha256:z.string().regex(/^[a-f0-9]{64}$/).optional(),extractor:z.string().optional()}).strict();
export const RecordSchema = z.object({schema_version:z.literal(1),record_id:UUID,title:z.string().min(1).max(200),record_type:RecordType,document_status:z.enum(['draft','final','submitted']).default('final'),occurred_on:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),captured_at:z.iso.datetime({offset:true}),latest_revision:z.number().int().positive(),policy:Policy,versions:z.array(VersionSchema).min(1)}).strict();
export type RecordData = z.infer<typeof RecordSchema>;
export type Version = z.infer<typeof VersionSchema>;
export const EvidenceSchema = z.object({record_id:UUID,revision:z.number().int().positive(),line_start:z.number().int().positive(),line_end:z.number().int().positive(),quote:z.string().min(1).max(2000)}).strict();
export const RelationSchema = z.object({target_id:z.string().min(1),kind:z.enum(['covers_topic','uses_experience','related_to','version_of']),origin:z.enum(['agent','manual']).default('agent'),evidence:z.array(EvidenceSchema).min(1)}).strict();
export const SummaryDraftSchema = z.object({record_id:UUID,revision:z.number().int().positive(),category:Category,title:z.string().min(1).max(200),topics:z.array(TopicId).max(30),keywords:z.array(z.string().min(1).max(100)).max(40),entities:z.array(z.string().max(100)).max(30),use_cases:z.array(z.string().max(200)).max(20),overview:z.string().min(1).max(4000),facts:z.array(z.object({text:z.string().min(1).max(1000),evidence:z.array(EvidenceSchema).min(1)}).strict()).min(1).max(30),interpretations:z.array(z.string().max(1000)).max(20),relations:z.array(RelationSchema).max(40)}).strict();
export type SummaryDraft = z.infer<typeof SummaryDraftSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export interface Topic {id:string; key:string; title:string; aliases:string[]}
export interface CatalogRow {
  record_id:string; revision:number; title:string; record_type:string; document_status:string; occurred_on?:string;
  raw_path:string; source_sha256:string; summary_id?:string; summary_path?:string; extraction:string; state:string;
  topics:string[]; keywords:string[]; entities:string[]; use_cases:string[]; overview:string; github:boolean;extracted_path?:string;extracted_sha256?:string;
}
export interface Edge {source:string;target:string;kind:string;evidence:Evidence[]}
export interface Snapshot {records:CatalogRow[];topics:Topic[];edges:Edge[];fingerprint:string}
export interface Change {path:string; expected:string|null; content:string|null}
export interface OperationResult {operation_id:string;record_ids:string[];local_state:'succeeded'|'failed';github_state:string;notion_state:string;changed_paths:string[];errors:Array<{code:string;retryable:boolean}>;commit?:string;covered_operation_ids?:string[];committed_files?:Array<{path:string;hash:string|null}>;push_destination?:string}
export interface Operation {schema_version:1;operation_id:string;kind:string;created_at:string;expires_at:string;changes:Change[];record_ids:string[];source?:{path:string;sha256:string};inbox_sources?:string[];state:'prepared'|'applying'|'local_committed';applied:number;result?:OperationResult}
export function parse<T>(schema:z.ZodType<T>, input:unknown):T {const r=schema.safeParse(input); return r.success?r.data:fail('INVALID_INPUT',r.error.issues.map(i=>i.path.join('.')+': '+i.code).join('; '));}
