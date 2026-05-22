/**
 * Job Manager — simple in-memory job queue for the headless API.
 *
 * Tracks pipeline jobs through their lifecycle:
 * pending → running → done / failed / cancelled
 */

import { PipelineResult } from './pipeline';

export type JobStatus = 'pending' | 'running' | 'done' | 'failed' | 'cancelled';

export interface Job {
  id: string;
  status: JobStatus;
  progress: string;
  progressDetail: string;
  createdAt: string;
  updatedAt: string;
  config: Record<string, unknown>;
  result?: PipelineResult;
  error?: string;
}

const jobs = new Map<string, Job>();

function generateId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function now(): string {
  return new Date().toISOString();
}

export function createJob(config: Record<string, unknown> = {}): Job {
  const job: Job = {
    id: generateId(),
    status: 'pending',
    progress: '',
    progressDetail: '',
    createdAt: now(),
    updatedAt: now(),
    config,
  };
  jobs.set(job.id, job);
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, update: Partial<Job>): Job | undefined {
  const job = jobs.get(id);
  if (!job) return undefined;
  Object.assign(job, update, { updatedAt: now() });
  return job;
}

export function setJobRunning(id: string): void {
  updateJob(id, { status: 'running', progress: 'Starting pipeline...' });
}

export function setJobProgress(id: string, progress: string, detail: string): void {
  updateJob(id, { progress, progressDetail: detail });
}

export function setJobDone(id: string, result: PipelineResult): void {
  updateJob(id, {
    status: 'done',
    progress: 'Complete',
    progressDetail: `${result.assets.length} scenes generated`,
    result,
  });
}

export function setJobFailed(id: string, error: string): void {
  updateJob(id, { status: 'failed', error, progress: 'Failed' });
}

export function cancelJob(id: string): boolean {
  const job = jobs.get(id);
  if (!job || (job.status !== 'pending' && job.status !== 'running')) return false;
  updateJob(id, { status: 'cancelled', progress: 'Cancelled' });
  return true;
}

export function listJobs(): Job[] {
  return Array.from(jobs.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getJobSummary(job: Job) {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    progressDetail: job.progressDetail,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    error: job.error,
  };
}

export function getJobResult(job: Job) {
  if (job.status === 'done' && job.result) {
    return {
      id: job.id,
      status: job.status,
      totalDuration: job.result.totalDuration,
      sceneCount: job.result.assets.length,
      errors: job.result.errors,
      assets: job.result.assets.map((a) => ({
        index: a.index,
        summary: a.scene.summary,
        voiceoverText: a.voiceoverText,
        hasImage: !!a.imageBase64,
        hasAudio: !!a.audioBase64,
        imageBase64: a.imageBase64,
        audioBase64: a.audioBase64,
        error: a.error,
      })),
    };
  }
  return { id: job.id, status: job.status, error: job.error };
}
