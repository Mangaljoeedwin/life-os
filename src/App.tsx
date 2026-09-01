import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  Archive,
  Activity,
  ArrowDown,
  ArrowUp,
  BarChart3,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  Clock3,
  Cloud,
  Dumbbell,
  FolderKanban,
  Flame,
  GripVertical,
  HeartPulse,
  Home,
  LogOut,
  Menu,
  Moon,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Scale,
  Sparkles,
  TimerReset,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { makeDemoData } from './demo';
import { hasSupabaseConfig, supabase } from './supabase';
import type { Area, CorosActivity, CorosDailyMetric, DailyCompletion, FocusSession, LifeData, Project, Task, TaskType, WeightEntry } from './types';

type Tab = 'today' | 'health' | 'personal' | 'work' | 'projects' | 'focus' | 'body';
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
        <div className="brand-mark"><Sparkles size={22} /></div>
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

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!hasSupabaseConfig);
  const [data, setData] = useState<LifeData>(() => makeDemoData());
  const [loading, setLoading] = useState(hasSupabaseConfig);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('today');
  const [menuOpen, setMenuOpen] = useState(false);
  const [greetingIndex, setGreetingIndex] = useState(() => Math.floor(Math.random() * greetingTemplates.length));

  const loadData = useCallback(async (showLoadingScreen = false) => {
    if (!supabase || !session?.user.id) return;
    if (showLoadingScreen) setLoading(true);
    const [tasks, completions, projects, weights, sessions, settings, corosMetrics, corosActivities] = await Promise.all([
      supabase.from('tasks').select('*').order('sort_order'),
      supabase.from('daily_completions').select('*').order('completion_date', { ascending: false }),
      supabase.from('projects').select('*').is('archived_at', null).order('sort_order'),
      supabase.from('weight_entries').select('*').order('entry_date'),
      supabase.from('focus_sessions').select('*').order('started_at', { ascending: false }).limit(50),
      supabase.from('user_settings').select('*').single(),
      supabase.from('coros_daily_metrics').select('*').order('metric_date', { ascending: false }).limit(31),
      supabase.from('coros_activities').select('*').order('started_at', { ascending: false }).limit(100),
    ]);
    const failure = [tasks, completions, projects, weights, sessions, settings, corosMetrics, corosActivities].find((result) => result.error);
    if (failure?.error) setError(failure.error.message);
    else {
      setError('');
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

  async function addTask(title: string, taskType: TaskType, area: Area, projectId: string | null = null) {
    const newTask: Task = {
      id: uid(), user_id: userId, title, task_type: taskType, area, project_id: projectId,
      status: 'open', priority: 'normal', sort_order: data.tasks.length + 1, coros_metadata: null,
      completed_at: null, created_at: new Date().toISOString(),
    };
    setData((current) => ({ ...current, tasks: [...current.tasks, newTask] }));
    if (supabase) {
      const { error: saveError } = await supabase.from('tasks').insert(newTask);
      if (saveError) { setError(saveError.message); void loadData(); }
    }
  }

  async function reorderTask(taskId: string, orderedTaskIds: string[], direction: -1 | 1) {
    const index = orderedTaskIds.indexOf(taskId);
    const siblingId = orderedTaskIds[index + direction];
    if (index < 0 || !siblingId) return;
    const task = data.tasks.find((item) => item.id === taskId);
    const sibling = data.tasks.find((item) => item.id === siblingId);
    if (!task || !sibling) return;

    const nextTask = { ...task, sort_order: sibling.sort_order };
    const nextSibling = { ...sibling, sort_order: task.sort_order };
    setData((current) => ({
      ...current,
      tasks: current.tasks
        .map((item) => item.id === taskId ? nextTask : item.id === siblingId ? nextSibling : item)
        .sort((a, b) => a.sort_order - b.sort_order),
    }));

    if (supabase) {
      const [taskResult, siblingResult] = await Promise.all([
        supabase.from('tasks').update({ sort_order: nextTask.sort_order }).eq('id', taskId),
        supabase.from('tasks').update({ sort_order: nextSibling.sort_order }).eq('id', siblingId),
      ]);
      const saveError = taskResult.error ?? siblingResult.error;
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

  async function addFocus(sessionData: Omit<FocusSession, 'id' | 'user_id'>) {
    const record: FocusSession = { id: uid(), user_id: userId, ...sessionData };
    setData((current) => ({ ...current, focusSessions: [record, ...current.focusSessions] }));
    if (supabase) {
      const { error: saveError } = await supabase.from('focus_sessions').insert(record);
      if (saveError) setError(saveError.message);
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

  if (!authReady) return <LoadingScreen />;
  if (hasSupabaseConfig && !session) return <AuthScreen />;
  if (loading) return <LoadingScreen />;

  const displayName = data.settings.display_name ?? '';
  const shared = { data, day, toggleTask, addTask, reorderTask, addWeight, addFocus };
  const needsName = Boolean(session && !session.user.user_metadata?.display_name);
  return (
    <div className="app-shell">
      {needsName && <NamePrompt onSave={saveDisplayName} />}
      <header className="topbar">
        <button className="brand" onClick={() => setTab('today')}><span className="brand-mark"><Sparkles size={18} /></span><span>Life OS</span></button>
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
        {error && <div className="error-banner"><span>{error}</span><button onClick={() => setError('')}><X size={16} /></button></div>}
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
      <div className="brand-mark"><Sparkles size={20} /></div>
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
  addTask: (title: string, type: TaskType, area: Area, projectId?: string | null) => Promise<void>;
  reorderTask: (taskId: string, orderedTaskIds: string[], direction: -1 | 1) => Promise<void>;
  addWeight: (weight: number) => Promise<void>;
  addFocus: (session: Omit<FocusSession, 'id' | 'user_id'>) => Promise<void>;
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
  const [reordering, setReordering] = useState(false);
  const { data, day } = props;
  const activeTasks = data.tasks.filter((task) => task.status !== 'archived');
  const done = activeTasks.filter((task) => isTaskDone(task, data, day));
  const open = activeTasks.filter((task) => !isTaskDone(task, data, day));
  const daily = activeTasks.filter((task) => task.task_type === 'daily');
  const dailyDone = daily.filter((task) => isTaskDone(task, data, day)).length;
  return <>
    <PageIntro eyebrow={prettyToday(data.settings.timezone)} title={props.greeting} />
    <section className="summary-grid">
      <SummaryCard label="Today" value={`${open.length} open`} detail={`${done.length} completed`} tone="lavender" icon={Check} />
      <SummaryCard label="Daily completion" value={`${daily.length ? Math.round((dailyDone / daily.length) * 100) : 0}%`} detail={`${dailyDone} of ${daily.length} daily items`} tone="mint" icon={BarChart3} />
      <SummaryCard label="Focus" value={`${props.data.focusSessions.filter((item) => item.completed_at?.startsWith(day)).length} sessions`} detail="Recorded today" tone="peach" icon={Clock3} />
      <SummaryCard label="Sync" value={hasSupabaseConfig ? 'Live' : 'Preview'} detail={hasSupabaseConfig ? 'Across your devices' : 'Connect Supabase next'} tone="blue" icon={Cloud} />
    </section>
    <AddTaskForm projects={data.projects} onAdd={props.addTask} />
    <section className="today-layout">
      <Card className="panel task-panel"><SectionHead title="Daily To Do" detail={`${open.length} remaining`} action={<button className={`reorder-toggle ${reordering ? 'active' : ''}`} onClick={() => setReordering((current) => !current)}>{reordering ? 'Done' : 'Reorder'}</button>} />
        <CardContent><p className="panel-note">Daily items start fresh by date. COROS-linked items update after the morning and night syncs.</p><TaskList tasks={open} data={data} day={day} onToggle={props.toggleTask} reordering={reordering} onReorder={(taskId, direction) => props.reorderTask(taskId, open.map((task) => task.id), direction)} /></CardContent>
      </Card>
      <div className="side-stack">
        <BodyMiniCard data={data} onSave={props.addWeight} />
        <Card className="panel"><SectionHead title="Completed today" detail={`${done.length} done`} />
          <CardContent><TaskList tasks={done} data={data} day={day} onToggle={props.toggleTask} compact empty="Nothing completed yet — the first check is the hardest." /></CardContent>
        </Card>
      </div>
    </section>
  </>;
}

function SummaryCard({ label, value, detail, tone, icon: Icon }: { label: string; value: string; detail: string; tone: string; icon: typeof Check }) {
  return <Card className={`summary-card ${tone}`}><CardContent><span className="summary-icon"><Icon /></span><p>{label}</p><strong>{value}</strong><small>{detail}</small></CardContent></Card>;
}

function AddTaskForm({ projects, onAdd }: { projects: Project[]; onAdd: ViewProps['addTask'] }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<TaskType>('daily');
  const [area, setArea] = useState<Area>('today');
  const [projectId, setProjectId] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    await onAdd(title.trim(), projectId ? 'project_subtask' : type, projectId ? 'projects' : area, projectId || null);
    setTitle(''); setProjectId(''); setOpen(false);
  }
  if (!open) return <button className="add-commitment" onClick={() => setOpen(true)}><span><Plus /></span><div><strong>Add a commitment</strong><small>Daily To Do, one-time task or project step</small></div><ChevronRight /></button>;
  return <Card className="add-form-card"><form onSubmit={submit} className="add-form">
    <div className="form-title"><div><p className="eyebrow">New commitment</p><h2>What needs your attention?</h2></div><Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)}><X /></Button></div>
    <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Call Martin tomorrow" />
    <div className="form-grid">
      <label>Behavior<select value={type} onChange={(event) => setType(event.target.value as TaskType)} disabled={Boolean(projectId)}><option value="daily">Daily To Do</option><option value="one_time">One-time</option></select></label>
      <label>Category<select value={area} onChange={(event) => setArea(event.target.value as Area)} disabled={Boolean(projectId)}><option value="today">Today</option><option value="health">Health</option><option value="personal">Personal / Home</option><option value="work">Work Life</option></select></label>
      <label>Project (optional)<select value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">No project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
    </div>
    <div className="form-actions"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" className="primary-button"><Plus /> Add commitment</Button></div>
  </form></Card>;
}

function SectionHead({ title, detail, action }: { title: string; detail?: string; action?: React.ReactNode }) {
  return <div className="section-head"><h2>{title}</h2><div className="section-head-actions">{detail && <span>{detail}</span>}{action}</div></div>;
}

function TaskList({ tasks, data, day, onToggle, compact = false, empty = 'No tasks here yet.', reordering = false, onReorder }: { tasks: Task[]; data: LifeData; day: string; onToggle: (task: Task) => Promise<void>; compact?: boolean; empty?: string; reordering?: boolean; onReorder?: (taskId: string, direction: -1 | 1) => Promise<void> }) {
  if (!tasks.length) return <div className="empty-state"><Check /><p>{empty}</p></div>;
  return <div className={`task-list ${compact ? 'compact' : ''}`}>{tasks.map((task) => {
    const index = tasks.findIndex((item) => item.id === task.id);
    const done = isTaskDone(task, data, day);
    const synced = Boolean(task.coros_metadata);
    const completion = completionFor(task, data, day);
    const progress = synced ? corosProgress(task, data, day) : null;
    return <div className={`task-row ${done ? 'done' : ''} ${reordering ? 'reordering' : ''}`} key={task.id}>
      {reordering ? <span className="reorder-grip" aria-hidden="true"><GripVertical /></span> : <button className="check-button" aria-label={`${done ? 'Reopen' : 'Complete'} ${task.title}`} onClick={() => void onToggle(task)}>{done && <Check />}</button>}
      <div className="task-copy"><strong>{task.title}</strong><div className="task-meta"><span>{task.task_type === 'daily' ? 'Daily To Do' : task.task_type === 'project_subtask' ? 'Project task' : done ? 'Archived' : 'One-time'}</span>{synced && <span className={`sync-tag ${completion?.source === 'coros' ? 'verified' : ''}`}><RefreshCw /> {completion?.source === 'coros' ? 'COROS verified' : progress}</span>}</div></div>
      {reordering && onReorder ? <div className="reorder-controls"><button disabled={index === 0} aria-label={`Move ${task.title} up`} onClick={() => void onReorder(task.id, -1)}><ArrowUp /></button><button disabled={index === tasks.length - 1} aria-label={`Move ${task.title} down`} onClick={() => void onReorder(task.id, 1)}><ArrowDown /></button></div> : task.task_type !== 'daily' && done ? <Archive className="archive-icon" /> : null}
    </div>;
  })}</div>;
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
        <TaskList tasks={open} data={props.data} day={props.day} onToggle={props.toggleTask} />
      </CardContent></Card>
      <Card className="panel archive-panel"><SectionHead title="Tasks Done" detail={`${done.length} archived`} /><CardContent><TaskList tasks={done} data={props.data} day={props.day} onToggle={props.toggleTask} compact empty="Completed one-time tasks will stay here." /></CardContent></Card>
    </div>
  </>;
}

function ProjectsView(props: ViewProps) {
  return <>
    <PageIntro eyebrow="The work behind the work" title="Other Big Projects" copy="Every big project is a collection of clear next steps." />
    <div className="project-grid">{props.data.projects.map((project, index) => <ProjectCard key={project.id} project={project} index={index} {...props} />)}</div>
  </>;
}

function ProjectCard({ project, index, ...props }: ViewProps & { project: Project; index: number }) {
  const [title, setTitle] = useState('');
  const tasks = props.data.tasks.filter((task) => task.project_id === project.id && task.status !== 'archived');
  const done = tasks.filter((task) => isTaskDone(task, props.data, props.day)).length;
  return <Card className={`project-card project-tone-${index % 3}`}><CardContent>
    <div className="project-top"><span className="project-number">0{index + 1}</span><span>{done}/{tasks.length} complete</span></div>
    <h2>{project.name}</h2><p>{project.description}</p><div className="project-progress"><span style={{ width: `${tasks.length ? (done / tasks.length) * 100 : 0}%` }} /></div>
    <TaskList tasks={tasks} data={props.data} day={props.day} onToggle={props.toggleTask} compact />
    <form className="project-add" onSubmit={(event) => { event.preventDefault(); if (title.trim()) { void props.addTask(title.trim(), 'project_subtask', 'projects', project.id); setTitle(''); } }}><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Add a project task" /><Button type="submit" size="icon" className="primary-button" aria-label="Add project task"><Plus /></Button></form>
  </CardContent></Card>;
}

const focusModes = [
  { label: 'Short sprint', work: 15, break: 5 }, { label: 'Start gently', work: 20, break: 5 },
  { label: 'Deep work', work: 50, break: 10 }, { label: 'Extended flow', work: 90, break: 20 },
  { label: 'Full reset', work: 90, break: 30 },
];

function FocusView(props: ViewProps) {
  const [modeIndex, setModeIndex] = useState(0);
  const mode = focusModes[modeIndex];
  const [taskId, setTaskId] = useState('');
  const [seconds, setSeconds] = useState(mode.work * 60);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<'work' | 'break'>('work');
  const startedAt = useRef<string | null>(null);
  const total = (phase === 'work' ? mode.work : mode.break) * 60;
  useEffect(() => { setSeconds(mode.work * 60); setRunning(false); setPhase('work'); startedAt.current = null; }, [modeIndex, mode.work]);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setSeconds((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  useEffect(() => {
    if (seconds !== 0 || !running) return;
    setRunning(false);
    if (phase === 'work') {
      const ended = new Date().toISOString();
      void props.addFocus({ task_id: taskId || null, mode: mode.label, planned_work_minutes: mode.work, planned_break_minutes: mode.break, actual_seconds: mode.work * 60, started_at: startedAt.current ?? ended, completed_at: ended, status: 'completed' });
      setPhase('break'); setSeconds(mode.break * 60);
    } else { setPhase('work'); setSeconds(mode.work * 60); startedAt.current = null; }
  }, [seconds, running, phase, mode, taskId, props]);
  const reset = () => { setRunning(false); setPhase('work'); setSeconds(mode.work * 60); startedAt.current = null; };
  const pct = Math.max(0, Math.min(100, ((total - seconds) / total) * 100));
  const openTasks = props.data.tasks.filter((task) => task.status === 'open');
  return <>
    <PageIntro eyebrow="Choose the session that fits the task" title="Focus" copy="Start small when a task feels heavy. Stay longer when flow arrives." />
    <div className="focus-layout"><Card className="focus-card"><CardContent>
      <div className="mode-pills">{focusModes.map((item, index) => <button className={modeIndex === index ? 'active' : ''} onClick={() => setModeIndex(index)} key={`${item.work}-${item.break}`}>{item.work}/{item.break}</button>)}</div>
      <label className="focus-task-label">Task<select value={taskId} onChange={(event) => setTaskId(event.target.value)}><option value="">Choose a task</option>{openTasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
      <div className={`timer-ring ${phase}`} style={{ '--progress': `${pct * 3.6}deg` } as React.CSSProperties}><div><span>{phase}</span><strong>{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</strong><small>{mode.label}</small></div></div>
      <div className="timer-actions"><Button variant="outline" onClick={reset}><RotateCcw /> Reset</Button><Button className="primary-button start-button" onClick={() => { if (!startedAt.current) startedAt.current = new Date().toISOString(); setRunning(!running); }}>{running ? <Pause /> : <Play />}{running ? 'Pause' : 'Start'}</Button></div>
    </CardContent></Card>
    <Card className="panel focus-history"><SectionHead title="Session history" detail={`${props.data.focusSessions.length} saved`} /><CardContent>{props.data.focusSessions.length ? props.data.focusSessions.slice(0, 8).map((session) => <div className="session-row" key={session.id}><span className="session-icon"><TimerReset /></span><div><strong>{props.data.tasks.find((task) => task.id === session.task_id)?.title ?? 'Open focus'}</strong><small>{session.mode} · {session.planned_work_minutes} min</small></div><time>{new Date(session.started_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</time></div>) : <div className="empty-state"><Clock3 /><p>Your completed focus sessions will appear here.</p></div>}</CardContent></Card></div>
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
