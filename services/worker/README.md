# comp_worker

Background worker: notification/alert delivery, scheduled report generation, async
workflow steps and external system sync jobs. Consumes jobs from Amazon SQS
(`comp_job_queue`).

## Commands

```bash
pnpm install
pnpm build      # compile TypeScript to dist/
pnpm test       # run unit tests (vitest)
pnpm typecheck  # type-check without emitting
pnpm dev        # run the worker locally with live reload
```

## Configuration

| Env var           | Required | Default     | Description                        |
|--------------------|----------|-------------|------------------------------------|
| `JOB_QUEUE_URL`     | yes      | —           | SQS queue URL to poll for jobs     |
| `AWS_REGION`        | no       | `us-east-1` | AWS region for the SQS client      |
| `POLL_INTERVAL_MS`  | no       | `5000`      | Delay between poll cycles (ms)     |
