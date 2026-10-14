---
id: ADR-0002
category: component
title: API Service
status: accepted
superseded_by: null
component_id: comp_api_service
responsibility: Core business logic exposed as one unified API, internally organized
  by clear domain boundaries (auth/RBAC, multi-tenant data isolation, workflow and
  task management, document management metadata, reporting/analytics, notifications,
  external integrations).
kind: api_service
split_reason: Single API for all domains at this stage; no driver yet for splitting
  per domain.
talks_to:
- component_id: comp_relational_database
  interaction: shared-storage
  evidence: API Service owns workflow, RBAC and tenant data persisted relationally.
- component_id: comp_object_storage
  interaction: shared-storage
  evidence: Document and file management requires storing uploaded files.
- component_id: comp_job_queue
  interaction: async
  evidence: Workflow/notification/report jobs are handed off for background processing.
- component_id: comp_identity_provider
  interaction: sync
  evidence: API Service validates tokens and fetches identity/claims for RBAC enforcement.
evidence: 'User: ''Use one unified API initially, with clear domain boundaries internally.'''
contested: true
alternatives_considered:
- "Separate APIs per domain behind a gateway/BFF \u2014 more upfront complexity and\
  \ infrastructure not justified at this stage"
consequences:
- Simpler initial deployment and operations with a single deployable API
- Internal domain boundaries (modules) must be kept clean to allow splitting into
  separate services later if an NFR or scale driver emerges
---

## Context

User: 'Use one unified API initially, with clear domain boundaries internally.'

## Decision

Core business logic exposed as one unified API, internally organized by clear domain boundaries (auth/RBAC, multi-tenant data isolation, workflow and task management, document management metadata, reporting/analytics, notifications, external integrations).

Kept separate because Single API for all domains at this stage; no driver yet for splitting per domain..

## Talks to

- **Relational Database** (shared-storage) — API Service owns workflow, RBAC and tenant data persisted relationally.
- **Object Storage** (shared-storage) — Document and file management requires storing uploaded files.
- **Job Queue** (async) — Workflow/notification/report jobs are handed off for background processing.
- **Identity Provider** (sync) — API Service validates tokens and fetches identity/claims for RBAC enforcement.

## Alternatives considered

- Separate APIs per domain behind a gateway/BFF — more upfront complexity and infrastructure not justified at this stage

## Consequences

- Simpler initial deployment and operations with a single deployable API
- Internal domain boundaries (modules) must be kept clean to allow splitting into separate services later if an NFR or scale driver emerges
