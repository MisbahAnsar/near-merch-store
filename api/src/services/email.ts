import { Context, Effect, Layer } from 'every-plugin/effect';

interface EmailNotification {
  to: string[];
  subject: string;
  body: string;
  replyTo?: string;
}

export class EmailService extends Context.Tag('EmailService')<
  EmailService,
  {
    readonly sendNotification: (notification: EmailNotification) => Effect.Effect<void, Error>;
  }
>() {}

export const EmailServiceLive = (config: { fromEmail: string }) =>
  Layer.effect(
    EmailService,
    Effect.gen(function* () {
      return {
        sendNotification: (notification) =>
          Effect.tryPromise({
            try: async () => {
              console.log(
                `[EmailService] Sending notification to: ${notification.to.join(', ')}\n` +
                `Subject: ${notification.subject}\n` +
                `From: ${config.fromEmail}\n` +
                (notification.replyTo ? `Reply-To: ${notification.replyTo}\n` : '') +
                `\n${notification.body}`
              );

              // TODO: Integrate with email provider (Resend, SendGrid, SES, etc.)
              // For now, log the notification. When a provider is configured,
              // replace this with the actual send call.
            },
            catch: (error) => new Error(`Failed to send email notification: ${error}`),
          }),
      };
    }),
  );