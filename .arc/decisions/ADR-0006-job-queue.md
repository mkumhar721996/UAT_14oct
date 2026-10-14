---
id: ADR-0006
category: component
title: Job Queue
status: accepted
superseded_by: null
component_id: comp_job_queue
responsibility: Decouples the API Service from the Worker for asynchronous workflow
  steps, notification delivery and report generation jobs, using Amazon SQS.
kind: infrastructure
split_reason: Backing service needed to run background work asynchronously.
evidence: 'User: ''Amazon SQS for the job queue.'''
---

## Context

User: 'Amazon SQS for the job queue.'

## Decision

Decouples the API Service from the Worker for asynchronous workflow steps, notification delivery and report generation jobs, using Amazon SQS.

Kept separate because Backing service needed to run background work asynchronously..
