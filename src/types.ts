export type Area = 'today' | 'health' | 'personal' | 'work' | 'projects';
export type TaskType = 'daily' | 'one_time' | 'project_subtask';
export type TaskStatus = 'open' | 'completed' | 'archived';

export interface Task {
  id: string;
  user_id: string;
  title: string;
  task_type: TaskType;
  area: Area;
  project_id: string | null;
  status: TaskStatus;
  priority: 'low' | 'normal' | 'high';
  sort_order: number;
  coros_metadata: Record<string, unknown> | null;
  completed_at: string | null;
  created_at: string;
}

export interface DailyCompletion {
  id: string;
  user_id: string;
  task_id: string;
  completion_date: string;
  is_completed: boolean;
  source: 'manual' | 'coros' | 'system';
  completed_at: string | null;
  actual_value?: number | null;
  actual_unit?: string | null;
  verified_at?: string | null;
}

export interface CorosDailyMetric {
  id: string;
  user_id: string;
  metric_date: string;
  steps: number | null;
  calories: number | null;
  exercise_minutes: number | null;
  sleep_duration_minutes: number | null;
  sleep_score: number | null;
  sleep_status: 'complete' | 'partial' | 'missing' | 'not_synced' | 'not_checked';
  sync_status: 'complete' | 'partial' | 'missing' | 'error';
  latest_run_type: 'morning' | 'night' | 'manual' | 'reconciliation';
  morning_synced_at: string | null;
  night_synced_at: string | null;
  last_synced_at: string;
}

export interface CorosActivity {
  id: string;
  user_id: string;
  coros_activity_id: string;
  activity_date: string;
  activity_type: string;
  started_at: string | null;
  duration_seconds: number | null;
  distance_km: number | null;
  jump_count: number | null;
  calories: number | null;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  archived_at: string | null;
}

export interface WeightEntry {
  id: string;
  user_id: string;
  entry_date: string;
  weight_kg: number;
  source: 'manual' | 'coros';
  created_at: string;
}

export interface FocusSession {
  id: string;
  user_id: string;
  task_id: string | null;
  mode: string;
  planned_work_minutes: number;
  planned_break_minutes: number;
  actual_seconds: number;
  started_at: string;
  completed_at: string | null;
  status: 'completed' | 'cancelled';
}

export interface UserSettings {
  user_id: string;
  display_name: string | null;
  timezone: string;
  height_cm: number;
  weight_goal_kg: number;
  weight_goal_date: string;
}

export interface LifeData {
  tasks: Task[];
  completions: DailyCompletion[];
  projects: Project[];
  weights: WeightEntry[];
  focusSessions: FocusSession[];
  corosMetrics: CorosDailyMetric[];
  corosActivities: CorosActivity[];
  settings: UserSettings;
}
