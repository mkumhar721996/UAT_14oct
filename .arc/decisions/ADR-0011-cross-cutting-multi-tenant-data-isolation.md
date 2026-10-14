---
id: ADR-0011
category: cross_cutting
title: 'Cross-cutting: Multi-tenant data isolation'
status: accepted
superseded_by: null
component_id: null
decision: Shared tables with a tenant_id column (logical isolation); API Service must
  enforce tenant scoping on every query/request to prevent cross-tenant data leakage.
evidence: 'User: ''Shared tables with a tenant_id column (logical tenant isolation).'''
contested: true
alternatives_considered:
- "Schema per tenant \u2014 stronger isolation but higher operational/migration overhead"
- "Database per tenant \u2014 strongest isolation short of separate stacks but costly\
  \ at scale"
- "Separate stack per tenant \u2014 highest isolation and cost, unnecessary for this\
  \ platform's needs"
consequences:
- Lowest infrastructure cost and simplest operations
- "Isolation depends entirely on correct application-level enforcement in the API\
  \ Service \u2014 a bug risks cross-tenant data exposure"
- Easier to add new tenants without provisioning new infrastructure
---

## Context

User: 'Shared tables with a tenant_id column (logical tenant isolation).'

## Decision

Shared tables with a tenant_id column (logical isolation); API Service must enforce tenant scoping on every query/request to prevent cross-tenant data leakage.

## Alternatives considered

- Schema per tenant — stronger isolation but higher operational/migration overhead
- Database per tenant — strongest isolation short of separate stacks but costly at scale
- Separate stack per tenant — highest isolation and cost, unnecessary for this platform's needs

## Consequences

- Lowest infrastructure cost and simplest operations
- Isolation depends entirely on correct application-level enforcement in the API Service — a bug risks cross-tenant data exposure
- Easier to add new tenants without provisioning new infrastructure
