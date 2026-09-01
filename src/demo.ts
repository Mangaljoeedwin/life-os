import type { LifeData, Project, Task } from './types';

const now = new Date().toISOString();
const userId = 'demo-user';
const dayKey = (offset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

export const demoProjects: Project[] = [
  { id: 'project-imaginarium', user_id: userId, name: 'OGs Imaginarium', description: 'Build the plan and bring the right people together.', sort_order: 0, archived_at: null },
  { id: 'project-aquascaping', user_id: userId, name: 'Aquascaping', description: 'Create a calmer, healthier aquarium setup.', sort_order: 1, archived_at: null },
  { id: 'project-mural', user_id: userId, name: 'Draw A Mural', description: 'Make steady creative progress.', sort_order: 2, archived_at: null },
];

const task = (id: string, title: string, taskType: Task['task_type'], area: Task['area'], order: number, projectId: string | null = null, coros: Record<string, unknown> | null = null): Task => ({
  id, user_id: userId, title, task_type: taskType, area, project_id: projectId, status: 'open', priority: 'normal', sort_order: order, coros_metadata: coros, completed_at: null, created_at: now,
});

export const makeDemoData = (): LifeData => ({
  tasks: [
    task('wake', 'Wake up by 6:30 am', 'daily', 'health', 0),
    task('physio', 'Do neck and shoulder physio', 'daily', 'health', 1),
    task('gym', 'Go to gym', 'daily', 'health', 2),
    task('walk', '5km daily walk', 'daily', 'health', 3, null, { provider: 'coros', rule: 'single_activity', metric: 'distance_km', activity_types: ['walk', 'run'], operator: 'gte', threshold: 5, unit: 'km' }),
    task('steps', '10,000 steps a day', 'daily', 'health', 4, null, { provider: 'coros', rule: 'daily_total', metric: 'steps', operator: 'gte', threshold: 10000, unit: 'steps' }),
    task('skips', '1000 skips a day', 'daily', 'health', 5, null, { provider: 'coros', rule: 'single_activity', metric: 'jump_count', activity_types: ['jump rope'], operator: 'gte', threshold: 1000, unit: 'jumps' }),
    task('sleep', 'Sleep Duration >7hrs 30mins', 'daily', 'health', 6, null, { provider: 'coros', rule: 'daily_total', metric: 'sleep_duration_minutes', operator: 'gt', threshold: 450, unit: 'minutes' }),
    task('tea', 'No milk tea + no sugar in tea', 'daily', 'health', 7),
    task('gail', 'GAIL gas pipeline', 'one_time', 'personal', 10),
    task('electricity', 'Electricity name change', 'one_time', 'personal', 11),
    task('interview', 'Interview prep', 'one_time', 'work', 20),
    task('job', 'Job hunt', 'one_time', 'work', 21),
    task('nithin', 'Call Nithin', 'project_subtask', 'projects', 30, 'project-imaginarium'),
    task('unni', 'Call Unni', 'project_subtask', 'projects', 31, 'project-imaginarium'),
    task('plan', 'Setup the plan', 'project_subtask', 'projects', 32, 'project-imaginarium'),
    task('lofi', 'Lofi track', 'project_subtask', 'projects', 40, 'project-aquascaping'),
    task('aquarium', 'Set new aquarium', 'project_subtask', 'projects', 41, 'project-aquascaping'),
    task('shrimp', 'Set new shrimp tank', 'project_subtask', 'projects', 42, 'project-aquascaping'),
    task('draw', 'Draw 1 hr daily', 'daily', 'projects', 50, 'project-mural'),
  ],
  completions: [
    { id: 'c1', user_id: userId, task_id: 'wake', completion_date: dayKey(), is_completed: true, source: 'manual', completed_at: now },
    { id: 'c2', user_id: userId, task_id: 'physio', completion_date: dayKey(-1), is_completed: true, source: 'manual', completed_at: now },
    { id: 'c3', user_id: userId, task_id: 'walk', completion_date: dayKey(-1), is_completed: true, source: 'coros', completed_at: now },
    { id: 'c4', user_id: userId, task_id: 'wake', completion_date: dayKey(-2), is_completed: true, source: 'manual', completed_at: now },
  ],
  projects: demoProjects,
  weights: [
    { id: 'w1', user_id: userId, entry_date: dayKey(-14), weight_kg: 99.6, source: 'manual', created_at: now },
    { id: 'w2', user_id: userId, entry_date: dayKey(-7), weight_kg: 99.1, source: 'manual', created_at: now },
    { id: 'w3', user_id: userId, entry_date: dayKey(), weight_kg: 98.8, source: 'manual', created_at: now },
  ],
  focusSessions: [],
  corosMetrics: [{
    id: 'metric-today', user_id: userId, metric_date: dayKey(), steps: 6842, calories: 514,
    exercise_minutes: 48, sleep_duration_minutes: 467, sleep_score: 81, sleep_status: 'complete',
    sync_status: 'complete', latest_run_type: 'morning', morning_synced_at: now,
    night_synced_at: null, last_synced_at: now,
  }],
  corosActivities: [
    { id: 'activity-walk', user_id: userId, coros_activity_id: 'demo-walk', activity_date: dayKey(), activity_type: 'Walk', started_at: now, duration_seconds: 3020, distance_km: 4.2, jump_count: null, calories: 260 },
    { id: 'activity-skips', user_id: userId, coros_activity_id: 'demo-skips', activity_date: dayKey(), activity_type: 'Jump Rope', started_at: now, duration_seconds: 760, distance_km: null, jump_count: 1120, calories: 120 },
  ],
  settings: { user_id: userId, display_name: 'Mangal', timezone: 'Asia/Kolkata', height_cm: 178, weight_goal_kg: 88, weight_goal_date: '2026-12-25' },
});
