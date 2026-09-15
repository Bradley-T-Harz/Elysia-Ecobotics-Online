// Fresh isolated replay for the new environment boundary, without historical fixtures.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
const name=`elysia-first-party-${process.pid}`;
function run(args, allowed=false) {
 const r=spawnSync('podman',args,{encoding:'utf8',timeout:60000,maxBuffer:16*1024*1024});
 if(r.status!==0&&!allowed) throw new Error((r.stderr||r.stdout||String(r.error)).slice(-7000));
 return r;
}
const sql=args=>run(['exec',name,'psql','-q','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d','postgres',...args]);
let started=false;
try {
 run(['run','--rm','--pull=never','--network=none','--cpus=2','--memory=2g','--pids-limit=256','--name',name,'-e','POSTGRES_PASSWORD=elysia_disposable_only','-d','public.ecr.aws/supabase/postgres:17.6.1.127']);started=true;
 for(let i=0;i<60;i++){if(run(['exec',name,'pg_isready','-q','-U','supabase_admin','-d','postgres'],true).status===0)break;await new Promise(r=>setTimeout(r,500));}
 const files=readdirSync('supabase/migrations').filter(f=>/^\d{14}_.+[.]sql$/.test(f)).sort();
 for(const file of files) run(['cp',`supabase/migrations/${file}`,`${name}:/tmp/${file}`]);
 sql(["-c",`    create schema if not exists storage;
    create table if not exists storage.buckets (
      id text primary key,
      name text not null unique,
      public boolean not null default false,
      file_size_limit bigint,
      allowed_mime_types text[]
    );
    create table if not exists storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text not null references storage.buckets(id),
      name text not null,
      owner_id uuid,
      metadata jsonb,
      created_at timestamptz not null default now(),
      unique (bucket_id, name)
    );
    create or replace function storage.foldername(name text)
    returns text[]
    language sql
    immutable
    strict
    as \$\$
      select case
        when pg_catalog.strpos(name, '/') = 0 then array[]::text[]
        else pg_catalog.string_to_array(
          pg_catalog.regexp_replace(name, '/[^/]*$', ''),
          '/'
        )
      end;
    \$\$;
    alter table storage.objects enable row level security;
    create or replace function auth.jwt()
    returns jsonb
    language sql
    stable
    as \$\$
      select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
    \$\$;
`]);
 for(const [i,file] of files.entries()) {
  if(i===1) sql(['-c',"alter table auth.users add column if not exists banned_until timestamptz, add column if not exists deleted_at timestamptz, add column if not exists is_anonymous boolean not null default false, add column if not exists email_confirmed_at timestamptz; create table if not exists auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,not_after timestamptz); alter table auth.sessions add column if not exists not_after timestamptz;"]);
  sql(['-f',`/tmp/${file}`]);
 }
 run(['cp','scripts/fixtures/firstPartyActivationBehavior.sql',`${name}:/tmp/behavior.sql`]);
 console.log(sql(['-f','/tmp/behavior.sql']).stdout);console.log(`Fresh replay: ${files.length} migrations; first-party behavior passed.`);
} finally {if(started)run(['rm','-f',name],true);}
