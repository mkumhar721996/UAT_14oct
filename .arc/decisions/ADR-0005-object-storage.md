---
id: ADR-0005
category: component
title: Object Storage
status: accepted
superseded_by: null
component_id: comp_object_storage
responsibility: Stores uploaded documents and files for the document management feature,
  using Amazon S3.
kind: managed_service
split_reason: Backing service the project doesn't build itself; distinct storage role
  from the relational database.
evidence: 'User: ''Amazon S3 for object storage.'''
---

## Context

User: 'Amazon S3 for object storage.'

## Decision

Stores uploaded documents and files for the document management feature, using Amazon S3.

Kept separate because Backing service the project doesn't build itself; distinct storage role from the relational database..
