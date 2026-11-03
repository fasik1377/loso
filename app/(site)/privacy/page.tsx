import type { Metadata } from "next";
import { ProsePage } from "@/components/layout/prose-page";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <ProsePage title="Privacy policy" intro="How Loso collects, uses and protects personal information. This is a working draft and should be reviewed by legal counsel before launch.">
      <h2>Information we collect</h2>
      <ul>
        <li>Account details: name, phone number, optional email, and a securely hashed password.</li>
        <li>Profile information you choose to publish: skills, services, areas, photos, portfolio and work history.</li>
        <li>Verification documents (e.g. ID, certificates, business licenses) and payment references for registration.</li>
        <li>Activity on the platform: job applications, service requests, messages, reviews and reports.</li>
      </ul>
      <h2>How we use it</h2>
      <ul>
        <li>To operate the marketplace, verify accounts and prevent fraud.</li>
        <li>To show your public profile and connect you with customers and employers.</li>
        <li>To send in-app notifications about your account and activity.</li>
      </ul>
      <h2>Who can see what</h2>
      <ul>
        <li>Identity documents and payment proofs are private: only you and authorized Loso staff can view them.</li>
        <li>Your CV is shared only with employers whose job you apply to.</li>
        <li>Your phone number is shown only according to your visibility setting.</li>
        <li>Messages are visible only to conversation participants. Moderators may review a specific message only after it is reported.</li>
      </ul>
      <h2>Your choices</h2>
      <ul>
        <li>Edit your profile and contact visibility at any time in Settings.</li>
        <li>Request account deletion from Settings; we will process the request and retain only records required for legal, financial or safety reasons (for example, payment and audit records).</li>
      </ul>
      <h2>Security</h2>
      <p>Passwords are hashed, sessions are protected, uploaded files are type-checked and stored privately, and administrative actions are recorded in an audit log.</p>
    </ProsePage>
  );
}
