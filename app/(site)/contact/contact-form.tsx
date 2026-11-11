"use client";

import { contactSupportAction } from "@/lib/actions/member";
import { ActionForm, Field, Input, SubmitButton, Textarea } from "@/components/ui/form";

export interface ContactFormLabels {
  name: string;
  contact: string;
  contactHint: string;
  subject: string;
  message: string;
  send: string;
  sending: string;
}

const DEFAULT_LABELS: ContactFormLabels = {
  name: "Your name",
  contact: "Phone or email",
  contactHint: "So we can reply to you.",
  subject: "Subject",
  message: "Message",
  send: "Send message",
  sending: "Sending…",
};

export function ContactForm({ labels = DEFAULT_LABELS, defaultSubject }: { labels?: ContactFormLabels; defaultSubject?: string }) {
  return (
    <ActionForm action={contactSupportAction} resetOnSuccess>
      <Field label={labels.name} name="name" required>
        <Input name="name" required maxLength={100} autoComplete="name" />
      </Field>
      <Field label={labels.contact} name="contact" required hint={labels.contactHint}>
        <Input name="contact" required maxLength={120} />
      </Field>
      <Field label={labels.subject} name="subject" required>
        {/* Keyed so choosing another topic on the support page refreshes the prefilled subject. */}
        <Input key={defaultSubject ?? ""} name="subject" required maxLength={120} defaultValue={defaultSubject} />
      </Field>
      <Field label={labels.message} name="message" required>
        <Textarea name="message" required rows={6} maxLength={3000} />
      </Field>
      <SubmitButton pendingText={labels.sending}>{labels.send}</SubmitButton>
    </ActionForm>
  );
}
