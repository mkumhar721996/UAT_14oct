---
id: ADR-0009
category: nfr
title: "NFR: data residency \u2014 All tenant data remains within the selected single\
  \ AWS region; no additional\u2026"
status: accepted
superseded_by: null
dimension: data residency
metric: location of stored tenant data
threshold: All tenant data remains within the selected single AWS region; no additional
  regional residency requirements currently defined.
component_id: null
needs_dedicated_tracking: true
evidence: 'User: ''Tenant data must remain within the selected AWS region. No additional
  regional residency requirements are currently defined.'''
---

## Context

User: 'Tenant data must remain within the selected AWS region. No additional regional residency requirements are currently defined.'

## Decision

location of stored tenant data: All tenant data remains within the selected single AWS region; no additional regional residency requirements currently defined.
