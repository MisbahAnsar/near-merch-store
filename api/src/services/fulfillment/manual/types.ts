import { z } from 'every-plugin/zod';

export const MANUAL_PROVIDER_FIELDS = {
  notificationEmails: { label: 'Notification Emails', order: 1 },
  defaultLeadTimeMinDays: { label: 'Min Lead Time (days)', order: 2 },
  defaultLeadTimeMaxDays: { label: 'Max Lead Time (days)', order: 3 },
  autoAcceptPaidOrders: { label: 'Auto-Accept Paid Orders', order: 4 },
  notes: { label: 'Notes', order: 5 },
} as const;

export type ManualProviderFields = typeof MANUAL_PROVIDER_FIELDS;

export const ManualProviderSettingsSchema = z.object({
  notificationEmails: z.array(z.string().email()).default([]),
  ownerAccountIds: z.array(z.string()).default([]),
  replyToEmail: z.string().email().optional(),
  defaultLeadTimeMinDays: z.number().int().min(0).default(5),
  defaultLeadTimeMaxDays: z.number().int().min(0).default(10),
  autoAcceptPaidOrders: z.boolean().default(false),
  notes: z.string().optional(),
});

export type ManualProviderSettings = z.infer<typeof ManualProviderSettingsSchema>;