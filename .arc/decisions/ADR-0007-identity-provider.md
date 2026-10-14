---
id: ADR-0007
category: component
title: Identity Provider
status: accepted
superseded_by: null
component_id: comp_identity_provider
responsibility: Handles user authentication, SSO and identity/credential management
  for all tenants and user types via Amazon Cognito; issues tokens that the API Service
  validates for authorization and RBAC.
kind: managed_service
split_reason: Backing service the project uses but doesn't build; a managed identity
  provider was chosen over building auth in-house.
evidence: 'User: ''Use Amazon Cognito for identity and authentication.'''
---

## Context

User: 'Use Amazon Cognito for identity and authentication.'

## Decision

Handles user authentication, SSO and identity/credential management for all tenants and user types via Amazon Cognito; issues tokens that the API Service validates for authorization and RBAC.

Kept separate because Backing service the project uses but doesn't build; a managed identity provider was chosen over building auth in-house..
