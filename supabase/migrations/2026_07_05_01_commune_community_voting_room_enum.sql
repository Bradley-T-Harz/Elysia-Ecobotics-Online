-- Community Voting Room enum extension.
-- Apply manually before 2026_07_05_02_commune_community_voting_room.sql.
-- Kept separate because new Postgres enum values should not be used in the same migration transaction.

do $$
begin
  alter type public.commune_post_type add value if not exists 'community_vote';
exception when duplicate_object then null;
end $$;
