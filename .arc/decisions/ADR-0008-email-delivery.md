---
id: ADR-0008
category: component
title: Email Delivery
status: accepted
superseded_by: null
component_id: comp_email_delivery
responsibility: Sends transactional and notification emails on behalf of the Worker,
  using Amazon SES.
kind: managed_service
split_reason: Backing service the project uses but doesn't build, distinct role from
  object/job storage.
evidence: 'User: ''Amazon SES for email notifications.'''
---

## Context

User: 'Amazon SES for email notifications.'

## Decision

Sends transactional and notification emails on behalf of the Worker, using Amazon SES.

Kept separate because Backing service the project uses but doesn't build, distinct role from object/job storage..
