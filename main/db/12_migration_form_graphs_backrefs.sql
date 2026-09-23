-- ============================================================================
-- Form-graph backref columns on the existing registration tables.
--
-- The flowchart form system (db/migration_form_graphs.sql) created
-- form_graphs + form_nodes. To make that data the source of truth for
-- future submissions while still letting the old v1 routes co-exist
-- (until they're retired), we add three columns to each registration
-- table:
--
--   form_graph_id      — which form graph this registration was created
--                        through (matches form_graphs.id)
--   form_node_id       — the leaf node whose submission wrote the row
--                        (matches form_nodes.id). For multi-step flows
--                        this is the terminal node.
--   submitted_node_ids — JSONB array of every node the user actually
--                        passed through on the way to the terminal.
--                        Used by the dashboard to reconstruct the flow.
--
-- These columns are nullable so the v1 routes (which still write to the
-- old category_id / olympiad_id path) keep working. The runner writes
-- the new columns when it sees a v2 graph.
--
-- Idempotent: safe to re-run.
-- ============================================================================

alter table activity_registrations
  add column if not exists form_graph_id     uuid references form_graphs(id) on delete set null,
  add column if not exists form_node_id      uuid references form_nodes(id)  on delete set null,
  add column if not exists submitted_node_ids jsonb default '[]'::jsonb;

create index if not exists activity_registrations_form_graph_idx
  on activity_registrations (form_graph_id);
create index if not exists activity_registrations_form_node_idx
  on activity_registrations (form_node_id);

alter table olympiad_registrations
  add column if not exists form_graph_id     uuid references form_graphs(id) on delete set null,
  add column if not exists form_node_id      uuid references form_nodes(id)  on delete set null,
  add column if not exists submitted_node_ids jsonb default '[]'::jsonb;

create index if not exists olympiad_registrations_form_graph_idx
  on olympiad_registrations (form_graph_id);
create index if not exists olympiad_registrations_form_node_idx
  on olympiad_registrations (form_node_id);
