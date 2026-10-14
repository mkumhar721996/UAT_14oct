---
id: ADR-0001
category: component
title: Web App
status: accepted
superseded_by: null
component_id: comp_web_app
responsibility: Web application serving all user types (platform administrators, organization
  administrators, internal business users, external customers/partners) with RBAC-driven
  views for workflow management, document management, reporting/analytics and notifications.
kind: web_ui
split_reason: Single browser-based client for all user types; no distinct runtime
  or NFR yet justifies a separate client.
talks_to:
- component_id: comp_api_service
  interaction: sync
  evidence: Web App is the client for all user types; API Service holds the business
    logic.
- component_id: comp_identity_provider
  interaction: sync
  evidence: Users authenticate/log in through the identity provider's hosted or embedded
    flows.
evidence: 'User: ''multi-tenant SaaS platform... Primary user types: Platform Administrators,
  Organization Administrators, Internal Business Users, External Customers/Partners'''
---

## Context

User: 'multi-tenant SaaS platform... Primary user types: Platform Administrators, Organization Administrators, Internal Business Users, External Customers/Partners'

## Decision

Web application serving all user types (platform administrators, organization administrators, internal business users, external customers/partners) with RBAC-driven views for workflow management, document management, reporting/analytics and notifications.

Kept separate because Single browser-based client for all user types; no distinct runtime or NFR yet justifies a separate client..

## Talks to

- **API Service** (sync) — Web App is the client for all user types; API Service holds the business logic.
- **Identity Provider** (sync) — Users authenticate/log in through the identity provider's hosted or embedded flows.
