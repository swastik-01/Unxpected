create table if not exists public.leaderboard_runs (
  id text primary key,
  player_name text not null check (char_length(player_name) between 1 and 18),
  mode text not null check (mode in ('standard', 'training', 'daily')),
  level_index integer not null check (level_index between 1 and 99),
  score integer not null check (score >= 0),
  duration_ms double precision not null check (duration_ms >= 0),
  duration_text text not null,
  deaths integer not null check (deaths >= 0),
  coins integer not null check (coins >= 0),
  mutations_survived integer not null check (mutations_survived >= 0),
  trust_percent integer not null check (trust_percent between 0 and 100),
  grade text not null check (grade in ('C', 'B', 'A', 'S', 'Paradox')),
  daily_date_key text,
  played_at timestamptz not null
);

alter table public.leaderboard_runs enable row level security;

drop policy if exists "leaderboard public read" on public.leaderboard_runs;
create policy "leaderboard public read"
on public.leaderboard_runs
for select
using (true);

drop policy if exists "leaderboard public insert" on public.leaderboard_runs;
create policy "leaderboard public insert"
on public.leaderboard_runs
for insert
with check (
  char_length(player_name) between 1 and 18
  and level_index between 1 and 99
  and score >= 0
  and duration_ms >= 0
  and deaths >= 0
  and trust_percent between 0 and 100
);

create index if not exists leaderboard_runs_rank_idx
on public.leaderboard_runs (level_index desc, score desc, duration_ms asc, deaths asc);

create index if not exists leaderboard_runs_played_at_idx
on public.leaderboard_runs (played_at desc);
