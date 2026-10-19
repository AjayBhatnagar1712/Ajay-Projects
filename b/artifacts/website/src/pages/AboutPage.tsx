import React from "react";
import { LegalPageLayout } from "@/components/marketing/LegalPageLayout";
import { CONTACT } from "@/lib/marketingConstants";

export function AboutPage() {
  return (
    <LegalPageLayout title="About Us">
      <p>
        Founded in 2024, Trustkeyper was born out of a clear vision—to simplify property ownership
        for Non-Resident Indians (NRIs) and multi-property owners across India. Understanding the
        stress and complexity associated with remote property management, our goal is to offer
        reliable, transparent, and hassle-free property management solutions.
      </p>

      <h2>What We Do</h2>
      <p>
        Trustkeyper specializes in end-to-end property management services tailored specifically
        for overseas and multiple-property owners. Our comprehensive suite of services includes
        tenant acquisition and screening, rent and lease management, property maintenance, regular
        inspections, financial reporting, and dedicated support through an assigned property
        manager.
      </p>

      <h2>Why Trustkeyper?</h2>
      <ul>
        <li>Single-window Solution: One platform for all property management needs.</li>
        <li>Transparency: Real-time dashboards and clear communication.</li>
        <li>Reliability: Prompt rent collection and secure handling of finances.</li>
        <li>Personalized Care: Dedicated property managers for every client.</li>
      </ul>

      <h2>Our Mission</h2>
      <p>
        To deliver peace of mind and maximize returns for property owners through tech-enabled,
        professional, and transparent property management solutions.
      </p>

      <h2>Our Values</h2>
      <ul>
        <li>Integrity: Honesty and transparency in every interaction.</li>
        <li>Efficiency: Leveraging technology to ensure seamless operations.</li>
        <li>Client-Centric: Always prioritizing our client&apos;s peace of mind and satisfaction.</li>
      </ul>

      <h2>Contact Information</h2>
      <ul>
        <li>Email: {CONTACT.email}</li>
        <li>Phone: {CONTACT.phone}</li>
        <li>Website: www.trustkeyper.com</li>
      </ul>
    </LegalPageLayout>
  );
}
