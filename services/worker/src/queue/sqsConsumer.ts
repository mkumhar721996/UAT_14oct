import { DeleteMessageCommand, ReceiveMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import type { WorkerConfig } from '../config.js';
import { parseJobMessage, type JobMessage } from './parseJobMessage.js';

export type JobHandler = (job: JobMessage) => Promise<void>;

export class SqsConsumer {
  private readonly client: SQSClient;

  constructor(
    private readonly config: WorkerConfig,
    private readonly handleJob: JobHandler,
    client?: SQSClient,
  ) {
    this.client = client ?? new SQSClient({ region: config.awsRegion });
  }

  async pollOnce(): Promise<void> {
    const { Messages } = await this.client.send(
      new ReceiveMessageCommand({
        QueueUrl: this.config.queueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 10,
      }),
    );

    for (const message of Messages ?? []) {
      if (!message.Body || !message.ReceiptHandle) {
        continue;
      }

      await this.handleJob(parseJobMessage(message.Body));

      await this.client.send(
        new DeleteMessageCommand({
          QueueUrl: this.config.queueUrl,
          ReceiptHandle: message.ReceiptHandle,
        }),
      );
    }
  }
}
