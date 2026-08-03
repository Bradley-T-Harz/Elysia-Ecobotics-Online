\set ON_ERROR_STOP on

-- Synthetic pre-Task-C/D state. This fixture runs after the former production
-- migration chain and before account-communication migrations in a disposable
-- database. It intentionally uses the formerly permitted proposal insert.

insert into auth.users(
  id, email, email_confirmed_at, banned_until, deleted_at, is_anonymous,
  created_at, updated_at
)
values
  (
    'd1000000-0000-4000-8000-000000000001',
    'release-reconcile-contributor@example.invalid',
    pg_catalog.now(), null, null, false, pg_catalog.now(), pg_catalog.now()
  ),
  (
    'd1000000-0000-4000-8000-000000000002',
    'release-reconcile-author@example.invalid',
    pg_catalog.now(), null, null, false, pg_catalog.now(), pg_catalog.now()
  );

insert into public.profiles(id, username, is_admin)
values
  ('d1000000-0000-4000-8000-000000000001', 'release_reconcile_contributor', false),
  ('d1000000-0000-4000-8000-000000000002', 'release_reconcile_author', false);

insert into public.commune_posts(
  id, user_id, post_type, title, body, status, visibility
)
values (
  'd1100000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000002',
  'code_sharing',
  'Synthetic pre-event proposal source',
  'Synthetic public source body.',
  'published',
  'public'
);

insert into public.commune_code_snippets(
  id, post_id, author_user_id, language, file_name, code_text
)
values (
  'd1200000-0000-4000-8000-000000000001',
  'd1100000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000002',
  'javascript',
  'published.js',
  'console.log("published snapshot remains unchanged")'
);

insert into public.commune_code_revision_proposals(
  id, post_id, code_snippet_id, proposer_user_id, original_author_user_id,
  base_code_text, proposed_code_text, language, file_name,
  change_summary, explanation, proposal_status
)
values (
  'd1300000-0000-4000-8000-000000000001',
  'd1100000-0000-4000-8000-000000000001',
  'd1200000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000002',
  'console.log("published snapshot remains unchanged")',
  'PRIVATE_PROPOSAL_CODE_MUST_NOT_PROJECT',
  'javascript',
  'proposed.js',
  'Synthetic pre-event proposal.',
  'PRIVATE_PROPOSAL_EXPLANATION_MUST_NOT_PROJECT',
  'submitted'
);

insert into public.user_notifications(
  id, user_id, notification_type, title, body,
  source_type, source_id, action_url, is_read
)
values
  (
    'd1400000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000002',
    'commune_code_revision_proposed',
    'Legacy proposal notice',
    'PRIVATE_LEGACY_PROPOSAL_BODY_MUST_NOT_PROJECT',
    'commune_code_revision_proposal',
    'd1300000-0000-4000-8000-000000000001',
    '/commune/coding-cornucopia/review?proposal=d1300000-0000-4000-8000-000000000001',
    false
  ),
  (
    'd1400000-0000-4000-8000-000000000002',
    'd1000000-0000-4000-8000-000000000002',
    'legacy_fixture_update',
    'UNTRUSTED_LEGACY_TITLE_MUST_NOT_PROJECT',
    'PRIVATE_GENERIC_LEGACY_BODY_MUST_NOT_PROJECT',
    'fixture_source',
    'd1500000-0000-4000-8000-000000000001',
    'https://example.invalid/not-allowed',
    true
  );

select 'account_release_reconciliation_prestate_ok' as result;
