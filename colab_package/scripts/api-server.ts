#!/usr/bin/env -S npx tsx
/**
 * ComicVideoAI Headless API Server
 *
 * REST API for running the ComicVideoAI pipeline programmatically.
 * Used by bots, automation, and other non-UI clients.
 *
 * Usage:
 *   npx tsx scripts/api-server.ts
 *   PORT=8000 npx tsx scripts/api-server.ts
 *
 * Endpoints:
 *   POST /jobs              — Create & run a pipeline job
 *   GET  /jobs/:id           — Get job status + progress
 *   GET  /jobs/:id/result    — Get full job result with assets
 *   GET  /jobs               — List all jobs
 *   POST /jobs/:id/cancel    — Cancel a running job
 *   GET  /health             — Health check
 */

import * as http from 'node:http';
import { createJob, getJob, getJobSummary, getJobResult, setJobRunning, setJobProgress, setJobDone, setJobFailed, listJobs, cancelJob } from '../services/jobManager';
import { runFullPipeline, type PipelineConfig } from '../services/pipeline';

const PORT = parseInt(process.env.API_PORT || process.env.PORT || '8000', 10);
const HOST = process.env.API_HOST || '0.0.0.0';

// ── Helpers ────────────────────────────────────────────────────────

function json(res: http.ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function parseUrl(url: string = ''): { pathname: string; segments: string[] } {
  const [path] = url.split('?');
  const segments = path.split('/').filter(Boolean);
  return { pathname: path, segments };
}

// ── Router ─────────────────────────────────────────────────────────

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  const { segments } = parseUrl(req.url);

  // GET /health
  if (req.method === 'GET' && segments[0] === 'health') {
    return json(res, { ok: true, service: 'comicvideoai-api', version: '0.1.0' });
  }

  // GET /jobs
  if (req.method === 'GET' && segments[0] === 'jobs' && segments.length === 1) {
    const jobs = listJobs().map(getJobSummary);
    return json(res, jobs);
  }

  // POST /jobs
  if (req.method === 'POST' && segments[0] === 'jobs' && segments.length === 1) {
    try {
      const body = await readBody(req);
      const params = JSON.parse(body);

      const scriptText: string = params.script || params.text || params.story || '';
      if (!scriptText.trim()) {
        return json(res, { error: 'Missing "script" field in request body' }, 400);
      }

      const opts = params.options || {};
      const config: PipelineConfig = {
        artStyle: params.artStyle || params.style || 'comic_manhua',
        voiceName: params.voiceName || params.voice || 'vi-VN-HoaiMyNeural',
        languageCode: params.languageCode || 'vi-VN',
        sceneCount: params.sceneCount || params.scenes,
        allowRewriteForViral: params.allowRewriteForViral ?? opts.allowRewriteForViral ?? false,
        autoImprove: opts.autoImprove ?? false,
        storyExpansion: opts.storyExpansion ?? false,
        visualConsistency: opts.visualConsistency ?? false,
        promptEnhance: opts.promptEnhance || undefined,
        referenceAudioBase64: params.referenceAudioBase64 || opts.referenceAudioBase64 || undefined,
        referenceAudioMimeType: params.referenceAudioMimeType || opts.referenceAudioMimeType || 'audio/wav',
        worldContext: params.worldContext || params.context || opts.worldContext,
        characters: params.characters || opts.characters,
        onProgress: (step: string, detail: string) => {
          setJobProgress(job.id, step, detail);
        },
      };

      const job = createJob({ artStyle: config.artStyle, scriptPreview: scriptText.slice(0, 100) });
      setJobRunning(job.id);

      // Run pipeline in background (don't await)
      runFullPipeline(scriptText, config)
        .then((result) => {
          setJobDone(job.id, result);
        })
        .catch((err: Error) => {
          console.error(`[Job ${job.id}] Failed:`, err.message);
          setJobFailed(job.id, err.message);
        });

      return json(res, getJobSummary(job), 202);
    } catch (e: any) {
      return json(res, { error: `Invalid request: ${e.message}` }, 400);
    }
  }

  // GET /jobs/:id/result
  if (req.method === 'GET' && segments[0] === 'jobs' && segments[2] === 'result') {
    const job = getJob(segments[1]);
    if (!job) return json(res, { error: 'Job not found' }, 404);
    return json(res, getJobResult(job));
  }

  // POST /jobs/:id/cancel
  if (req.method === 'POST' && segments[0] === 'jobs' && segments[2] === 'cancel') {
    const ok = cancelJob(segments[1]);
    if (!ok) return json(res, { error: 'Job not found or cannot be cancelled' }, 404);
    return json(res, { ok: true });
  }

  // GET /jobs/:id
  if (req.method === 'GET' && segments[0] === 'jobs' && segments.length === 2) {
    const job = getJob(segments[1]);
    if (!job) return json(res, { error: 'Job not found' }, 404);
    return json(res, getJobSummary(job));
  }

  // 404
  return json(res, { error: 'Not found' }, 404);
}

// ── Start ──────────────────────────────────────────────────────────

const server = http.createServer(handleRequest);

server.listen(PORT, HOST, () => {
  console.log(`\n  ComicVideoAI API Server`);
  console.log(`  ────────────────────────`);
  console.log(`  URL:     http://${HOST}:${PORT}`);
  console.log(`  Health:  http://${HOST}:${PORT}/health`);
  console.log(`  Jobs:    http://${HOST}:${PORT}/jobs`);
  console.log(`\n  POST /jobs  { script, artStyle, voiceName, sceneCount }\n`);
});
