---
id: ADR-0010
category: deployment_target
title: "Deployment target: AWS; all application services (Web App, API Service, Worker)\
  \ run as containers\u2026"
status: accepted
superseded_by: null
component_id: null
decision: 'AWS; all application services (Web App, API Service, Worker) run as containers
  on Amazon ECS Fargate; single AWS region initially, with the architecture designed
  to support future multi-region expansion. Managed backing services: Amazon RDS PostgreSQL
  16, Amazon S3, Amazon SQS, Amazon Cognito, Amazon SES; Amazon CloudWatch for monitoring
  and logging.'
evidence: 'User: ''Use Amazon Cognito...RDS PostgreSQL 16...S3...SQS...SES...CloudWatch...
  Deploy all application services as containers on Amazon ECS Fargate.'''
---

## Context

User: 'Use Amazon Cognito...RDS PostgreSQL 16...S3...SQS...SES...CloudWatch... Deploy all application services as containers on Amazon ECS Fargate.'

## Decision

AWS; all application services (Web App, API Service, Worker) run as containers on Amazon ECS Fargate; single AWS region initially, with the architecture designed to support future multi-region expansion. Managed backing services: Amazon RDS PostgreSQL 16, Amazon S3, Amazon SQS, Amazon Cognito, Amazon SES; Amazon CloudWatch for monitoring and logging.
