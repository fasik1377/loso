import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/layout/prose-page";

export const metadata: Metadata = { title: "Help center" };

const FAQ = [
  {
    q: "Why do workers pay a registration fee?",
    a: "The fee covers manual verification of each worker's identity and documents. The amount is set by Loso administrators and shown on your account status page before you pay.",
  },
  {
    q: "How long does verification take?",
    a: "After you submit your payment reference and identity document, a staff member reviews both. You will receive a notification with the decision. Paying alone does not activate an account — the documents must also be approved.",
  },
  {
    q: "Do customers pay to use Loso?",
    a: "No. Customer accounts are free. Payment for a service is agreed directly between you and the worker; Loso does not collect service payments.",
  },
  {
    q: "Who can review a worker?",
    a: "Only the customer of a service request that the customer confirmed as completed. Each completed request can be reviewed once.",
  },
  {
    q: "Who can see my phone number?",
    a: "You choose in Settings: nobody (messages only), only people you are working with, or any signed-in user. It is never shown to the public.",
  },
  {
    q: "How do employers publish jobs?",
    a: "Register as an employer, complete your company profile and submit your business documents. Once Loso verifies the company, you can publish vacancies.",
  },
];

export default function HelpPage() {
  return (
    <ProsePage title="Help center" intro="Answers to common questions about using Loso.">
      {FAQ.map((f) => (
        <section key={f.q}>
          <h2>{f.q}</h2>
          <p className="mt-1">{f.a}</p>
        </section>
      ))}
      <section id="safety" className="scroll-mt-20">
        <h2>Trust & safety tips</h2>
        <ul className="mt-2">
          <li>Keep conversations inside Loso until you trust the other person.</li>
          <li>Never send money in advance to someone you have not met for a job offer. Real employers do not charge application fees.</li>
          <li>Meet in safe, public places for interviews and agree on prices before work starts.</li>
          <li>Loso staff will never ask for your password.</li>
          <li>Use the &ldquo;Report&rdquo; link on any profile, job, review or message that seems fraudulent, abusive or unsafe.</li>
        </ul>
      </section>
      <p>
        Still need help? <Link href="/contact" className="text-brand underline">Contact us</Link>.
      </p>
    </ProsePage>
  );
}
