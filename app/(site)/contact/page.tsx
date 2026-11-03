import type { Metadata } from "next";
import { connection } from "next/server";
import { getSettings } from "@/lib/settings";
import { Card, CardBody } from "@/components/ui/primitives";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Contact" };

export default async function ContactPage() {
  await connection();
  const settings = await getSettings();
  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-[1fr_300px]">
      <div>
        <h1 className="text-3xl font-bold text-ink">Contact Loso</h1>
        <p className="mt-2 text-muted">Questions, support requests, disputes or problems to report — send us a message.</p>
        <Card className="mt-6">
          <CardBody>
            <ContactForm />
          </CardBody>
        </Card>
      </div>
      <aside className="space-y-3 text-sm">
        <h2 className="font-semibold text-ink">Other ways to reach us</h2>
        {settings.supportPhone ? <p>Phone: <a className="text-brand underline" href={`tel:${settings.supportPhone}`}>{settings.supportPhone}</a></p> : null}
        {settings.supportEmail ? <p>Email: <a className="text-brand underline" href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a></p> : null}
        {!settings.supportPhone && !settings.supportEmail && <p className="text-muted">Support contact details will be published soon. Please use the form.</p>}
        <p className="text-muted">To report a specific profile, job or message, use the &ldquo;Report&rdquo; link on that item so moderators get the details.</p>
      </aside>
    </div>
  );
}
