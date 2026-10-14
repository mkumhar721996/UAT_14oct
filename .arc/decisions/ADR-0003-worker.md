---
id: ADR-0003
category: component
title: Worker
status: accepted
superseded_by: null
component_id: comp_worker
responsibility: Background processing for notifications/alerts delivery, scheduled
  report generation, async workflow steps and external system sync jobs.
kind: worker
split_reason: One worker for all background jobs at this stage; split only if a job's
  own NFR later diverges.
talks_to:
- component_id: comp_job_queue
  interaction: async
  evidence: Worker consumes jobs enqueued by the API Service.
- component_id: comp_relational_database
  interaction: shared-storage
  evidence: Background jobs read/write workflow, task and reporting data.
- component_id: comp_object_storage
  interaction: shared-storage
  evidence: Report generation and document-related background jobs read/write files.
- component_id: comp_email_delivery
  interaction: sync
  evidence: Worker dispatches notification/alert emails via Amazon SES.
evidence: 'User: ''Notifications and alerts'', ''Reporting and analytics'', ''Integration
  with external systems'''
---

## Context

User: 'Notifications and alerts', 'Reporting and analytics', 'Integration with external systems'

## Decision

Background processing for notifications/alerts delivery, scheduled report generation, async workflow steps and external system sync jobs.

Kept separate because One worker for all background jobs at this stage; split only if a job's own NFR later diverges..

## Talks to

- **Job Queue** (async) — Worker consumes jobs enqueued by the API Service.
- **Relational Database** (shared-storage) — Background jobs read/write workflow, task and reporting data.
- **Object Storage** (shared-storage) — Report generation and document-related background jobs read/write files.
- **Email Delivery** (sync) — Worker dispatches notification/alert emails via Amazon SES.
