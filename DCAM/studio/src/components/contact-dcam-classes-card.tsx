'use client';

import Link from 'next/link';
import { GraduationCap, Mail, MessageSquareText, Phone, School } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const contactPhone = '9990653416';
const contactPhoneWithCountryCode = `91${contactPhone}`;
const contactEmail = 'dcamclassesiit@gmail.com';

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M12.04 2C6.55 2 2.08 6.43 2.08 11.88c0 1.74.46 3.43 1.34 4.93L2 22l5.33-1.38a10.08 10.08 0 0 0 4.71 1.18h.01c5.49 0 9.96-4.43 9.96-9.88C22 6.45 17.54 2 12.04 2Zm0 18.12h-.01a8.36 8.36 0 0 1-4.25-1.16l-.31-.18-3.16.82.85-3.06-.2-.32a8.15 8.15 0 0 1-1.27-4.34c0-4.52 3.74-8.2 8.35-8.2 2.23 0 4.33.86 5.9 2.41a8.11 8.11 0 0 1 2.45 5.83c0 4.52-3.74 8.2-8.35 8.2Zm4.58-6.14c-.25-.12-1.48-.72-1.71-.8-.23-.09-.4-.12-.56.12-.17.24-.65.79-.8.95-.15.17-.3.18-.55.06-.25-.12-1.06-.39-2.02-1.24-.75-.66-1.25-1.47-1.4-1.72-.15-.24-.02-.38.11-.5.12-.11.25-.29.38-.43.13-.15.17-.24.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.33-.77-1.82-.2-.48-.41-.41-.56-.42h-.48c-.17 0-.43.06-.66.31-.23.24-.87.84-.87 2.05 0 1.21.89 2.38 1.02 2.55.13.17 1.76 2.66 4.26 3.73.6.26 1.06.41 1.42.52.6.19 1.14.16 1.57.1.48-.07 1.48-.6 1.69-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.16-.48-.28Z"
      />
    </svg>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M21.93 4.35 18.7 19.58c-.24 1.08-.88 1.35-1.78.84l-4.92-3.63-2.37 2.28c-.26.26-.48.48-.99.48l.35-5.01 9.12-8.24c.4-.35-.09-.54-.61-.19l-11.27 7.1-4.85-1.52c-1.05-.33-1.08-1.05.22-1.55L20.56 2.5c.88-.33 1.65.2 1.37 1.85Z"
      />
    </svg>
  );
}

export default function ContactDcamClassesCard() {
  const contactActions = [
    {
      label: 'WhatsApp',
      href: `https://wa.me/${contactPhoneWithCountryCode}`,
      icon: WhatsAppIcon,
      className: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-50 hover:border-emerald-200/55 hover:bg-emerald-400/16',
    },
    {
      label: 'Telegram',
      href: `tg://resolve?phone=${contactPhoneWithCountryCode}`,
      icon: TelegramIcon,
      className: 'border-sky-300/25 bg-sky-400/10 text-sky-50 hover:border-sky-200/55 hover:bg-sky-400/16',
    },
    {
      label: 'Email',
      href: `mailto:${contactEmail}`,
      icon: Mail,
      className: 'border-cyan-300/25 bg-cyan-400/10 text-cyan-50 hover:border-cyan-200/55 hover:bg-cyan-400/16',
    },
    {
      label: 'Call',
      href: `tel:+${contactPhoneWithCountryCode}`,
      icon: Phone,
      className: 'border-amber-300/25 bg-amber-400/10 text-amber-50 hover:border-amber-200/55 hover:bg-amber-400/16',
    },
  ];

  return (
    <Dialog>
      <Card className="rounded-[34px] border-white/10 bg-[linear-gradient(150deg,rgba(8,25,39,0.98),rgba(8,42,52,0.88)_48%,rgba(8,18,31,0.98))] text-white shadow-[0_34px_110px_-62px_rgba(34,211,238,0.48)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5">
        <CardContent className="flex flex-col gap-5 p-6 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100">
            <MessageSquareText className="h-3.5 w-3.5 text-cyan-200" />
            Contact DCAM Classes
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              {contactActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={action.label}
                    asChild
                    title={action.label}
                    aria-label={action.label}
                    className={`h-11 w-11 rounded-full border p-0 ${action.className}`}
                  >
                    <a href={action.href} target={action.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
                      <Icon className="h-5 w-5" />
                      <span className="sr-only">{action.label}</span>
                    </a>
                  </Button>
                );
              })}
            </div>

            <DialogTrigger asChild>
              <Button className="h-11 rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 px-5 font-semibold text-slate-950 shadow-[0_18px_40px_-18px_rgba(56,189,248,0.95)] transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110">
                Contact DCAM Classes
              </Button>
            </DialogTrigger>
          </div>
        </CardContent>
      </Card>

      <DialogContent className="border-white/10 bg-[linear-gradient(155deg,rgba(11,22,37,0.98),rgba(10,44,59,0.94))] text-white shadow-[0_30px_90px_-42px_rgba(34,211,238,0.6)] sm:rounded-[28px]">
        <DialogHeader>
          <DialogTitle className="text-2xl text-white">Are you a student or teacher?</DialogTitle>
          <DialogDescription className="sr-only">Choose the correct DCAM Classes contact form.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            asChild
            className="h-12 rounded-2xl border border-cyan-300/25 bg-cyan-400/10 font-semibold text-cyan-50 hover:border-cyan-200/55 hover:bg-cyan-400/16"
          >
            <Link href="/student-enquiry?source=home">
              <GraduationCap className="h-4 w-4" />
              Student
            </Link>
          </Button>
          <Button
            asChild
            className="h-12 rounded-2xl border border-emerald-300/25 bg-emerald-400/10 font-semibold text-emerald-50 hover:border-emerald-200/55 hover:bg-emerald-400/16"
          >
            <Link href="/teacher-enquiry">
              <School className="h-4 w-4" />
              Teacher
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
