import React, { type ReactNode } from "react";
import { Link } from "wouter";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { ArrowLeft } from "lucide-react";

export interface LegalPageLayoutProps {
  title: string;
  children: ReactNode;
}

export function LegalPageLayout({ title, children }: LegalPageLayoutProps) {
  return (
    <MarketingLayout>
      <article className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16 lg:px-12">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-marketing-muted transition-colors hover:text-marketing-navy"
        >
          <ArrowLeft size={16} aria-hidden />
          Back to home
        </Link>
        <h1 className="text-3xl font-bold text-marketing-navy sm:text-4xl">{title}</h1>
        <div className="prose prose-headings:text-marketing-navy prose-p:text-marketing-body prose-li:text-marketing-body mt-8 max-w-none">
          {children}
        </div>
      </article>
      <MarketingFooter />
    </MarketingLayout>
  );
}
