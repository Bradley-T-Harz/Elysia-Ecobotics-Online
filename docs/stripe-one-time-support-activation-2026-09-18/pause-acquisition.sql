-- Preserve processing of existing obligations; only close acquisition.
begin;
update private.economic_feature_flags set enabled=false,updated_at=now() where feature_key='support_checkout';
insert into private.economic_audit_events(actor_kind,action,target_type,reason,metadata) values('system','one_time_support_acquisition_paused','economic_feature_flag','owner_authorized_activation_rollback','{"lane":"support_checkout","processingRetained":true}'::jsonb);
commit;
