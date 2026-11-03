"use client";

import { contactSupportAction } from "@/lib/actions/member";
import { ActionForm, Field, Input, SubmitButton, Textarea } from "@/components/ui/form";

export function ContactForm() {
  return (
    <ActionForm action={contactSupportAction} resetOnSuccess>
      <Field label="Your name" name="name" required>
        <Input name="name" required maxLength={100} autoComplete="name" />
      </Field>
      <Field label="Phone or email" name="contact" required hint="So we can reply to you.">
        <Input name="contact" required maxLength={120} />
      </Field>
      <Field label="Subject" name="subject" required>
        <Input name="subject" required maxLength={120} />
      </Field>
      <Field label="Message" name="message" required>
        <Textarea name="message" required rows={6} maxLength={3000} />
      </Field>
      <SubmitButton pendingText="Sending…">Send message</SubmitButton>
    </ActionForm>
  );
}
