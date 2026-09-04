import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  Archive,
  Activity,
  ArrowDown,
  ArrowUp,
  BarChart3,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  CalendarDays,
  ChevronRight,
  Clock3,
  Cloud,
  Dumbbell,
  FolderKanban,
  FolderPlus,
  Flame,
  GripVertical,
  HeartPulse,
  Home,
  LogOut,
  Menu,
  MoreHorizontal,
  Music2,
  Moon,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Scale,
  Sparkles,
  TimerReset,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { makeDemoData } from './demo';
import { hasSupabaseConfig, supabase } from './supabase';
import type { Area, CorosActivity, CorosDailyMetric, DailyCompletion, FocusSession, LifeData, Project, Task, TaskType, WeightEntry } from './types';

type Tab = 'today' | 'health' | 'personal' | 'work' | 'projects' | 'focus' | 'body';
type TaskPriority = Task['priority'];
type TaskDraft = {
  title: string;
  task_type: TaskType;
  area: Area;
  project_id: string | null;
  priority: TaskPriority;
  due_date: string | null;
};
const tabs: { id: Tab; label: string; short: string; icon: typeof Home }[] = [
  { id: 'today', label: 'Today', short: 'Today', icon: Sparkles },
  { id: 'health', label: 'Health', short: 'Health', icon: HeartPulse },
  { id: 'personal', label: 'Personal / Home', short: 'Home', icon: Home },
  { id: 'work', label: 'Work Life', short: 'Work', icon: BriefcaseBusiness },
  { id: 'projects', label: 'Other Big Projects', short: 'Projects', icon: FolderKanban },
  { id: 'focus', label: 'Focus', short: 'Focus', icon: Clock3 },
  { id: 'body', label: 'Body Stats', short: 'Body', icon: Scale },
];

const todayIn = (timeZone: string) => new Date().toLocaleDateString('en-CA', { timeZone });
const dateIn = (value: string, timeZone: string) => new Date(value).toLocaleDateString('en-CA', { timeZone });
const prettyToday = (timeZone: string) => new Intl.DateTimeFormat('en-IN', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone,
}).format(new Date());
const uid = () => crypto.randomUUID();
const greetingTemplates = [
  (name: string) => `How are we doing today${name ? `, ${name}` : ''}?`,
  (name: string) => `Welcome back${name ? `, ${name}` : ''}. What matters today?`,
  (name: string) => `What deserves your attention today${name ? `, ${name}` : ''}?`,
  (name: string) => `Ready for the next right thing${name ? `, ${name}` : ''}?`,
  (name: string) => name ? `${name}, what would make today count?` : 'What would make today count?',
];

function AuthScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage('');
    const result = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: {
          emailRedirectTo: window.location.href.split('#')[0],
          data: { display_name: name.trim() },
        } });
    setBusy(false);
    if (result.error) setMessage(result.error.message);
    else if (mode === 'signup' && !result.data.session) setMessage('Check your email to confirm your Life OS account.');
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-mark"><img src="./life-os-avatar.png" alt="" /></div>
        <p className="eyebrow">Your personal operating system</p>
        <h1>Life OS</h1>
        <p className="auth-copy">One calm place for your daily commitments, projects, health and focused work — synced across every screen.</p>
        <form onSubmit={submit} className="auth-form">
          {mode === 'signup' && <label>What should we call you?<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mangal" maxLength={60} required /></label>}
          <label>Email<Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required /></label>
          <label>Password<Input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" required /></label>
          <Button type="submit" className="primary-button" disabled={busy}>{busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : 'Create account'}</Button>
        </form>
        {message && <p className="form-message">{message}</p>}
        <button className="text-button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(''); }}>
          {mode === 'signin' ? 'New here? Create your account' : 'Already have an account? Sign in'}
        </button>
        <div className="auth-trust"><Cloud size={16} /> Private data, protected by Supabase</div>
      </section>
    </main>
  );
}

function LoadingScreen() {
  return <main className="loading-page"><RefreshCw className="spin" /><p>Opening your Life OS…</p></main>;
}

function readableDataError(message: string) {
  const normalized = message.toLowerCase();
  if (
    normalized.includes('focus_music_url') ||
    normalized.includes('phase_started_at') ||
    normalized.includes('phase_ends_at') ||
    normalized.includes('paused_seconds') ||
    normalized.includes('music_url') ||
    normalized.includes('invalid input value for enum focus_status')
  ) {
    return 'Focus setup is not finished in Supabase. Run the complete focus-mode-migration.sql file in Supabase → SQL Editor, then try again.';
  }
  return message;
}

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!hasSupabaseConfig);
  const [data, setData] = useState<LifeData>(() => makeDemoData());
  const [loading, setLoading] = useState(hasSupabaseConfig);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('today');
  const [menuOpen, setMenuOpen] = useState(false);
  const [focusSetupTask, setFocusSetupTask] = useState<Task | null>(null);
  const [greetingIndex, setGreetingIndex] = useState(() => Math.floor(Math.random() * greetingTemplates.length));

  const loadData = useCallback(async (showLoadingScreen = false) => {
    if (!supabase || !session?.user.id) return;
    if (showLoadingScreen) setLoading(true);
    const [tasks, completions, projects, weights, sessions, settings, corosMetrics, corosActivities] = await Promise.all([
      supabase.from('tasks').select('*').order('sort_order'),
      supabase.from('daily_completions').select('*').order('completion_date', { ascending: false }),
      supabase.from('projects').select('*').order('sort_order'),
      supabase.from('weight_entries').select('*').order('entry_date'),
      supabase.from('focus_sessions').select('*').order('started_at', { ascending: false }).limit(50),
      supabase.from('user_settings').select('*').single(),
      supabase.from('coros_daily_metrics').select('*').order('metric_date', { ascending: false }).limit(31),
      supabase.from('coros_activities').select('*').order('started_at', { ascending: false }).limit(100),
    ]);
    const failure = [tasks, completions, projects, weights, sessions, settings, corosMetrics, corosActivities].find((result) => result.error);
    if (failure?.error) setError(readableDataError(failure.error.message));
    else {
      setData({
        tasks: (tasks.data ?? []) as Task[],
        completions: completions.data ?? [],
        projects: (projects.data ?? []) as Project[],
        weights: (weights.data ?? []) as WeightEntry[],
        focusSessions: (sessions.data ?? []) as FocusSession[],
        corosMetrics: (corosMetrics.data ?? []) as CorosDailyMetric[],
        corosActivities: (corosActivities.data ?? []) as CorosActivity[],
        settings: settings.data,
      });
    }
    if (showLoadingScreen) setLoading(false);
  }, [session?.user.id]);

  const refreshData = useCallback(() => { void loadData(); }, [loadData]);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data: auth }) => { setSession(auth.session); setAuthReady(true); });
    const { data: listener } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'SIGNED_IN') setGreetingIndex((current) => (current + 1) % greetingTemplates.length);
      setSession(next);
      setAuthReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => { if (session) void loadData(true); }, [session, loadData]);

  useEffect(() => {
    if (!supabase || !session) return;
    const client = supabase;
    const channel = client.channel(`life-os-${session.user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${session.user.id}` }, refreshData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_completions', filter: `user_id=eq.${session.user.id}` }, refreshData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `user_id=eq.${session.user.id}` }, refreshData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'weight_entries', filter: `user_id=eq.${session.user.id}` }, refreshData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'focus_sessions', filter: `user_id=eq.${session.user.id}` }, refreshData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coros_daily_metrics', filter: `user_id=eq.${session.user.id}` }, refreshData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coros_activities', filter: `user_id=eq.${session.user.id}` }, refreshData)
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [session, refreshData]);

  const userId = session?.user.id ?? 'demo-user';
  const day = todayIn(data.settings.timezone);

  async function toggleTask(task: Task) {
    if (task.task_type === 'daily') {
      const existing = data.completions.find((item) => item.task_id === task.id && item.completion_date === day);
      const next = !existing?.is_completed;
      const completion = {
        id: existing?.id ?? uid(), user_id: userId, task_id: task.id, completion_date: day,
        is_completed: next, source: 'manual' as const, completed_at: next ? new Date().toISOString() : null,
      };
      setData((current) => ({ ...current, completions: existing
        ? current.completions.map((item) => item.id === existing.id ? completion : item)
        : [completion, ...current.completions] }));
      if (supabase) {
        const { error: saveError } = await supabase.from('daily_completions').upsert(completion, { onConflict: 'task_id,completion_date' });
        if (saveError) { setError(saveError.message); void loadData(); }
      }
    } else {
      const isDone = task.status === 'completed';
      const patch = { status: isDone ? 'open' : 'completed', completed_at: isDone ? null : new Date().toISOString() };
      setData((current) => ({ ...current, tasks: current.tasks.map((item) => item.id === task.id ? { ...item, ...patch } as Task : item) }));
      if (supabase) {
        const { error: saveError } = await supabase.from('tasks').update(patch).eq('id', task.id);
        if (saveError) { setError(saveError.message); void loadData(); }
      }
    }
  }

  async function addTask(title: string, taskType: TaskType, area: Area, projectId: string | null = null, priority: TaskPriority = 'normal', dueDate: string | null = null) {
    const newTask: Task = {
      id: uid(), user_id: userId, title, task_type: taskType, area, project_id: projectId,
      status: 'open', priority, sort_order: data.tasks.length + 1, due_date: dueDate, coros_metadata: null,
      completed_at: null, created_at: new Date().toISOString(),
    };
    setData((current) => ({ ...current, tasks: [...current.tasks, newTask] }));
    if (supabase) {
      const { error: saveError } = await supabase.from('tasks').insert(newTask);
      if (saveError) { setError(saveError.message); void loadData(); }
    }
  }

  async function updateTask(taskId: string, patch: Partial<TaskDraft>) {
    setData((current) => ({ ...current, tasks: current.tasks.map((item) => item.id === taskId ? { ...item, ...patch } as Task : item) }));
    if (supabase) {
      const { error: saveError } = await supabase.from('tasks').update(patch).eq('id', taskId);
      if (saveError) { setError(saveError.message); void loadData(); }
    }
  }

  async function deleteTask(task: Task) {
    if (!window.confirm(`Delete “${task.title}”? This will also remove its saved completion history.`)) return;
    setData((current) => ({
      ...current,
      tasks: current.tasks.filter((item) => item.id !== task.id),
      completions: current.completions.filter((item) => item.task_id !== task.id),
    }));
    if (supabase) {
      const { error: saveError } = await supabase.from('tasks').delete().eq('id', task.id);
      if (saveError) { setError(saveError.message); void loadData(); }
    }
  }

  async function reorderTasks(orderedTaskIds: string[]) {
    if (orderedTaskIds.length < 2) return;
    const order = new Map(orderedTaskIds.map((id, index) => [id, index]));
    setData((current) => ({
      ...current,
      tasks: current.tasks
        .map((item) => order.has(item.id) ? { ...item, sort_order: order.get(item.id)! } : item)
        .sort((a, b) => a.sort_order - b.sort_order),
    }));

    if (supabase) {
      const client = supabase;
      const results = await Promise.all(orderedTaskIds.map((id, index) => client.from('tasks').update({ sort_order: index }).eq('id', id)));
      const saveError = results.find((result) => result.error)?.error;
      if (saveError) { setError(saveError.message); void loadData(); }
    }
  }

  async function addProject(name: string, description: string) {
    const project: Project = {
      id: uid(), user_id: userId, name, description: description || null,
      sort_order: data.projects.length, completed_at: null, archived_at: null,
    };
    setData((current) => ({ ...current, projects: [...current.projects, project] }));
    if (supabase) {
      const { error: saveError } = await supabase.from('projects').insert(project);
      if (saveError) { setError(saveError.message); void loadData(); }
    }
  }

  async function updateProject(projectId: string, patch: Partial<Pick<Project, 'name' | 'description' | 'completed_at' | 'archived_at'>>) {
    setData((current) => ({ ...current, projects: current.projects.map((item) => item.id === projectId ? { ...item, ...patch } : item) }));
    if (supabase) {
      const { error: saveError } = await supabase.from('projects').update(patch).eq('id', projectId);
      if (saveError) { setError(saveError.message); void loadData(); }
    }
  }

  async function addWeight(weight: number) {
    const existing = data.weights.find((entry) => entry.entry_date === day);
    const entry: WeightEntry = { id: existing?.id ?? uid(), user_id: userId, entry_date: day, weight_kg: weight, source: 'manual', created_at: existing?.created_at ?? new Date().toISOString() };
    setData((current) => ({ ...current, weights: existing ? current.weights.map((item) => item.id === existing.id ? entry : item) : [...current.weights, entry] }));
    if (supabase) {
      const { error: saveError } = await supabase.from('weight_entries').upsert(entry, { onConflict: 'user_id,entry_date' });
      if (saveError) { setError(saveError.message); void loadData(); }
    }
  }

  async function startFocusSession(taskId: string | null, modeIndex: number, musicUrl: string | null) {
    const existing = data.focusSessions.find((item) => ['running', 'paused', 'awaiting_outcome'].includes(item.status));
    if (existing) { setFocusSetupTask(null); setTab('focus'); return true; }
    const mode = focusModes[modeIndex] ?? focusModes[0];
    const started = new Date();
    const record: FocusSession = {
      id: uid(), user_id: userId, task_id: taskId, mode: mode.label,
      planned_work_minutes: mode.work, planned_break_minutes: mode.break, actual_seconds: 0,
      started_at: started.toISOString(), completed_at: null, status: 'running', phase: 'work',
      phase_started_at: started.toISOString(), phase_ends_at: new Date(started.getTime() + mode.work * 60000).toISOString(),
      paused_seconds: null, music_url: musicUrl,
    };
    if (supabase) {
      const { error: saveError } = await supabase.from('focus_sessions').insert(record);
      if (saveError) { setError(readableDataError(saveError.message)); return false; }
    }
    setData((current) => ({ ...current, focusSessions: [record, ...current.focusSessions] }));
    setError('');
    setFocusSetupTask(null);
    setTab('focus');
    return true;
  }

  async function updateFocusSession(sessionId: string, patch: Partial<FocusSession>) {
    setData((current) => ({ ...current, focusSessions: current.focusSessions.map((item) => item.id === sessionId ? { ...item, ...patch } : item) }));
    if (supabase) {
      const { error: saveError } = await supabase.from('focus_sessions').update(patch).eq('id', sessionId);
      if (saveError) { setError(saveError.message); void loadData(); }
    }
  }

  async function saveFocusMusic(url: string | null) {
    if (data.settings.focus_music_url === url) return true;
    setData((current) => ({ ...current, settings: { ...current.settings, focus_music_url: url } }));
    if (supabase) {
      const { error: saveError } = await supabase.from('user_settings').update({ focus_music_url: url }).eq('user_id', userId);
      if (saveError) { setError(readableDataError(saveError.message)); void loadData(); return false; }
    }
    return true;
  }

  async function pauseFocusSession(session: FocusSession) {
    if (session.status !== 'running' || !session.phase_ends_at) return;
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((new Date(session.phase_ends_at).getTime() - now) / 1000));
    const elapsed = session.phase === 'work' && session.phase_started_at
      ? Math.max(0, Math.floor((now - new Date(session.phase_started_at).getTime()) / 1000)) : 0;
    await updateFocusSession(session.id, { status: 'paused', paused_seconds: remaining, phase_ends_at: null, actual_seconds: session.actual_seconds + elapsed });
  }

  async function resumeFocusSession(session: FocusSession) {
    if (session.status !== 'paused') return;
    const now = new Date();
    const remaining = session.paused_seconds ?? 0;
    await updateFocusSession(session.id, { status: 'running', phase_started_at: now.toISOString(), phase_ends_at: new Date(now.getTime() + remaining * 1000).toISOString(), paused_seconds: null });
  }

  async function cancelFocusSession(session: FocusSession) {
    const now = new Date();
    const elapsed = session.status === 'running' && session.phase === 'work' && session.phase_started_at
      ? Math.max(0, Math.floor((now.getTime() - new Date(session.phase_started_at).getTime()) / 1000)) : 0;
    await updateFocusSession(session.id, { status: 'cancelled', actual_seconds: session.actual_seconds + elapsed, completed_at: now.toISOString(), phase_ends_at: null, paused_seconds: null });
  }

  async function resolveFocusSession(session: FocusSession, outcome: 'complete' | 'keep_open' | 'add_time') {
    if (outcome === 'add_time') {
      const now = new Date();
      await updateFocusSession(session.id, { status: 'running', phase: 'work', phase_started_at: now.toISOString(), phase_ends_at: new Date(now.getTime() + 15 * 60000).toISOString(), paused_seconds: null });
      return;
    }
    const task = session.task_id ? data.tasks.find((item) => item.id === session.task_id) : null;
    if (outcome === 'complete' && task && !task.coros_metadata && !isTaskDone(task, data, day)) await toggleTask(task);
    const now = new Date();
    if (session.planned_break_minutes > 0) {
      await updateFocusSession(session.id, { status: 'running', phase: 'break', phase_started_at: now.toISOString(), phase_ends_at: new Date(now.getTime() + session.planned_break_minutes * 60000).toISOString(), paused_seconds: null });
    } else {
      await updateFocusSession(session.id, { status: 'completed', completed_at: now.toISOString(), phase_ends_at: null, paused_seconds: null });
    }
  }

  async function saveDisplayName(name: string) {
    if (!supabase || !session) return;
    const displayName = name.trim();
    if (!displayName) return;
    setData((current) => ({ ...current, settings: { ...current.settings, display_name: displayName } }));
    const [settingsResult, authResult] = await Promise.all([
      supabase.from('user_settings').update({ display_name: displayName }).eq('user_id', session.user.id),
      supabase.auth.updateUser({ data: { display_name: displayName } }),
    ]);
    const saveError = settingsResult.error ?? authResult.error;
    if (saveError) {
      setError(saveError.message);
      void loadData();
    }
  }

  const activeFocus = data.focusSessions.find((item) => ['running', 'paused', 'awaiting_outcome'].includes(item.status)) ?? null;
  useEffect(() => {
    if (!activeFocus || activeFocus.status !== 'running' || !activeFocus.phase_ends_at) return;
    const remainingMs = new Date(activeFocus.phase_ends_at).getTime() - Date.now();
    const timer = window.setTimeout(() => {
      if (activeFocus.phase === 'work') {
        const segmentSeconds = activeFocus.phase_started_at
          ? Math.max(0, Math.round((new Date(activeFocus.phase_ends_at!).getTime() - new Date(activeFocus.phase_started_at).getTime()) / 1000)) : 0;
        void updateFocusSession(activeFocus.id, { status: 'awaiting_outcome', actual_seconds: activeFocus.actual_seconds + segmentSeconds, phase_ends_at: null, paused_seconds: 0 });
      } else {
        void updateFocusSession(activeFocus.id, { status: 'completed', completed_at: new Date().toISOString(), phase_ends_at: null, paused_seconds: null });
      }
    }, Math.max(0, remainingMs) + 100);
    return () => window.clearTimeout(timer);
  }, [activeFocus?.id, activeFocus?.status, activeFocus?.phase, activeFocus?.phase_ends_at]);

  if (!authReady) return <LoadingScreen />;
  if (hasSupabaseConfig && !session) return <AuthScreen />;
  if (loading) return <LoadingScreen />;

  const displayName = data.settings.display_name ?? '';
  const shared = {
    data, day, toggleTask, addTask, updateTask, deleteTask, reorderTasks, addProject, updateProject, addWeight,
    activeFocus, prepareFocus: (task: Task) => { if (activeFocus) setTab('focus'); else setFocusSetupTask(task); },
    openFocus: () => setTab('focus'), startFocusSession, pauseFocusSession, resumeFocusSession,
    cancelFocusSession, resolveFocusSession, saveFocusMusic,
  };
  const needsName = Boolean(session && !session.user.user_metadata?.display_name);
  return (
    <div className="app-shell">
      {needsName && <NamePrompt onSave={saveDisplayName} />}
      {focusSetupTask && <FocusSetup task={focusSetupTask} defaultMusicUrl={data.settings.focus_music_url} onClose={() => setFocusSetupTask(null)} onSaveMusic={saveFocusMusic} onStart={startFocusSession} />}
      <header className="topbar">
        <button className="brand" onClick={() => setTab('today')}><span className="brand-mark"><img src="./life-os-avatar.png" alt="" /></span><span>Life OS</span></button>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {tabs.map((item) => <NavButton key={item.id} item={item} active={tab === item.id} onClick={() => setTab(item.id)} />)}
        </nav>
        <div className="header-actions">
          {!hasSupabaseConfig && <span className="demo-pill">Preview mode</span>}
          {session && <Button variant="ghost" size="icon" aria-label="Sign out" onClick={() => void supabase?.auth.signOut()}><LogOut /></Button>}
          <Button variant="ghost" size="icon" className="menu-button" aria-label="Open menu" onClick={() => setMenuOpen(true)}><Menu /></Button>
        </div>
      </header>

      {menuOpen && <div className="mobile-menu-backdrop" onClick={() => setMenuOpen(false)}><aside className="mobile-menu" onClick={(event) => event.stopPropagation()}>
        <div className="mobile-menu-head"><strong>Life OS</strong><Button variant="ghost" size="icon" onClick={() => setMenuOpen(false)}><X /></Button></div>
        {tabs.map((item) => <NavButton key={item.id} item={item} active={tab === item.id} onClick={() => { setTab(item.id); setMenuOpen(false); }} />)}
      </aside></div>}

      <main className="main-content">
        {error && <div className="error-banner" role="alert"><span>{error}</span><button aria-label="Dismiss message" onClick={() => setError('')}><X size={16} /></button></div>}
        {!hasSupabaseConfig && <div className="setup-banner"><Cloud size={18} /><span>You’re viewing a fully interactive preview. Add your Supabase credentials to turn on private cross-device sync.</span></div>}
        {tab === 'today' && <TodayView {...shared} greeting={greetingTemplates[greetingIndex](displayName)} />}
        {tab === 'health' && <HealthView {...shared} />}
        {tab === 'personal' && <AreaView title="Personal / Home" description="The life-admin details that keep home running smoothly." area="personal" icon={Home} {...shared} />}
        {tab === 'work' && <AreaView title="Work Life" description="Keep the next career move visible and achievable." area="work" icon={BriefcaseBusiness} {...shared} />}
        {tab === 'projects' && <ProjectsView {...shared} />}
        {tab === 'focus' && <FocusView {...shared} />}
        {tab === 'body' && <BodyView {...shared} />}
      </main>

      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {tabs.slice(0, 5).map((item) => <NavButton key={item.id} item={item} active={tab === item.id} onClick={() => setTab(item.id)} compact />)}
        <button className="nav-button compact" onClick={() => setMenuOpen(true)}><Menu /><span>More</span></button>
      </nav>
    </div>
  );
}

function NamePrompt({ onSave }: { onSave: (name: string) => Promise<void> }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  return <div className="name-prompt-backdrop" role="presentation">
    <Card className="name-prompt" role="dialog" aria-modal="true" aria-labelledby="name-prompt-title"><CardContent>
      <div className="brand-mark"><img src="./life-os-avatar.png" alt="" /></div>
      <p className="eyebrow">One last personal touch</p>
      <h2 id="name-prompt-title">What should we call you?</h2>
      <p>This is the name Life OS will use when it welcomes you. You can enter your first name or any name you prefer.</p>
      <form onSubmit={async (event) => { event.preventDefault(); if (!name.trim()) return; setSaving(true); await onSave(name); setSaving(false); }}>
        <label>Your name<Input value={name} onChange={(event) => setName(event.target.value)} placeholder="For example, Mangal" maxLength={60} required /></label>
        <Button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Continue to Life OS'}<ChevronRight /></Button>
      </form>
      <small>We’ll save this privately with your Life OS account.</small>
    </CardContent></Card>
  </div>;
}

function NavButton({ item, active, onClick, compact = false }: { item: typeof tabs[number]; active: boolean; onClick: () => void; compact?: boolean }) {
  const Icon = item.icon;
  return <button className={`nav-button ${active ? 'active' : ''} ${compact ? 'compact' : ''}`} onClick={onClick}><Icon /><span>{compact ? item.short : item.label}</span></button>;
}

type ViewProps = {
  data: LifeData;
  day: string;
  toggleTask: (task: Task) => Promise<void>;
  addTask: (title: string, type: TaskType, area: Area, projectId?: string | null, priority?: TaskPriority, dueDate?: string | null) => Promise<void>;
  updateTask: (taskId: string, patch: Partial<TaskDraft>) => Promise<void>;
  deleteTask: (task: Task) => Promise<void>;
  reorderTasks: (orderedTaskIds: string[]) => Promise<void>;
  addProject: (name: string, description: string) => Promise<void>;
  updateProject: (projectId: string, patch: Partial<Pick<Project, 'name' | 'description' | 'completed_at' | 'archived_at'>>) => Promise<void>;
  addWeight: (weight: number) => Promise<void>;
  activeFocus: FocusSession | null;
  prepareFocus: (task: Task) => void;
  openFocus: () => void;
  startFocusSession: (taskId: string | null, modeIndex: number, musicUrl: string | null) => Promise<boolean>;
  pauseFocusSession: (session: FocusSession) => Promise<void>;
  resumeFocusSession: (session: FocusSession) => Promise<void>;
  cancelFocusSession: (session: FocusSession) => Promise<void>;
  resolveFocusSession: (session: FocusSession, outcome: 'complete' | 'keep_open' | 'add_time') => Promise<void>;
  saveFocusMusic: (url: string | null) => Promise<boolean>;
};

function PageIntro({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy?: string; action?: React.ReactNode }) {
  return <div className="page-intro"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{copy && <p>{copy}</p>}</div>{action}</div>;
}

function isTaskDone(task: Task, data: LifeData, day: string) {
  return task.task_type === 'daily'
    ? Boolean(data.completions.find((item) => item.task_id === task.id && item.completion_date === day)?.is_completed)
    : task.status === 'completed';
}

function TodayView(props: ViewProps & { greeting: string }) {
  const { data, day } = props;
  const activeTasks = data.tasks.filter((task) => task.status !== 'archived');
  const incompleteTasks = activeTasks.filter((task) => !isTaskDone(task, data, day));
  const activeProjectIds = new Set(data.projects.filter((project) => !project.completed_at && !project.archived_at).map((project) => project.id));
  const openDaily = incompleteTasks.filter((task) => task.task_type === 'daily');
  const openOneTime = incompleteTasks.filter((task) => task.task_type === 'one_time');
  const openProjectTasks = incompleteTasks.filter((task) => task.task_type === 'project_subtask' && task.project_id && activeProjectIds.has(task.project_id));
  const open = [...openDaily, ...openOneTime, ...openProjectTasks];
  const doneToday = activeTasks.filter((task) => {
    if (!isTaskDone(task, data, day)) return false;
    if (task.task_type === 'daily') return true;
    return Boolean(task.completed_at && dateIn(task.completed_at, data.settings.timezone) === day);
  });
  const daily = activeTasks.filter((task) => task.task_type === 'daily');
  const dailyDone = daily.filter((task) => isTaskDone(task, data, day)).length;
  return <>
    <PageIntro eyebrow={prettyToday(data.settings.timezone)} title={props.greeting} />
    <section className="summary-grid">
      <SummaryCard label="Today" value={`${open.length} open`} detail={`${doneToday.length} completed`} tone="lavender" icon={Check} />
      <SummaryCard label="Daily completion" value={`${daily.length ? Math.round((dailyDone / daily.length) * 100) : 0}%`} detail={`${dailyDone} of ${daily.length} daily items`} tone="mint" icon={BarChart3} />
      <FocusSummaryCard session={props.activeFocus} tasks={data.tasks} onOpen={props.openFocus} />
      <SummaryCard label="Sync" value={hasSupabaseConfig ? 'Live' : 'Preview'} detail={hasSupabaseConfig ? 'Across your devices' : 'Connect Supabase next'} tone="blue" icon={Cloud} />
    </section>
    <AddTaskForm projects={data.projects} onAdd={props.addTask} />
    <section className="today-layout">
      <Card className="panel task-panel"><SectionHead title="To Do" detail={`${open.length} remaining`} />
        <CardContent className="todo-groups">
          <p className="todo-focus-hint"><Play /> Use the play button beside a task to start a Focus session.</p>
          <ToDoGroup title="Daily’s" note="Starts fresh each day. COROS-linked items update after your scheduled syncs." tasks={openDaily} empty="No daily items waiting." {...props} />
          <ToDoGroup title="One Time" note="Single tasks that stay completed after you finish them." tasks={openOneTime} empty="No one-time tasks waiting." {...props} />
          <ToDoGroup title="Project Tasks" note="Next steps from your active projects." tasks={openProjectTasks} empty="No project tasks waiting." {...props} />
        </CardContent>
      </Card>
      <div className="side-stack">
        <BodyMiniCard data={data} onSave={props.addWeight} />
        <Card className="panel"><SectionHead title="Completed Today" detail={`${doneToday.length} done`} />
          <CardContent><TaskList tasks={doneToday} data={data} day={day} onToggle={props.toggleTask} projects={data.projects} onUpdate={props.updateTask} onDelete={props.deleteTask} compact empty="Nothing completed yet — the first check is the hardest." /></CardContent>
        </Card>
      </div>
    </section>
  </>;
}

function ToDoGroup({ title, note, tasks, empty, ...props }: ViewProps & { title: string; note: string; tasks: Task[]; empty: string }) {
  const [reordering, setReordering] = useState(false);
  return <section className="todo-group">
    <div className="todo-group-head">
      <div><h3>{title}</h3><p>{note}</p></div>
      <div className="todo-group-actions"><span>{tasks.length}</span><button className={`reorder-toggle ${reordering ? 'active' : ''}`} onClick={() => setReordering((current) => !current)} disabled={tasks.length < 2}>{reordering ? 'Done' : 'Reorder'}</button></div>
    </div>
    <TaskList tasks={tasks} data={props.data} day={props.day} onToggle={props.toggleTask} projects={props.data.projects} onUpdate={props.updateTask} onDelete={props.deleteTask} onFocusTask={props.prepareFocus} reordering={reordering} onReorder={props.reorderTasks} empty={empty} />
  </section>;
}

function SummaryCard({ label, value, detail, tone, icon: Icon }: { label: string; value: string; detail: string; tone: string; icon: typeof Check }) {
  return <Card className={`summary-card ${tone}`}><CardContent><span className="summary-icon"><Icon /></span><p>{label}</p><strong>{value}</strong><small>{detail}</small></CardContent></Card>;
}

function focusSecondsLeft(session: FocusSession | null, now: number) {
  if (!session) return 0;
  if (session.status === 'paused') return session.paused_seconds ?? 0;
  if (session.status !== 'running' || !session.phase_ends_at) return 0;
  return Math.max(0, Math.ceil((new Date(session.phase_ends_at).getTime() - now) / 1000));
}

function useFocusSeconds(session: FocusSession | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (session?.status !== 'running') return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [session?.id, session?.status, session?.phase_ends_at]);
  return focusSecondsLeft(session, now);
}

function clockText(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function FocusSummaryCard({ session, tasks, onOpen }: { session: FocusSession | null; tasks: Task[]; onOpen: () => void }) {
  const seconds = useFocusSeconds(session);
  const task = session?.task_id ? tasks.find((item) => item.id === session.task_id) : null;
  const label = session?.status === 'awaiting_outcome' ? 'Session complete' : session?.status === 'paused' ? 'Focus paused' : session?.phase === 'break' ? 'Break timer' : 'Focus timer';
  const value = session ? session.status === 'awaiting_outcome' ? 'Review' : clockText(seconds) : 'Ready';
  const detail = session ? `${task?.title ?? 'Open focus'} · Tap to open` : 'Tap a task to begin';
  return <button type="button" className="focus-summary-button" onClick={onOpen} aria-label="Open Focus timer"><SummaryCard label={label} value={value} detail={detail} tone="peach" icon={Clock3} /></button>;
}

function AddTaskForm({ projects, onAdd }: { projects: Project[]; onAdd: ViewProps['addTask'] }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<TaskType>('daily');
  const [area, setArea] = useState<Area>('today');
  const [projectId, setProjectId] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [dueDate, setDueDate] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    await onAdd(title.trim(), projectId ? 'project_subtask' : type, projectId ? 'projects' : area, projectId || null, priority, dueDate || null);
    setTitle(''); setProjectId(''); setPriority('normal'); setDueDate(''); setOpen(false);
  }
  if (!open) return <button className="add-commitment" onClick={() => setOpen(true)}><span><Plus /></span><div><strong>Add a commitment</strong><small>Daily To Do, one-time task or project step</small></div><ChevronRight /></button>;
  return <Card className="add-form-card"><form onSubmit={submit} className="add-form">
    <div className="form-title"><div><p className="eyebrow">New commitment</p><h2>What needs your attention?</h2></div><Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)}><X /></Button></div>
    <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Call Martin tomorrow" />
    <div className="form-grid task-fields">
      <label>Behavior<select value={type} onChange={(event) => setType(event.target.value as TaskType)} disabled={Boolean(projectId)}><option value="daily">Daily To Do</option><option value="one_time">One-time</option></select></label>
      <label>Category<select value={area} onChange={(event) => setArea(event.target.value as Area)} disabled={Boolean(projectId)}><option value="today">Today</option><option value="health">Health</option><option value="personal">Personal / Home</option><option value="work">Work Life</option></select></label>
      <label>Project (optional)<select value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">No project</option>{projects.filter((project) => !project.archived_at).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
      <label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label>
      <label>Due date<Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
    </div>
    <div className="form-actions"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" className="primary-button"><Plus /> Add commitment</Button></div>
  </form></Card>;
}

function SectionHead({ title, detail, action }: { title: string; detail?: string; action?: React.ReactNode }) {
  return <div className="section-head"><h2>{title}</h2><div className="section-head-actions">{detail && <span>{detail}</span>}{action}</div></div>;
}

type TaskListProps = {
  tasks: Task[];
  data: LifeData;
  day: string;
  onToggle: (task: Task) => Promise<void>;
  projects: Project[];
  onUpdate: ViewProps['updateTask'];
  onDelete: ViewProps['deleteTask'];
  onFocusTask?: ViewProps['prepareFocus'];
  compact?: boolean;
  empty?: string;
  reordering?: boolean;
  onReorder?: ViewProps['reorderTasks'];
};

function moveId(ids: string[], taskId: string, targetIndex: number) {
  const from = ids.indexOf(taskId);
  if (from < 0 || targetIndex < 0 || targetIndex >= ids.length || from === targetIndex) return ids;
  const next = [...ids];
  next.splice(from, 1);
  next.splice(targetIndex, 0, taskId);
  return next;
}

function TaskList({ tasks, data, day, onToggle, projects, onUpdate, onDelete, onFocusTask, compact = false, empty = 'No tasks here yet.', reordering = false, onReorder }: TaskListProps) {
  const [editing, setEditing] = useState<Task | null>(null);
  const [orderedIds, setOrderedIds] = useState(() => tasks.map((task) => task.id));
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const taskKey = tasks.map((task) => task.id).join('|');
  useEffect(() => { if (!draggedId) setOrderedIds(tasks.map((task) => task.id)); }, [taskKey, draggedId, tasks]);
  const orderedTasks = orderedIds.map((id) => tasks.find((task) => task.id === id)).filter((task): task is Task => Boolean(task));

  function finishReorder() {
    if (draggedId && onReorder) void onReorder(orderedIds);
    setDraggedId(null);
  }

  if (!tasks.length) return <div className="empty-state"><Check /><p>{empty}</p></div>;
  return <>
    <div className={`task-list ${compact ? 'compact' : ''} ${draggedId ? 'is-dragging' : ''}`}>{orderedTasks.map((task, index) => {
      const done = isTaskDone(task, data, day);
      const synced = Boolean(task.coros_metadata);
      const completion = completionFor(task, data, day);
      const progress = synced ? corosProgress(task, data, day) : null;
      const overdue = Boolean(task.due_date && task.due_date < day && !done);
      const project = task.project_id ? projects.find((item) => item.id === task.project_id) : null;
      return <div
        className={`task-row ${done ? 'done' : ''} ${reordering ? 'reordering' : ''} ${draggedId === task.id ? 'dragging' : ''}`}
        data-task-id={task.id}
        key={task.id}
      >
        {reordering ? <button
          type="button"
          className="reorder-grip"
          aria-label={`Drag ${task.title} to reorder`}
          onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setDraggedId(task.id); }}
          onPointerMove={(event) => {
            if (!draggedId) return;
            const row = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-task-id]');
            if (!row?.dataset.taskId) return;
            const target = orderedIds.indexOf(row.dataset.taskId);
            setOrderedIds((current) => moveId(current, draggedId, target));
          }}
          onPointerUp={finishReorder}
          onPointerCancel={finishReorder}
        ><GripVertical /></button> : <button className="check-button" aria-label={`${done ? 'Reopen' : 'Complete'} ${task.title}`} onClick={() => void onToggle(task)}>{done && <Check />}</button>}
        <div className="task-copy"><strong>{task.title}</strong><div className="task-meta">
          <span>{task.task_type === 'daily' ? 'Daily To Do' : task.task_type === 'project_subtask' ? 'Project task' : done ? 'Completed' : 'One-time'}</span>
          {project && <span>{project.name}</span>}
          {task.priority !== 'normal' && <span className={`priority-tag ${task.priority}`}>{task.priority} priority</span>}
          {task.due_date && <span className={`due-tag ${overdue ? 'overdue' : ''}`}><CalendarDays /> {task.due_date === day ? 'Due today' : task.due_date}</span>}
          {synced && <span className={`sync-tag ${completion?.source === 'coros' ? 'verified' : ''}`}><RefreshCw /> {completion?.source === 'coros' ? 'COROS verified' : progress}</span>}
        </div></div>
        <div className="task-row-actions">
          {reordering && onReorder ? <div className="reorder-controls"><button disabled={index === 0} aria-label={`Move ${task.title} up`} onClick={() => { const next = moveId(orderedIds, task.id, index - 1); setOrderedIds(next); void onReorder(next); }}><ArrowUp /></button><button disabled={index === orderedTasks.length - 1} aria-label={`Move ${task.title} down`} onClick={() => { const next = moveId(orderedIds, task.id, index + 1); setOrderedIds(next); void onReorder(next); }}><ArrowDown /></button></div> : <>
            {task.task_type !== 'daily' && done && <Archive className="archive-icon" />}
            {onFocusTask && !done && <button type="button" className="task-menu-button task-focus-button" aria-label={`Start a Focus session for ${task.title}`} title="Start Focus" onClick={() => onFocusTask(task)}><Play /></button>}
            <button type="button" className="task-menu-button" aria-label={`Edit ${task.title}`} onClick={() => setEditing(task)}><MoreHorizontal /></button>
          </>}
        </div>
      </div>;
    })}</div>
    {editing && <TaskEditor task={editing} projects={projects} onClose={() => setEditing(null)} onSave={async (patch) => { await onUpdate(editing.id, patch); setEditing(null); }} onDelete={async () => { await onDelete(editing); setEditing(null); }} />}
  </>;
}

function TaskEditor({ task, projects, onClose, onSave, onDelete }: { task: Task; projects: Project[]; onClose: () => void; onSave: (patch: Partial<TaskDraft>) => Promise<void>; onDelete: () => Promise<void> }) {
  const [title, setTitle] = useState(task.title);
  const [behavior, setBehavior] = useState<TaskType>(task.task_type === 'project_subtask' ? 'one_time' : task.task_type);
  const [destination, setDestination] = useState(task.project_id ? `project:${task.project_id}` : `area:${task.area}`);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [dueDate, setDueDate] = useState(task.due_date ?? '');
  const [saving, setSaving] = useState(false);
  const isProject = destination.startsWith('project:');
  const isCoros = Boolean(task.coros_metadata);
  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <Card className="editor-dialog" role="dialog" aria-modal="true" aria-labelledby={`edit-${task.id}`}><form onSubmit={async (event) => {
      event.preventDefault();
      if (!title.trim()) return;
      setSaving(true);
      const projectId = isProject ? destination.slice('project:'.length) : null;
      const area = isProject ? 'projects' : destination.slice('area:'.length) as Area;
      await onSave({ title: title.trim(), task_type: isProject ? 'project_subtask' : isCoros ? 'daily' : behavior, area, project_id: projectId, priority, due_date: dueDate || null });
      setSaving(false);
    }}>
      <div className="dialog-head"><div><p className="eyebrow">Task controls</p><h2 id={`edit-${task.id}`}>Edit commitment</h2></div><Button type="button" variant="ghost" size="icon" onClick={onClose}><X /></Button></div>
      <label>Task name<Input value={title} maxLength={300} onChange={(event) => setTitle(event.target.value)} autoFocus required /></label>
      <div className="editor-grid">
        <label>Move to<select value={destination} onChange={(event) => setDestination(event.target.value)}>
          <option value="area:today">Today</option><option value="area:health">Health</option><option value="area:personal">Personal / Home</option><option value="area:work">Work Life</option>
          {projects.filter((project) => !project.archived_at).map((project) => <option value={`project:${project.id}`} key={project.id}>Project · {project.name}</option>)}
        </select></label>
        <label>Behavior<select value={isProject ? 'project_subtask' : behavior} disabled={isProject || isCoros} onChange={(event) => setBehavior(event.target.value as TaskType)}><option value="daily">Daily To Do</option><option value="one_time">One-time</option>{isProject && <option value="project_subtask">Project task</option>}</select></label>
        <label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label>
        <label>Due date<Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
      </div>
      {isCoros && <p className="dialog-note">This is a COROS-linked daily task. Its health rule will stay connected when you rename or move it.</p>}
      <div className="dialog-actions"><Button type="button" variant="ghost" className="danger-button" onClick={() => void onDelete()}><Trash2 /> Delete</Button><span /><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button></div>
    </form></Card>
  </div>;
}

function HealthView(props: ViewProps) {
  const healthTasks = props.data.tasks.filter((task) => task.area === 'health' && task.task_type === 'daily');
  const todayMetric = metricFor(props.data, props.day);
  const lastSync = props.data.corosMetrics.map((metric) => metric.last_synced_at).filter(Boolean).sort().at(-1);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(); date.setDate(date.getDate() - (6 - index));
    return { key: date.toLocaleDateString('en-CA', { timeZone: props.data.settings.timezone }), label: new Intl.DateTimeFormat('en', { weekday: 'narrow', timeZone: props.data.settings.timezone }).format(date) };
  });
  return <>
    <PageIntro eyebrow="Consistency, not perfection" title="Health" copy="Daily choices and COROS evidence, kept together and updated by your two scheduled syncs." />
    <section className="summary-grid health-metrics">
      <SummaryCard label="Sleep" value={formatMinutes(todayMetric?.sleep_duration_minutes)} detail={todayMetric?.sleep_duration_minutes == null ? 'Awaiting sync' : `Score ${todayMetric.sleep_score ?? '—'}`} tone="lavender" icon={Moon} />
      <SummaryCard label="Calories" value={todayMetric?.calories == null ? '—' : Math.round(todayMetric.calories).toLocaleString('en-IN')} detail={todayMetric?.calories == null ? 'Awaiting sync' : 'Today from COROS'} tone="peach" icon={Flame} />
      <SummaryCard label="Exercise" value={todayMetric?.exercise_minutes == null ? '—' : `${todayMetric.exercise_minutes} min`} detail={todayMetric?.exercise_minutes == null ? 'Awaiting sync' : 'Today from COROS'} tone="mint" icon={Activity} />
      <SummaryCard label="Last COROS sync" value={lastSync ? formatSyncTime(lastSync) : 'Awaiting'} detail={todayMetric ? `${capitalize(todayMetric.latest_run_type)} · ${capitalize(todayMetric.sync_status)}` : 'No data received yet'} tone="blue" icon={RefreshCw} />
    </section>
    <Card className="panel habit-panel"><SectionHead title="This week · habit history" detail="Prior days stay recorded" /><CardContent>
      <div className="habit-scroll"><div className="habit-grid" style={{ gridTemplateColumns: `minmax(180px, 1fr) repeat(${days.length}, 44px)` }}>
        <div className="habit-corner">Daily commitment</div>{days.map((day) => <div key={day.key} className="day-head"><strong>{day.label}</strong><small>{day.key.slice(-2)}</small></div>)}
        {healthTasks.map((task) => <div className="habit-row-contents" key={task.id}>
          <div className="habit-name">{task.title}{task.coros_metadata && <RefreshCw />}</div>
          {days.map((date) => { const checked = Boolean(props.data.completions.find((item) => item.task_id === task.id && item.completion_date === date.key)?.is_completed); return <div className={`habit-cell ${checked ? 'checked' : ''}`} key={date.key}>{checked ? <Check /> : <span />}</div>; })}
        </div>)}
      </div></div>
    </CardContent></Card>
    <Card className="panel coros-card"><CardContent><div className="coros-icon"><Dumbbell /></div><div><p className="eyebrow">Scheduled COROS connection</p><h2>Morning and night syncs update Life OS</h2><p>Steps and sleep use the day’s totals. Walking requires one Walk or Run of at least 5 km, and skipping requires one Jump Rope session of at least 1,000 jumps. Missing data stays marked “Awaiting sync”; manual tasks remain yours to tick.</p></div></CardContent></Card>
  </>;
}

function completionFor(task: Task, data: LifeData, day: string): DailyCompletion | undefined {
  return data.completions.find((item) => item.task_id === task.id && item.completion_date === day && item.is_completed);
}

function metricFor(data: LifeData, day: string) {
  return data.corosMetrics.find((metric) => metric.metric_date === day);
}

function formatMinutes(minutes: number | null | undefined) {
  if (minutes == null) return '—';
  return `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`;
}

function formatSyncTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }

function matchingActivities(task: Task, data: LifeData, day: string) {
  const allowed = ((task.coros_metadata?.activity_types as string[] | undefined) ?? []).map((item) => item.toLowerCase());
  return data.corosActivities.filter((activity) => activity.activity_date === day && allowed.includes(activity.activity_type.toLowerCase()));
}

function corosProgress(task: Task, data: LifeData, day: string) {
  const rule = task.coros_metadata ?? {};
  const metric = typeof rule.metric === 'string' ? rule.metric : '';
  const threshold = Number(rule.threshold ?? 0);
  const daily = metricFor(data, day);
  let actual: number | null = null;

  if (metric === 'steps') actual = daily?.steps ?? null;
  if (metric === 'sleep_duration_minutes') actual = daily?.sleep_duration_minutes ?? null;
  if (metric === 'distance_km') {
    const values = matchingActivities(task, data, day).map((activity) => activity.distance_km).filter((value): value is number => value != null);
    actual = values.length ? Math.max(...values) : null;
  }
  if (metric === 'jump_count') {
    const values = matchingActivities(task, data, day).map((activity) => activity.jump_count).filter((value): value is number => value != null);
    actual = values.length ? Math.max(...values) : null;
  }
  if (actual == null) return 'Awaiting sync';
  if (metric === 'steps') return `${Math.round(actual).toLocaleString('en-IN')} / ${threshold.toLocaleString('en-IN')} steps`;
  if (metric === 'distance_km') return `${actual.toFixed(2)} / ${threshold.toFixed(2)} km · one activity`;
  if (metric === 'jump_count') return `${Math.round(actual).toLocaleString('en-IN')} / ${threshold.toLocaleString('en-IN')} jumps · one session`;
  if (metric === 'sleep_duration_minutes') return `${formatMinutes(actual)} / more than ${formatMinutes(threshold)}`;
  return 'COROS linked';
}

function AreaView({ title, description, area, icon: Icon, ...props }: ViewProps & { title: string; description: string; area: Area; icon: typeof Home }) {
  const tasks = props.data.tasks.filter((task) => task.area === area && task.task_type !== 'daily');
  const open = tasks.filter((task) => task.status === 'open');
  const done = tasks.filter((task) => task.status === 'completed');
  const [newTitle, setNewTitle] = useState('');
  return <>
    <PageIntro eyebrow="Keep it moving" title={title} copy={description} action={<div className="page-icon"><Icon /></div>} />
    <div className="area-grid">
      <Card className="panel"><SectionHead title="Open" detail={`${open.length} pending`} /><CardContent>
        <form className="quick-add" onSubmit={(event) => { event.preventDefault(); if (newTitle.trim()) { void props.addTask(newTitle.trim(), 'one_time', area); setNewTitle(''); } }}><Input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder={`Add to ${title}`} /><Button type="submit" className="primary-button"><Plus /> Add</Button></form>
        <TaskList tasks={open} data={props.data} day={props.day} onToggle={props.toggleTask} projects={props.data.projects} onUpdate={props.updateTask} onDelete={props.deleteTask} />
      </CardContent></Card>
      <Card className="panel archive-panel"><SectionHead title="Tasks Done" detail={`${done.length} completed`} /><CardContent><TaskList tasks={done} data={props.data} day={props.day} onToggle={props.toggleTask} projects={props.data.projects} onUpdate={props.updateTask} onDelete={props.deleteTask} compact empty="Completed one-time tasks will stay here." /></CardContent></Card>
    </div>
  </>;
}

function ProjectsView(props: ViewProps) {
  const [adding, setAdding] = useState(false);
  const active = props.data.projects.filter((project) => !project.archived_at);
  const archived = props.data.projects.filter((project) => project.archived_at);
  return <>
    <PageIntro eyebrow="The work behind the work" title="Other Big Projects" copy="Every big project is a collection of clear next steps." action={<Button className="primary-button" onClick={() => setAdding(true)}><FolderPlus /> New project</Button>} />
    {adding && <ProjectEditor title="Create a project" onClose={() => setAdding(false)} onSave={async (name, description) => { await props.addProject(name, description); setAdding(false); }} />}
    {active.length ? <div className="project-grid">{active.map((project, index) => <ProjectCard key={project.id} project={project} index={index} {...props} />)}</div> : <Card className="panel"><CardContent><div className="empty-state"><FolderKanban /><p>No active projects yet. Create one when something needs more than a single task.</p></div></CardContent></Card>}
    {archived.length > 0 && <Card className="panel archived-projects"><SectionHead title="Archived projects" detail={`${archived.length} saved`} /><CardContent>{archived.map((project) => <div className="archived-project-row" key={project.id}><div><strong>{project.name}</strong><small>{project.completed_at ? 'Completed project' : 'Archived project'}</small></div><Button variant="ghost" onClick={() => void props.updateProject(project.id, { archived_at: null })}><Undo2 /> Restore</Button></div>)}</CardContent></Card>}
  </>;
}

function ProjectCard({ project, index, ...props }: ViewProps & { project: Project; index: number }) {
  const [title, setTitle] = useState('');
  const [editing, setEditing] = useState(false);
  const tasks = props.data.tasks.filter((task) => task.project_id === project.id && task.status !== 'archived');
  const done = tasks.filter((task) => isTaskDone(task, props.data, props.day)).length;
  return <><Card className={`project-card project-tone-${index % 3} ${project.completed_at ? 'project-completed' : ''}`}><CardContent>
    <div className="project-top"><span className="project-number">0{index + 1}</span><div className="project-card-actions"><span>{done}/{tasks.length} tasks</span><button type="button" aria-label={`Edit ${project.name}`} onClick={() => setEditing(true)}><MoreHorizontal /></button></div></div>
    <h2>{project.name}</h2><p>{project.description}</p><div className="project-progress"><span style={{ width: `${tasks.length ? (done / tasks.length) * 100 : 0}%` }} /></div>
    {project.completed_at && <div className="project-complete-note"><CheckCircle2 /> Project marked complete</div>}
    <TaskList tasks={tasks} data={props.data} day={props.day} onToggle={props.toggleTask} projects={props.data.projects} onUpdate={props.updateTask} onDelete={props.deleteTask} compact />
    <form className="project-add" onSubmit={(event) => { event.preventDefault(); if (title.trim()) { void props.addTask(title.trim(), 'project_subtask', 'projects', project.id); setTitle(''); } }}><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Add a project task" /><Button type="submit" size="icon" className="primary-button" aria-label="Add project task"><Plus /></Button></form>
    <div className="project-footer-actions"><Button variant="ghost" onClick={() => void props.updateProject(project.id, { completed_at: project.completed_at ? null : new Date().toISOString() })}>{project.completed_at ? <Undo2 /> : <CheckCircle2 />}{project.completed_at ? 'Reopen' : 'Complete'}</Button><Button variant="ghost" onClick={() => { if (window.confirm(`Archive “${project.name}”? Its tasks and history will be kept.`)) void props.updateProject(project.id, { archived_at: new Date().toISOString() }); }}><Archive /> Archive</Button></div>
  </CardContent></Card>
  {editing && <ProjectEditor title="Edit project" initialName={project.name} initialDescription={project.description ?? ''} onClose={() => setEditing(false)} onSave={async (name, description) => { await props.updateProject(project.id, { name, description: description || null }); setEditing(false); }} />}
  </>;
}

function ProjectEditor({ title, initialName = '', initialDescription = '', onClose, onSave }: { title: string; initialName?: string; initialDescription?: string; onClose: () => void; onSave: (name: string, description: string) => Promise<void> }) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [saving, setSaving] = useState(false);
  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><Card className="editor-dialog project-editor" role="dialog" aria-modal="true"><form onSubmit={async (event) => { event.preventDefault(); if (!name.trim()) return; setSaving(true); await onSave(name.trim(), description.trim()); setSaving(false); }}>
    <div className="dialog-head"><div><p className="eyebrow">Project controls</p><h2>{title}</h2></div><Button type="button" variant="ghost" size="icon" onClick={onClose}><X /></Button></div>
    <label>Project name<Input value={name} maxLength={160} onChange={(event) => setName(event.target.value)} autoFocus required /></label>
    <label>Description<textarea value={description} maxLength={600} rows={4} onChange={(event) => setDescription(event.target.value)} placeholder="What does done look like?" /></label>
    <div className="dialog-actions"><span /><span /><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save project'}</Button></div>
  </form></Card></div>;
}

const focusModes = [
  { label: 'Short sprint', work: 15, break: 5 }, { label: 'Start gently', work: 20, break: 5 },
  { label: 'Deep work', work: 50, break: 10 }, { label: 'Extended flow', work: 90, break: 20 },
  { label: 'Full reset', work: 90, break: 30 },
];

function youtubeEmbedUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, '');
    if (!['youtube.com', 'm.youtube.com', 'youtu.be', 'music.youtube.com'].includes(host)) return null;
    const videoId = host === 'youtu.be' ? url.pathname.split('/').filter(Boolean)[0] : url.searchParams.get('v');
    const playlistId = url.searchParams.get('list');
    if (videoId) return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&playsinline=1${playlistId ? `&list=${encodeURIComponent(playlistId)}` : ''}`;
    if (playlistId) return `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(playlistId)}&autoplay=1&playsinline=1`;
    return null;
  } catch { return null; }
}

function FocusSetup({ task, defaultMusicUrl, onClose, onSaveMusic, onStart }: { task: Task; defaultMusicUrl: string | null; onClose: () => void; onSaveMusic: ViewProps['saveFocusMusic']; onStart: ViewProps['startFocusSession'] }) {
  const [modeIndex, setModeIndex] = useState(0);
  const [useMusic, setUseMusic] = useState(Boolean(defaultMusicUrl));
  const [musicUrl, setMusicUrl] = useState(defaultMusicUrl ?? '');
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><Card className="editor-dialog focus-setup" role="dialog" aria-modal="true" aria-labelledby="focus-setup-title"><CardContent>
    <div className="dialog-head"><div><p className="eyebrow">Do now</p><h2 id="focus-setup-title">{task.title}</h2></div><Button type="button" variant="ghost" size="icon" onClick={onClose}><X /></Button></div>
    <p className="dialog-lead">How much focused time does this need?</p>
    <div className="mode-pills setup-modes">{focusModes.map((item, index) => <button type="button" className={modeIndex === index ? 'active' : ''} onClick={() => setModeIndex(index)} key={`${item.work}-${item.break}`}>{item.work}/{item.break}</button>)}</div>
    <label className="music-toggle"><input type="checkbox" checked={useMusic} onChange={(event) => setUseMusic(event.target.checked)} /><Music2 /> Use focus music</label>
    {useMusic && <label className="music-url-label">YouTube video or playlist<Input value={musicUrl} onChange={(event) => { setMusicUrl(event.target.value); setError(''); }} placeholder="Paste a YouTube link" /></label>}
    {error && <p className="field-error">{error}</p>}
    <div className="focus-setup-actions"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="button" className="primary-button" disabled={starting} onClick={async () => {
      const selectedMusic = useMusic && musicUrl.trim() ? musicUrl.trim() : null;
      if (selectedMusic && !youtubeEmbedUrl(selectedMusic)) { setError('Please paste a valid YouTube video or playlist link.'); return; }
      setStarting(true);
      const musicSaved = await onSaveMusic(selectedMusic);
      if (musicSaved) await onStart(task.id, modeIndex, selectedMusic);
      setStarting(false);
    }}><Play /> {starting ? 'Starting…' : 'Start Focus'}</Button></div>
  </CardContent></Card></div>;
}

function FocusView(props: ViewProps) {
  const [modeIndex, setModeIndex] = useState(0);
  const [taskId, setTaskId] = useState('');
  const [useMusic, setUseMusic] = useState(Boolean(props.data.settings.focus_music_url));
  const [musicUrl, setMusicUrl] = useState(props.data.settings.focus_music_url ?? '');
  const [musicError, setMusicError] = useState('');
  const session = props.activeFocus;
  const seconds = useFocusSeconds(session);
  const displaySeconds = session ? seconds : focusModes[modeIndex].work * 60;
  const task = session?.task_id ? props.data.tasks.find((item) => item.id === session.task_id) : null;
  const total = session ? (session.phase === 'work' ? session.planned_work_minutes : session.planned_break_minutes) * 60 : focusModes[modeIndex].work * 60;
  const pct = session ? Math.max(0, Math.min(100, ((total - seconds) / Math.max(1, total)) * 100)) : 0;
  const openTasks = props.data.tasks.filter((item) => item.status === 'open');
  const history = props.data.focusSessions.filter((item) => ['completed', 'cancelled'].includes(item.status));
  const embedUrl = youtubeEmbedUrl(session?.music_url ?? null);
  const phaseLabel = session?.status === 'awaiting_outcome' ? 'complete' : session?.status === 'paused' ? 'paused' : session?.phase ?? 'work';
  return <>
    <PageIntro eyebrow="Choose the session that fits the task" title="Focus" copy="Start small when a task feels heavy. Stay longer when flow arrives." />
    <div className="focus-layout"><Card className="focus-card"><CardContent>
      {!session && <>
        <div className="mode-pills">{focusModes.map((item, index) => <button className={modeIndex === index ? 'active' : ''} onClick={() => setModeIndex(index)} key={`${item.work}-${item.break}`}>{item.work}/{item.break}</button>)}</div>
        <label className="focus-task-label">Task<select value={taskId} onChange={(event) => setTaskId(event.target.value)}><option value="">Choose a task</option>{openTasks.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <div className="focus-music-settings"><label className="music-toggle"><input type="checkbox" checked={useMusic} onChange={(event) => setUseMusic(event.target.checked)} /><Music2 /> Use focus music</label>{useMusic && <Input value={musicUrl} onChange={(event) => { setMusicUrl(event.target.value); setMusicError(''); }} placeholder="Paste a YouTube video or playlist link" />}{musicError && <p className="field-error">{musicError}</p>}</div>
      </>}
      {session && <div className="active-focus-task"><span>{session.phase === 'break' ? 'Break after' : session.status === 'awaiting_outcome' ? 'Session finished' : 'Focusing on'}</span><strong>{task?.title ?? 'Open focus'}</strong></div>}
      <div className={`timer-ring ${session?.phase ?? 'work'}`} style={{ '--progress': `${pct * 3.6}deg` } as React.CSSProperties}><div><span>{phaseLabel}</span><strong>{session?.status === 'awaiting_outcome' ? 'Done' : clockText(displaySeconds)}</strong><small>{session?.mode ?? focusModes[modeIndex].label}</small></div></div>
      {!session && <div className="timer-actions"><Button variant="outline" onClick={() => { setTaskId(''); setModeIndex(0); }}><RotateCcw /> Reset</Button><Button className="primary-button start-button" onClick={async () => {
        const selectedMusic = useMusic && musicUrl.trim() ? musicUrl.trim() : null;
        if (selectedMusic && !youtubeEmbedUrl(selectedMusic)) { setMusicError('Please paste a valid YouTube video or playlist link.'); return; }
        const musicSaved = await props.saveFocusMusic(selectedMusic);
        if (musicSaved) await props.startFocusSession(taskId || null, modeIndex, selectedMusic);
      }}><Play /> Start</Button></div>}
      {session?.status === 'running' && <div className="timer-actions"><Button variant="outline" onClick={() => void props.cancelFocusSession(session)}><X /> End</Button><Button className="primary-button start-button" onClick={() => void props.pauseFocusSession(session)}><Pause /> Pause</Button></div>}
      {session?.status === 'paused' && <div className="timer-actions"><Button variant="outline" onClick={() => void props.cancelFocusSession(session)}><X /> End</Button><Button className="primary-button start-button" onClick={() => void props.resumeFocusSession(session)}><Play /> Resume</Button></div>}
      {session?.status === 'awaiting_outcome' && <div className="focus-outcome"><h3>Did you finish {task ? `“${task.title}”` : 'what you planned'}?</h3>{task?.coros_metadata && <p>COROS will confirm this task automatically. Your focused time is still saved.</p>}<div>
        {task && !task.coros_metadata && <Button className="primary-button" onClick={() => void props.resolveFocusSession(session, 'complete')}><Check /> Yes, complete it</Button>}
        <Button variant="outline" onClick={() => void props.resolveFocusSession(session, 'keep_open')}>{task?.coros_metadata ? 'Continue to break' : 'Not yet'}</Button>
        <Button variant="ghost" onClick={() => void props.resolveFocusSession(session, 'add_time')}><Plus /> Add 15 min</Button>
      </div></div>}
      {embedUrl && session && <div className="focus-music-player"><div><Music2 /><span>Focus music</span></div><iframe src={embedUrl} title="Focus music from YouTube" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /><small>If sound does not start automatically, tap Play once in the YouTube player.</small></div>}
    </CardContent></Card>
    <Card className="panel focus-history"><SectionHead title="Session history" detail={`${history.length} saved`} /><CardContent>{history.length ? history.slice(0, 8).map((item) => <div className="session-row" key={item.id}><span className="session-icon"><TimerReset /></span><div><strong>{props.data.tasks.find((taskItem) => taskItem.id === item.task_id)?.title ?? 'Open focus'}</strong><small>{item.mode} · {item.planned_work_minutes} min</small></div><time>{new Date(item.started_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</time></div>) : <div className="empty-state"><Clock3 /><p>Your completed focus sessions will appear here.</p></div>}</CardContent></Card></div>
  </>;
}

function latestWeight(data: LifeData) { return [...data.weights].sort((a, b) => a.entry_date.localeCompare(b.entry_date)).at(-1); }
function bmiFor(data: LifeData) { const weight = latestWeight(data)?.weight_kg; return weight ? weight / ((data.settings.height_cm / 100) ** 2) : null; }
function bmiCategory(bmi: number | null) { if (!bmi) return 'Need weight'; if (bmi < 18.5) return 'Underweight'; if (bmi < 25) return 'Normal'; if (bmi < 30) return 'Overweight'; return 'Obesity'; }

function BodyMiniCard({ data, onSave }: { data: LifeData; onSave: (weight: number) => Promise<void> }) {
  const [value, setValue] = useState('');
  const bmi = bmiFor(data);
  return <Card className="panel body-mini"><SectionHead title="Body Stats" detail="Manual entry" /><CardContent><div className="body-stat-row"><div><span>Current weight</span><strong>{latestWeight(data)?.weight_kg ?? '—'} <small>kg</small></strong></div><div title="BMI compares weight with height. Adult ranges: underweight below 18.5, normal 18.5–24.9, overweight 25–29.9, obesity 30+."><span>BMI ⓘ</span><strong>{bmi?.toFixed(1) ?? '—'} <small>{bmiCategory(bmi)}</small></strong></div></div><form className="weight-entry" onSubmit={(event) => { event.preventDefault(); const parsed = Number(value); if (parsed > 0) { void onSave(parsed); setValue(''); } }}><Input inputMode="decimal" type="number" min="30" max="300" step="0.1" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Enter today’s weight" /><Button type="submit" className="primary-button">Save</Button></form></CardContent></Card>;
}

function BodyView(props: ViewProps) {
  const data = props.data;
  const current = latestWeight(data)?.weight_kg;
  const bmi = bmiFor(data);
  const [value, setValue] = useState('');
  const weights = [...data.weights].sort((a, b) => a.entry_date.localeCompare(b.entry_date));
  const chartPoints = weights.map((entry) => ({ x: new Date(`${entry.entry_date}T00:00:00`).getTime(), y: Number(entry.weight_kg) }));
  const goalDate = new Date(`${data.settings.weight_goal_date}T00:00:00`).getTime();
  const minX = chartPoints[0]?.x ?? Date.now(); const maxX = Math.max(goalDate, Date.now() + 86400000);
  const allY = [...chartPoints.map((p) => p.y), data.settings.weight_goal_kg]; const minY = Math.min(...allY) - 1; const maxY = Math.max(...allY) + 1;
  const xy = (point: { x: number; y: number }) => ({ x: 48 + ((point.x - minX) / Math.max(1, maxX - minX)) * 612, y: 24 + ((maxY - point.y) / Math.max(1, maxY - minY)) * 210 });
  const path = chartPoints.map((point, index) => `${index ? 'L' : 'M'} ${xy(point).x} ${xy(point).y}`).join(' ');
  const goalStart = chartPoints[0] ?? { x: Date.now(), y: current ?? 99 }; const g1 = xy(goalStart); const g2 = xy({ x: goalDate, y: data.settings.weight_goal_kg });
  return <>
    <PageIntro eyebrow="Manual measurements, useful direction" title="Body Stats" copy="Track what changes over time without turning the number into the whole story." />
    <section className="summary-grid three">
      <SummaryCard label="Current weight" value={`${current ?? '—'} kg`} detail={`${weights.length} weigh-ins`} tone="peach" icon={Scale} />
      <SummaryCard label="BMI" value={bmi?.toFixed(1) ?? '—'} detail={`${bmiCategory(bmi)} · height ${data.settings.height_cm} cm`} tone="lavender" icon={BarChart3} />
      <SummaryCard label="Goal" value={`${data.settings.weight_goal_kg} kg`} detail={`By ${new Date(`${data.settings.weight_goal_date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`} tone="mint" icon={Sparkles} />
    </section>
    <Card className="panel weight-panel"><div className="weight-panel-head"><div><p className="eyebrow">Weight trajectory</p><h2>Small changes, clear direction</h2></div><form className="weight-entry large" onSubmit={(event) => { event.preventDefault(); const parsed = Number(value); if (parsed > 0) { void props.addWeight(parsed); setValue(''); } }}><Input type="number" inputMode="decimal" min="30" max="300" step="0.1" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Today’s kg" /><Button className="primary-button" type="submit">Save</Button></form></div><CardContent>
      <div className="chart-wrap"><svg viewBox="0 0 700 270" role="img" aria-label="Weight entries and goal trajectory"><line x1="48" y1="234" x2="660" y2="234" className="axis"/><line x1={g1.x} y1={g1.y} x2={g2.x} y2={g2.y} className="goal-line"/><path d={path} className="weight-line"/>{chartPoints.map((point) => { const pos = xy(point); return <circle key={`${point.x}-${point.y}`} cx={pos.x} cy={pos.y} r="5" className="weight-dot"/>; })}<circle cx={g2.x} cy={g2.y} r="6" className="goal-dot"/><text x={Math.min(g2.x - 20, 610)} y={Math.max(g2.y - 12, 16)} className="chart-label">Goal {data.settings.weight_goal_kg} kg</text><text x="48" y="258" className="chart-date">{new Date(minX).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</text><text x="590" y="258" className="chart-date">25 Dec</text></svg></div>
      <div className="weight-history">{weights.slice().reverse().slice(0, 6).map((entry) => <div key={entry.id}><span>{new Date(`${entry.entry_date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span><strong>{entry.weight_kg} kg</strong><small>Manual</small></div>)}</div>
    </CardContent></Card>
  </>;
}
