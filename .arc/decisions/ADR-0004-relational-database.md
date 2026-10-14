---
id: ADR-0004
category: component
title: Relational Database
status: accepted
superseded_by: null
component_id: comp_relational_database
responsibility: Primary multi-tenant data store (Amazon RDS PostgreSQL 16) for organizations,
  users, roles/permissions, workflows, tasks and audit data; tenants are isolated
  logically via a tenant_id column on shared tables.
kind: infrastructure
split_reason: Backing service the project doesn't build itself.
evidence: 'User: ''Amazon RDS PostgreSQL 16 for the relational database.'''
---

## Context

User: 'Amazon RDS PostgreSQL 16 for the relational database.'

## Decision

Primary multi-tenant data store (Amazon RDS PostgreSQL 16) for organizations, users, roles/permissions, workflows, tasks and audit data; tenants are isolated logically via a tenant_id column on shared tables.

Kept separate because Backing service the project doesn't build itself..
