create extension if not exists "uuid-ossp";
create table clubs (id uuid primary key default uuid_generate_v4(), name text not null, created_at timestamptz default now());
create table players (id uuid primary key default uuid_generate_v4(), club_id uuid references clubs(id) on delete cascade, name text not null, position text not null, age int, rating numeric(3,1) default 0, form numeric(3,1) default 0, market_value bigint default 0, created_at timestamptz default now());
create table matches (id uuid primary key default uuid_generate_v4(), club_id uuid references clubs(id) on delete cascade, opponent text not null, kickoff timestamptz, home boolean default true, goals_for int, goals_against int, created_at timestamptz default now());
alter table clubs enable row level security; alter table players enable row level security; alter table matches enable row level security;
