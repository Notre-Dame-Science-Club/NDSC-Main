-- 35: registration completeness (B2)
-- A registration is COMPLETE once its path reached a terminal node. Only complete
-- rows count as registrations (CTA, dashboard, duplicate checks, admin, CSV, emails).
-- Idempotent and non-destructive; safe to re-run.

alter table activity_registrations
  add column if not exists completed_at timestamptz,
  add column if not exists terminal_node_id uuid;

-- Backfill (only rows not yet stamped).
-- 1) Legacy rows with no form graph: complete by definition.
update activity_registrations
   set completed_at = coalesce(created_at, now())
 where completed_at is null and form_graph_id is null;

-- 2) Graph rows: complete when the LAST submitted node is terminal or has no
--    enabled children.
with last_node as (
  select r.id as reg_id,
         (r.submitted_node_ids ->> (jsonb_array_length(r.submitted_node_ids) - 1))::uuid as node_id
    from activity_registrations r
   where r.completed_at is null
     and r.form_graph_id is not null
     and jsonb_typeof(r.submitted_node_ids) = 'array'
     and jsonb_array_length(r.submitted_node_ids) > 0
)
update activity_registrations r
   set completed_at = coalesce(r.created_at, now()),
       terminal_node_id = l.node_id
  from last_node l
  join form_nodes n on n.id = l.node_id
 where r.id = l.reg_id
   and (n.is_terminal
        or not exists (select 1 from form_nodes c where c.parent_id = n.id and c.enabled));

create index if not exists activity_registrations_completed_idx
  on activity_registrations (activity_session_id, completed_at)
  where completed_at is not null;
create index if not exists activity_registrations_terminal_idx
  on activity_registrations (terminal_node_id) where terminal_node_id is not null;
