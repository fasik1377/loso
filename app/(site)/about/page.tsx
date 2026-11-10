import type { Metadata } from "next";
import { ProsePage } from "@/components/layout/prose-page";
import { marketConfig } from "@/lib/config";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <ProsePage title="About Looso" intro={marketConfig.supportingMessage}>
      <p>
        Looso is a local jobs and services marketplace built for {marketConfig.defaultCity}. It helps skilled workers and job seekers find opportunities,
        helps customers find trusted professionals for everyday tasks, and helps employers recruit qualified people.
      </p>
      <h2>What makes Looso different</h2>
      <ul>
        <li>Workers are activated only after Looso staff confirm their registration payment and review their identity documents.</li>
        <li>Reviews come only from customers whose service request was actually completed — one review per job.</li>
        <li>Phone numbers are private by default and shared according to each person&apos;s own settings.</li>
        <li>Every report of fraud, abuse or unsafe behaviour is reviewed by a moderator.</li>
      </ul>
      <h2>Where we operate</h2>
      <p>Looso currently serves {marketConfig.defaultCity}, {marketConfig.region}. The platform is designed to expand to other Ethiopian cities.</p>
    </ProsePage>
  );
}
