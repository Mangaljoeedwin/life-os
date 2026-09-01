import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type RunType = 'morning' | 'night' | 'manual' | 'reconciliation';
type SyncStatus = 'complete' | 'partial' | 'missing' | 'error';
type SleepStatus = 'complete' | 'partial' | 'missing' | 'not_synced' | 'not_checked';

type CorosActivityInput = {
  coros_activity_id: string;
  activity_type: string;
  activity_date?: string | null;
  started_at?: string | null;
  duration_seconds?: number | null;
  distance_km?: number | null;
  jump_count?: number | null;
  calories?: number | null;
  raw_coros_data?: Record<string, unknown> | null;
};

type SnapshotInput = {
  schema_version: 1;
  record_date: string;
  timezone: 'Asia/Kolkata';
  run_type: RunType;
  captured_at: string;
  sync_status: SyncStatus;
  daily?: {
    steps?: number | null;
    calories?: number | null;
    exercise_minutes?: number | null;
    sleep_duration_minutes?: number | null;
    sleep_score?: number | null;
    sleep_status?: SleepStatus;
  };
  activities?: CorosActivityInput[];
  raw_coros_data?: Record<string, unknown> | null;
};

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, mcp-protocol-version',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'content-type': 'application/json' },
});

const finiteOrNull = (value: unknown, minimum = 0) => {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) throw new Error('Invalid numeric measurement.');
  return value;
};

function validateSnapshot(value: unknown): SnapshotInput {
  if (!value || typeof value !== 'object') throw new Error('Snapshot must be an object.');
  const input = value as SnapshotInput;
  if (input.schema_version !== 1) throw new Error('schema_version must be 1.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.record_date)) throw new Error('record_date must be YYYY-MM-DD.');
  if (input.timezone !== 'Asia/Kolkata') throw new Error('timezone must be Asia/Kolkata.');
  if (!['morning', 'night', 'manual', 'reconciliation'].includes(input.run_type)) throw new Error('Invalid run_type.');
  if (!['complete', 'partial', 'missing', 'error'].includes(input.sync_status)) throw new Error('Invalid sync_status.');
  if (Number.isNaN(Date.parse(input.captured_at))) throw new Error('captured_at must be an ISO timestamp.');
  if (input.daily) {
    finiteOrNull(input.daily.steps);
    finiteOrNull(input.daily.calories);
    finiteOrNull(input.daily.exercise_minutes);
    finiteOrNull(input.daily.sleep_duration_minutes);
    finiteOrNull(input.daily.sleep_score);
    if (input.daily.sleep_status && !['complete', 'partial', 'missing', 'not_synced', 'not_checked'].includes(input.daily.sleep_status)) {
      throw new Error('Invalid sleep_status.');
    }
  }
  for (const activity of input.activities ?? []) {
    if (!activity.coros_activity_id?.trim()) throw new Error('Every activity needs coros_activity_id.');
    if (!activity.activity_type?.trim()) throw new Error('Every activity needs activity_type.');
    if (activity.activity_date && !/^\d{4}-\d{2}-\d{2}$/.test(activity.activity_date)) throw new Error('activity_date must be YYYY-MM-DD.');
    finiteOrNull(activity.duration_seconds);
    finiteOrNull(activity.distance_km);
    finiteOrNull(activity.jump_count);
    finiteOrNull(activity.calories);
  }
  return input;
}

async function ingestSnapshot(inputValue: unknown) {
  const input = validateSnapshot(inputValue);
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const userId = Deno.env.get('LIFE_OS_USER_ID');
  if (!supabaseUrl || !serviceKey || !userId) throw new Error('The Life OS sync function is missing server configuration.');
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const daily = input.daily ?? {};
  const metricPatch: Record<string, unknown> = {
    user_id: userId,
    metric_date: input.record_date,
    sync_status: input.sync_status,
    latest_run_type: input.run_type,
    last_synced_at: input.captured_at,
    raw_coros_data: input.raw_coros_data ?? {},
  };
  if (input.run_type === 'morning') metricPatch.morning_synced_at = input.captured_at;
  if (input.run_type === 'night') metricPatch.night_synced_at = input.captured_at;
  for (const key of ['steps', 'calories', 'exercise_minutes', 'sleep_duration_minutes', 'sleep_score', 'sleep_status'] as const) {
    if (daily[key] !== undefined) metricPatch[key] = daily[key];
  }

  const { error: metricError } = await supabase.from('coros_daily_metrics')
    .upsert(metricPatch, { onConflict: 'user_id,metric_date' });
  if (metricError) throw metricError;

  const activityRows = (input.activities ?? []).map((activity) => ({
    user_id: userId,
    coros_activity_id: activity.coros_activity_id.trim(),
    activity_date: activity.activity_date ?? input.record_date,
    activity_type: activity.activity_type.trim(),
    started_at: activity.started_at ?? null,
    duration_seconds: activity.duration_seconds ?? null,
    distance_km: activity.distance_km ?? null,
    jump_count: activity.jump_count ?? null,
    calories: activity.calories ?? null,
    raw_coros_data: activity.raw_coros_data ?? {},
  }));
  if (activityRows.length) {
    const { error: activitiesError } = await supabase.from('coros_activities')
      .upsert(activityRows, { onConflict: 'user_id,coros_activity_id' });
    if (activitiesError) throw activitiesError;
  }

  const [{ data: metrics, error: readMetricError }, { data: activities, error: readActivitiesError }, { data: tasks, error: taskError }, { data: existingCompletions, error: completionReadError }] = await Promise.all([
    supabase.from('coros_daily_metrics').select('*').eq('user_id', userId).eq('metric_date', input.record_date).single(),
    supabase.from('coros_activities').select('*').eq('user_id', userId).eq('activity_date', input.record_date),
    supabase.from('tasks').select('id,title,coros_metadata').eq('user_id', userId).eq('task_type', 'daily').eq('area', 'health').not('coros_metadata', 'is', null),
    supabase.from('daily_completions').select('id,task_id,source,is_completed').eq('user_id', userId).eq('completion_date', input.record_date),
  ]);
  if (readMetricError) throw readMetricError;
  if (readActivitiesError) throw readActivitiesError;
  if (taskError) throw taskError;
  if (completionReadError) throw completionReadError;

  const normalizedActivities = activities ?? [];
  const completed: string[] = [];
  const pending: string[] = [];
  for (const task of tasks ?? []) {
    const rule = task.coros_metadata as Record<string, unknown>;
    const metric = typeof rule.metric === 'string' ? rule.metric : '';
    const threshold = Number(rule.threshold);
    const operator = typeof rule.operator === 'string' ? rule.operator : 'gte';
    let actual: number | null = null;
    const unit = typeof rule.unit === 'string' ? rule.unit : '';

    if (metric === 'steps') actual = metrics.steps;
    if (metric === 'sleep_duration_minutes') actual = metrics.sleep_duration_minutes;
    if (metric === 'distance_km') {
      const allowed = ((rule.activity_types as string[] | undefined) ?? []).map((item) => item.toLowerCase());
      actual = normalizedActivities
        .filter((activity) => allowed.includes(String(activity.activity_type).toLowerCase()))
        .reduce<number | null>((best, activity) => Math.max(best ?? 0, Number(activity.distance_km ?? 0)), null);
    }
    if (metric === 'jump_count') {
      const allowed = ((rule.activity_types as string[] | undefined) ?? []).map((item) => item.toLowerCase());
      actual = normalizedActivities
        .filter((activity) => allowed.includes(String(activity.activity_type).toLowerCase()))
        .reduce<number | null>((best, activity) => Math.max(best ?? 0, Number(activity.jump_count ?? 0)), null);
    }

    const qualifies = actual !== null && Number.isFinite(actual) && (operator === 'gt' ? actual > threshold : actual >= threshold);
    if (qualifies) {
      const completion = {
        user_id: userId,
        task_id: task.id,
        completion_date: input.record_date,
        is_completed: true,
        source: 'coros',
        completed_at: input.captured_at,
        actual_value: actual,
        actual_unit: unit,
        verified_at: input.captured_at,
      };
      const { error: completionError } = await supabase.from('daily_completions')
        .upsert(completion, { onConflict: 'task_id,completion_date' });
      if (completionError) throw completionError;
      completed.push(task.title);
    } else {
      const previous = (existingCompletions ?? []).find((completion) => completion.task_id === task.id);
      if (previous?.source === 'coros' && previous.is_completed) {
        const { error: correctionError } = await supabase.from('daily_completions').update({
          is_completed: false,
          completed_at: null,
          actual_value: actual,
          actual_unit: unit,
          verified_at: input.captured_at,
        }).eq('id', previous.id);
        if (correctionError) throw correctionError;
      }
      pending.push(task.title);
    }
  }

  return {
    saved: true,
    record_date: input.record_date,
    run_type: input.run_type,
    completed_tasks: completed,
    pending_tasks: pending,
    activities_saved: activityRows.length,
    synced_at: input.captured_at,
  };
}

function mcpToolDefinition() {
  return {
    name: 'upsert_coros_daily_snapshot',
    description: 'Save one COROS daily snapshot to Life OS, store activity facts, and automatically evaluate the four COROS-linked daily commitments.',
    annotations: {
      title: 'Save COROS snapshot to Life OS',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['schema_version', 'record_date', 'timezone', 'run_type', 'captured_at', 'sync_status'],
      properties: {
        schema_version: { type: 'integer', const: 1 },
        record_date: { type: 'string', description: 'Asia/Kolkata date in YYYY-MM-DD format.' },
        timezone: { type: 'string', const: 'Asia/Kolkata' },
        run_type: { type: 'string', enum: ['morning', 'night', 'manual', 'reconciliation'] },
        captured_at: { type: 'string', description: 'ISO 8601 timestamp with offset.' },
        sync_status: { type: 'string', enum: ['complete', 'partial', 'missing', 'error'] },
        daily: {
          type: 'object', additionalProperties: false, properties: {
            steps: { type: ['number', 'null'], minimum: 0 },
            calories: { type: ['number', 'null'], minimum: 0 },
            exercise_minutes: { type: ['number', 'null'], minimum: 0 },
            sleep_duration_minutes: { type: ['number', 'null'], minimum: 0 },
            sleep_score: { type: ['number', 'null'], minimum: 0, maximum: 100 },
            sleep_status: { type: 'string', enum: ['complete', 'partial', 'missing', 'not_synced', 'not_checked'] },
          },
        },
        activities: {
          type: 'array', items: {
            type: 'object', additionalProperties: false,
            required: ['coros_activity_id', 'activity_type'],
            properties: {
              coros_activity_id: { type: 'string' }, activity_type: { type: 'string' },
              activity_date: { type: ['string', 'null'] }, started_at: { type: ['string', 'null'] },
              duration_seconds: { type: ['number', 'null'], minimum: 0 }, distance_km: { type: ['number', 'null'], minimum: 0 },
              jump_count: { type: ['number', 'null'], minimum: 0 }, calories: { type: ['number', 'null'], minimum: 0 },
              raw_coros_data: { type: ['object', 'null'] },
            },
          },
        },
        raw_coros_data: { type: ['object', 'null'] },
      },
    },
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  const expectedToken = Deno.env.get('LIFE_OS_COROS_SYNC_TOKEN');
  const suppliedToken = new URL(request.url).searchParams.get('token')
    ?? request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!expectedToken || suppliedToken !== expectedToken) return json({ error: 'Unauthorized' }, 401);

  if (request.method === 'GET') return json({ name: 'Life OS Sync MCP', status: 'ready' });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let message: { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
  try { message = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const id = message.id ?? null;
  const result = (value: unknown) => json({ jsonrpc: '2.0', id, result: value });
  const failure = (code: number, text: string) => json({ jsonrpc: '2.0', id, error: { code, message: text } });

  try {
    if (message.method === 'initialize') return result({
      protocolVersion: '2025-06-18',
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'life-os-sync', version: '1.0.0' },
      instructions: 'Use upsert_coros_daily_snapshot after reading COROS data. Never claim Life OS was updated unless this tool returns saved=true.',
    });
    if (message.method === 'notifications/initialized') return new Response(null, { status: 202, headers: corsHeaders });
    if (message.method === 'ping') return result({});
    if (message.method === 'tools/list') return result({ tools: [mcpToolDefinition()] });
    if (message.method === 'tools/call') {
      if (message.params?.name !== 'upsert_coros_daily_snapshot') return failure(-32601, 'Unknown tool.');
      const saved = await ingestSnapshot(message.params.arguments);
      return result({ content: [{ type: 'text', text: JSON.stringify(saved) }], structuredContent: saved });
    }
    return failure(-32601, 'Method not found.');
  } catch (error) {
    const messageText = error instanceof Error ? error.message : 'Unknown Life OS sync error.';
    return result({ content: [{ type: 'text', text: `Life OS sync failed: ${messageText}` }], isError: true });
  }
});
