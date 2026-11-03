import type { Metadata } from "next";
import { ProsePage } from "@/components/layout/prose-page";

export const metadata: Metadata = { title: "Terms of use" };

export default function TermsPage() {
  return (
    <ProsePage title="Terms of use" intro="The rules for using Loso. This is a working draft and should be reviewed by legal counsel before launch.">
      <h2>Accounts</h2>
      <ul>
        <li>You must provide accurate information and keep your password confidential.</li>
        <li>Worker accounts require a registration fee and identity verification before activation. The registration fee covers verification and is not a guarantee of work.</li>
        <li>Loso may suspend accounts that break these terms, with the reason recorded.</li>
      </ul>
      <h2>Services and jobs</h2>
      <ul>
        <li>Loso connects people; agreements about price, schedule and quality are between the customer and the worker, or between the employer and the candidate.</li>
        <li>Employers must post genuine vacancies and must not charge candidates fees to apply.</li>
        <li>Advertisements must be truthful and are clearly labelled as sponsored.</li>
      </ul>
      <h2>Reviews</h2>
      <ul>
        <li>Reviews must describe a real completed service. Fake, paid or retaliatory reviews are removed.</li>
      </ul>
      <h2>Prohibited behaviour</h2>
      <ul>
        <li>Fraud, harassment, discrimination, threats, spam, or sharing other people&apos;s private information.</li>
        <li>Attempting to bypass verification, access other users&apos; data, or interfere with the platform.</li>
      </ul>
    </ProsePage>
  );
}
