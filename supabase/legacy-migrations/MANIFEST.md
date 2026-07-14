# Legacy Supabase migration manifest

These files are immutable historical implementation records. Their names do not
use Supabase-compatible unique numeric versions: the CLI parsed every one as the
same version, `2026`. They were moved out of `supabase/migrations` without content
changes. Do not rename, edit, or execute them as an ordered migration chain.

The linked production project had no `supabase_migrations.schema_migrations`
table during the 2026-07-14 read-only inspection, so file-level application
history cannot be reconstructed safely. `Captured` below means the production
state relevant to that historical work is represented by
`20260714010000_remote_public_schema_baseline.sql`; it does not claim that the
named file itself was executed. The `Archive SHA-256` column records the full digest captured after the move,
and the database migration test verifies every file against the same fixed value.

| Historical filename | Archive SHA-256 | Approx. date | First repository commit | Known purpose | Known production state / exception |
|---|---|---:|---|---|---|
| `2026_06_02_profile_bootstrap_for_saved_addons.sql` | `8750ff6eec1865b10543353131654843411b1ceea27bef19f3933671edf99364` | 2026-06-02 | `902f83fccd3f` | Saved-add-on profile bootstrap | Captured; file-level application history unknown. |
| `2026_06_02_profile_sync_fields.sql` | `b8b2fac3e80b2e229d11a18289ee26b27423cfc7c229a125b36bf042a81d2ab2` | 2026-06-02 | `902f83fccd3f` | Profile synchronization fields | Captured; file-level application history unknown. |
| `2026_06_02_saved_addons_permissions.sql` | `15c01b906f7c5f029d696763b81e5b4bf3efc8a45654166107089132db92e4f6` | 2026-06-02 | `902f83fccd3f` | Saved-add-on grants and policies | Captured; file-level application history unknown. |
| `2026_06_10_commons_circle_homebase.sql` | `107a0b0646c1fe092bdfb006572790200ea0dde7218f709b800d8b8f565a2299` | 2026-06-10 | `02affac67202` | Commons Circle homebase | Captured; file-level application history unknown. |
| `2026_06_10_commons_circle_homebase_tables_fix.sql` | `8fa4c33b22386b3ef10a9f8885518e737207377a6c2c4bcd0555045cca426b92` | 2026-06-10 | `02affac67202` | Commons Circle table repair | Captured; file-level application history unknown. |
| `2026_06_10_commons_profile_setup_columns.sql` | `63d5fb852879da44febb730e1eb1c02bf8e3484d1228cebf58031140262d1ec7` | 2026-06-10 | `d2d7b4b9735f` | Commons profile setup fields | Captured; file-level application history unknown. |
| `2026_06_10_commune_future_account_mode.sql` | `7f90b49b3fc2b197da944244d23cbbc8e66c8c1f360cd764fae0014398dfcf6f` | 2026-06-10 | `02affac67202` | Commune future-account mode | Captured; file-level application history unknown. |
| `2026_06_10_governance_review_system.sql` | `d3d7fc8b10aa4a9201dd40813567efb93974dbd369e58fe302ef44ab29ed2f09` | 2026-06-10 | `02affac67202` | Governance/review system | Captured; file-level application history unknown. |
| `2026_06_10_marketplace_local_install_machinery.sql` | `b67ee9e7096db005b4758e5c00df44363491488d23f111f335370d2f0e859504` | 2026-06-10 | `02affac67202` | Marketplace local-install records | Captured; file-level application history unknown. |
| `2026_06_10_marketplace_saved_addons_and_install_intents_fix.sql` | `3b6c48c9a5ccacb7eb32f4cf6f7fc2b9de01b2309985e90e5138b69f95212f33` | 2026-06-10 | `02affac67202` | Marketplace saved/add-on intent repair | Captured; file-level application history unknown. |
| `2026_06_10_work_with_private_attachments.sql` | `4c43ebed4c7d49c2fae5d51fedcb14a5dea8d45471412d98da6e00a33bcae3e7` | 2026-06-10 | `fd266dc4150d` | Private Work With attachments | Captured; file-level application history unknown. |
| `2026_06_12_admin_moderation_completion_pass.sql` | `62a0a2f426ce3462d9b5dfb17e4a719c1239f17a8cf6b9558b140c0193baef2b` | 2026-06-12 | `53a6b42ec949` | Admin/moderation completion | Captured; file-level application history unknown. |
| `2026_06_12_commons_circle_badge_credits_system.sql` | `0b8e174141580b8343bb8ebcd9c6c172bbcf165584a827ff31059d46911301dd` | 2026-06-12 | `9b6b9e030177` | Badge-credit system | Captured; file-level application history unknown. |
| `2026_06_12_commons_circle_final_badge_definitions.sql` | `38731b526244153d7eae0fa154281e02302bdc0361abaca5f029fd3156675668` | 2026-06-12 | `9b6b9e030177` | Final badge definitions | Captured; file-level application history unknown. |
| `2026_06_12_commune_full_system.sql` | `e7380e18a58d8bd31abdb263de08d9fe650c8d7c19363a4c619c226b4bed71b6` | 2026-06-12 | `53a6b42ec949` | Core Commune schema/policies | Captured; file-level application history unknown. |
| `2026_06_12_developer_forge_full_system.sql` | `0dc80458dd2201c02a34ccfc524c5501bdcf1b7736ef9749dc0cd95c2b41568b` | 2026-06-12 | `9b6b9e030177` | Developer Forge schema/policies | Captured; file-level application history unknown. |
| `2026_06_12_zz_backfill_free_member_badges.sql` | `36e0ee27afedfcac14d8ca4e19e7244a96056bed97580ab1d037bac8903ce7df` | 2026-06-12 | `9b6b9e030177` | Free-member badge backfill | Captured; file-level application history unknown. |
| `2026_06_13_marketplace_publish_revoke_pipeline.sql` | `ded56233033b342499dbcd64f36c75502d87d29756c4f9b3137974f0b00fae00` | 2026-06-13 | `c058f7023838` | Marketplace publish/revoke pipeline | Captured; file-level application history unknown. |
| `2026_06_14_addon_archive_inspection_metadata.sql` | `ddd727bc80ba1b475d6bbbe2d24128399ac8beea2278b2e4282fec88669d1def` | 2026-06-14 | `c058f7023838` | Add-on archive inspection metadata | Captured; file-level application history unknown. |
| `2026_06_14_commune_collaborative_code_review.sql` | `453b0eb112a1a9b947ba0ad7e3baf371352017201b7274086985b3bab1fa1a8d` | 2026-06-14 | `98e72250d0d0` | Collaborative code review | Captured; file-level application history unknown. |
| `2026_06_14_commune_realtime_chat_moderation.sql` | `169366917059b67805b3ec23b888b205950ab077f7b603042916d5cd603d804d` | 2026-06-14 | `c058f7023838` | Realtime chat/moderation | Captured; file-level application history unknown. |
| `2026_06_14_sandbox_request_local_handoff.sql` | `4afaabe0c3c24dd7ab61a95f26c971fed38b31d693fdf9984e94118744ca856d` | 2026-06-14 | `98e72250d0d0` | Local sandbox handoff audit | Captured; file-level application history unknown. |
| `2026_06_21_commune_comment_direct_publish_policy.sql` | `7ef5aef56e881f18a799dca8170cf8fd038874326350d5eea036f5486f745b1f` | 2026-06-21 | `3952ec549c91` | Direct comment publish policy | Captured; file-level application history unknown. |
| `2026_06_21_commune_content_reactions.sql` | `366b01a33db7aecf0885dcae7da56a4b3c04616b3c093e68c341c0efb6d4570b` | 2026-06-21 | `d516bc5d75e6` | Commune reactions | Captured; file-level application history unknown. |
| `2026_06_21_commune_thread_participant_approvals.sql` | `26a69833e8e27330939615343a75eb7e215e4e3b4ad7dbd0bcef5c0d25193557` | 2026-06-21 | `d516bc5d75e6` | Thread participant approvals | Captured; file-level application history unknown. |
| `2026_06_22_commons_public_profile_fields.sql` | `5a24fa2f81bf71a20525f769f7f3b381b88c5cad0337263bf452916bfee42938` | 2026-06-22 | `0671f3a3a7ca` | Public Commons profile fields | Captured; file-level application history unknown. |
| `2026_06_22_commune_comment_notification_dependency_repair.sql` | `b5c738f4622a695c236f342466b75cba4684bc583fc3c1b5a47c705fecb14bd8` | 2026-06-22 | `4b1da072c913` | Comment notification dependency repair | Captured; file-level application history unknown. |
| `2026_06_22_commune_comments_schema_drift_repair.sql` | `6bc9b6cc7b73dc25c0ee9ad2c704142e2dad957bab53f357d58eea00a69eda4b` | 2026-06-22 | `9718bfa32c45` | Comment schema-drift repair | Captured; file-level application history unknown. |
| `2026_06_23_commune_room_post_admin_and_media_policy_repair.sql` | `b4c2ec51ce5aabafd619a3239d31b81808c591e3c92001cd011b9726eda7f59a` | 2026-06-23 | `97e1d4991925` | Room-post/admin/media policy repair | Captured; file-level application history unknown. |
| `2026_06_24_coding_cornucopia_runs_and_diagnostics.sql` | `da3a000897838dd5a04b09ee6c39c236aa56f27db106ee387d1b04cff541388e` | 2026-06-24 | `2ebb27d09da6` | Sandbox run/diagnostic records | Objects present in baseline; file-level application history unknown. |
| `2026_06_24_commune_published_media_display_policy.sql` | `1366c8e82be16d6b732d67fce83ec9ea4cc776546db3a6e98b7d9ee628a00352` | 2026-06-24 | `ee9c87744156` | Published media display policy | Captured; file-level application history unknown. |
| `2026_06_25_coding_cornucopia_author_revision_proposals.sql` | `e9ce3e57029b1a3dcf87c63a10ec42476f557dbfe98368b7db7b46e5a8714d74` | 2026-06-25 | `c7102ba23fb3` | Author revision proposals | Captured; file-level application history unknown. |
| `2026_06_25_coding_cornucopia_run_result_recording.sql` | `3b84d391e621304a5790569a98d4ee9abe1e05a2658b8a97cae3ddf2df6129dc` | 2026-06-25 | `c7102ba23fb3` | Legacy browser result-recording RPC | Function present live with unsafe PUBLIC execution; corrected migration revokes the exact overload. |
| `2026_06_26_elysia_iteration_showcase_structured_metadata.sql` | `06e06d3c9a0cb66507302433316b17b4edb156247c65be402e3ceea1e0df00de` | 2026-06-26 | `abf9d5bbe520` | Iteration Showcase metadata | Captured; file-level application history unknown. |
| `2026_06_26_job_post_structured_workflow.sql` | `2f867f447d25e63cfb69c46cbb88ee769cbf1c7a2079a4fba14570454d87e7a4` | 2026-06-26 | `60b0b56cc595` | Job Post structured workflow | Captured; file-level application history unknown. |
| `2026_06_26_official_update_structured_workflow.sql` | `73e157cfaa1158d94301cd47da30c7a11f6b93f3d05c7aa2c0ab82f0031d9390` | 2026-06-26 | `8c7b361682ce` | Official Update workflow | Captured; file-level application history unknown. |
| `2026_06_26_repository_showcase_structured_metadata.sql` | `9675a895b8aa12d672d2c0e3f50c2a499ad33351b2df9d970c603b92bc58d8e5` | 2026-06-26 | `2dffb2192eae` | Repository Showcase metadata | Malformed `DO` delimiter; read-only catalog inspection found its substantive effects absent. Superseded by `20260714020000_…_repair.sql`. |
| `2026_06_26_research_notes_structured_workflow.sql` | `ece0f2259d70d0c019bd929f2a372600088cd4232d67d4bdb170e8d53e55b4a2` | 2026-06-26 | `21e4336d42bf` | Research Notes workflow | Captured; file-level application history unknown. |
| `2026_06_26_troubleshooting_grove_structured_workflow.sql` | `793ba9f251e7e04a21e3ec731e260017b0db6972a9bbcaff565289ba861172b5` | 2026-06-26 | `493110147630` | Troubleshooting Grove workflow | Captured; file-level application history unknown. |
| `2026_06_27_developer_forge_submission_snapshots.sql` | `900bec1dc37014ed07bc16cfdb592744eedce49419987d20f3e65a51bb0dad6b` | 2026-06-27 | `789a34e0e982` | Forge submission snapshots | Captured; file-level application history unknown. |
| `2026_07_02_commons_banner_framing.sql` | `6e435fdbf593c9a94d049830df8f81bb249fb59a6728b018d839d84a09576c27` | 2026-07-02 | `45e571a97a8d` | Commons banner framing | Captured; file-level application history unknown. |
| `2026_07_05_01_commune_community_voting_room_enum.sql` | `66a833842c7f69cc18cdfabd21156eef12f5ffa69caebdc55d91cfe5611de47c` | 2026-07-05 | `27075d947a33` | Community Voting enum | Captured; file-level application history unknown. |
| `2026_07_05_02_commune_community_voting_room.sql` | `5f2541048ad522ec3462fe7e72322841496e6c97cd0f0db596e9d3b4244d5f24` | 2026-07-05 | `27075d947a33` | Community Voting room | Captured; file-level application history unknown. |
| `2026_07_07_commune_soft_delete_cleanup.sql` | `bbb93a056ccb4f7e4219c4817a8ae75a25e9ccfe80827cc3c4842a8aae3329f3` | 2026-07-07 | `0b305a95390e` | Commune soft-delete cleanup | Captured; file-level application history unknown. |
| `2026_07_08_commune_vote_delete_parent_filter.sql` | `05b9909c12aa66d5995e7b933b2c45473b6c34772a6b325de4bd6744e116b255` | 2026-07-08 | `1c850930f980` | Vote parent-delete filter | Captured; file-level application history unknown. |
| `2026_07_11_fix_commune_vote_soft_delete_rpc.sql` | `01639303ca2fcd36754dea8f51a4c8b71f452bcb3a2f31467d302db19ddcdec1` | 2026-07-11 | `6499429c805a` | Vote soft-delete RPC repair | Captured; file-level application history unknown. |
| `2026_07_13_sandbox_proxy_access_and_reservation.sql` | `0113cd913db0774227388fecdfbbb7f7e78de591d1e2a80f3b48f5564fb35145` | 2026-07-13 | `b79d2c049d6b` | Governed sandbox draft | Verified absent from production except pre-existing legacy RPC/tables; retained unchanged and superseded by `20260714030000_…sql`. |

The active order is intentionally only:

1. `20260714010000_remote_public_schema_baseline.sql`
2. `20260714015000_commune_reaction_counts_security_invoker.sql`
3. `20260714020000_repository_showcase_structured_metadata_repair.sql`
4. `20260714030000_sandbox_proxy_access_and_reservation.sql`
