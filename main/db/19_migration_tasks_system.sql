-- Migration: Tasks System
-- Date: 2026-09-06
-- Description: Create tasks system for member dashboard with assignment tracking

-- Tasks table based on plan JSON structure
CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Task details
  task_name text NOT NULL,
  task_description text,
  task_department text, -- Department this task belongs to

  -- Scheduling
  task_start timestamptz DEFAULT now(),
  task_end timestamptz, -- Deadline

  -- Status
  task_is_complete boolean DEFAULT false,

  -- Assignment
  created_by uuid REFERENCES members(id) ON DELETE SET NULL,

  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Task assignments table (many-to-many: tasks can be assigned to multiple members)
CREATE TABLE task_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,

  -- Assignment tracking
  assigned_by uuid REFERENCES members(id) ON DELETE SET NULL,
  assigned_at timestamptz DEFAULT now(),

  -- Individual member status for this task
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'going', 'completed', 'passed')),
  completed_at timestamptz,

  -- Unique constraint: one assignment per member per task
  UNIQUE(task_id, member_id),

  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_tasks_department ON tasks(task_department);
CREATE INDEX idx_tasks_created_by ON tasks(created_by);
CREATE INDEX idx_tasks_end_date ON tasks(task_end) WHERE task_is_complete = false;

CREATE INDEX idx_task_assignments_task ON task_assignments(task_id);
CREATE INDEX idx_task_assignments_member ON task_assignments(member_id);
CREATE INDEX idx_task_assignments_status ON task_assignments(status);

-- Comments for documentation
COMMENT ON TABLE tasks IS 'Person-specific, assignable tasks system from plan JSON';
COMMENT ON COLUMN tasks.task_department IS 'Department: Administration, Project, Publication, ICT, LWS, Quiz, R&D';
COMMENT ON COLUMN task_assignments.status IS 'pending: not started, going: in progress, completed: done, passed: overdue/skipped';
