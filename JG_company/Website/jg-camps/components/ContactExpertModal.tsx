"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, Mail, MessageCircle, Phone, Sparkles, X } from "lucide-react";
import { logLead } from "@/lib/logLead";

type Props = { open: boolean; onClose: () => void };

const PHONE_1 = "+918076874156";
const PHONE_2 = "+918595167227";
const EMAIL = "jgadven@gmail.com";
const WHATSAPP = "+918076874156";

function waLink(msg: string) {
  return `https://wa.me/${WHATSAPP.replace(/[^\d]/g, "")}?text=${encodeURIComponent(msg)}`;
}

export default function ContactExpertModal({ open, onClose }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const cleanPhoneLen = useMemo(() => phone.replace(/[^\d]/g, "").length, [phone]);
  const canSend = cleanPhoneLen >= 10;

  const mailHref = useMemo(
    () =>
      `mailto:${EMAIL}?subject=Trip%20help%20request&body=${encodeURIComponent(
        `Name: ${name || "-"}\nPhone: ${phone}\nDetails: ${note || "-"}`
      )}`,
    [name, phone, note]
  );

  async function submitCallback() {
    if (!canSend || submitting) return;
    setSubmitting(true);
    await logLead({ channel: "callback", name, phone, note, page: "contact-modal" });
    setSubmitting(false);
    setSubmitted(true);
  }

  function onCloseReset() {
    setSubmitted(false);
    setSubmitting(false);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onCloseReset} />

      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/20 bg-white shadow-2xl shadow-slate-950/30">
          <div className="flex items-start justify-between gap-4 bg-gradient-to-r from-emerald-950 to-emerald-700 px-6 py-5 text-white">
            <div className="flex gap-3">
              <div className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-amber-300 text-emerald-950">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xl font-black">Contact a Travel Expert</h3>
                <p className="mt-1 text-sm text-emerald-50/90">Get a quick callback, call directly, or send your trip details.</p>
              </div>
            </div>
            <button onClick={onCloseReset} className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid gap-5 p-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <a
                href={`tel:${PHONE_1}`}
                onClick={() => logLead({ channel: "call1", name, phone, note, page: "contact-modal" })}
                className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 hover:bg-emerald-100"
              >
                <Phone className="mb-3 h-5 w-5 text-emerald-800" />
                <div className="font-bold text-slate-950">Call</div>
                <div className="text-sm text-slate-600">8076874156</div>
              </a>
              <a
                href={`tel:${PHONE_2}`}
                onClick={() => logLead({ channel: "call2", name, phone, note, page: "contact-modal" })}
                className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 hover:bg-emerald-100"
              >
                <Phone className="mb-3 h-5 w-5 text-emerald-800" />
                <div className="font-bold text-slate-950">Call Alt</div>
                <div className="text-sm text-slate-600">8595167227</div>
              </a>
              <a
                href={waLink("Hi! I would like to plan a trip with Journey Gate.")}
                target="_blank"
                onClick={() => logLead({ channel: "whatsapp", name, phone, note, page: "contact-modal" })}
                className="rounded-2xl border border-amber-200 bg-amber-50 p-4 hover:bg-amber-100"
              >
                <MessageCircle className="mb-3 h-5 w-5 text-amber-700" />
                <div className="font-bold text-slate-950">WhatsApp</div>
                <div className="text-sm text-slate-600">Quick chat</div>
              </a>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              {submitted ? (
                <div className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-600" />
                  <div>
                    <div className="font-bold text-slate-950">Thanks, your request is logged.</div>
                    <p className="mt-1 text-sm text-slate-600">Our expert will call or WhatsApp you shortly.</p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input className="rounded-2xl border px-4 py-3 text-sm" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
                    <input className="rounded-2xl border px-4 py-3 text-sm" placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                  <textarea
                    className="min-h-[104px] rounded-2xl border px-4 py-3 text-sm"
                    placeholder="Tell us dates, places, headcount, budget, and travel style."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <a
                      href={
                        canSend
                          ? waLink(`Hi! I need help with my trip.\n\nName: ${name || "-"}\nPhone: ${phone}\nDetails: ${note || "-"}`)
                          : undefined
                      }
                      target="_blank"
                      onClick={() => canSend && logLead({ channel: "whatsapp-form", name, phone, note, page: "contact-modal" })}
                      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold ${
                        canSend ? "bg-emerald-800 text-white" : "pointer-events-none bg-slate-200 text-slate-500"
                      }`}
                    >
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp Now
                    </a>
                    <a
                      href={canSend ? mailHref : undefined}
                      onClick={() => canSend && logLead({ channel: "email", name, phone, note, page: "contact-modal" })}
                      className={`inline-flex items-center justify-center gap-2 rounded-full border px-5 py-3 text-sm font-bold ${
                        canSend ? "border-emerald-800 text-emerald-900" : "pointer-events-none border-slate-200 text-slate-500"
                      }`}
                    >
                      <Mail className="h-4 w-4" />
                      Email Details
                    </a>
                    <button
                      onClick={submitCallback}
                      disabled={!canSend || submitting}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-5 py-3 text-sm font-bold text-slate-900 disabled:opacity-50"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                      Request Callback
                    </button>
                  </div>

                  {!canSend && <p className="text-xs text-red-600">Enter a valid phone number to enable WhatsApp, email, or callback.</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
