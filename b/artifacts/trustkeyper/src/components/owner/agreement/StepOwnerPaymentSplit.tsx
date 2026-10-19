import React, { useMemo } from "react";
import { ChevronRight, User } from "lucide-react";
import { FlowSegmentTabs } from "@/components/FlowSegmentTabs";
import { FLOW_STICKY_CONTENT_CLASS, FlowStickyActionBar } from "@/components/FlowStickyActionBar";
import type { AgreementParty } from "@/components/owner/agreement/StepOwnerParties";

export type RentSplitMode = "percent" | "amount";

export interface OwnerRentSplit {
  partyKey: string;
  name: string;
  contact: string;
  isPrimary: boolean;
  selected: boolean;
  value: string;
}

interface StepOwnerPaymentSplitProps {
  monthlyRent: string;
  splitMode: RentSplitMode;
  setSplitMode: (m: RentSplitMode) => void;
  splits: OwnerRentSplit[];
  setSplits: (s: OwnerRentSplit[]) => void;
  onContinue: () => void;
}

function parseNum(v: string): number {
  const n = Number(v.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatInr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export function buildOwnerRentSplits(
  primary: AgreementParty | null,
  additional: AgreementParty[],
  existing?: OwnerRentSplit[],
): OwnerRentSplit[] {
  const list: AgreementParty[] = [...(primary ? [primary] : []), ...additional];
  return list.map((o, i) => {
    const key = `${o.name}-${o.contact}-${i}`;
    const prev = existing?.find((s) => s.partyKey === key);
    return {
      partyKey: key,
      name: o.name,
      contact: o.contact,
      isPrimary: i === 0 && !!primary,
      selected: prev?.selected ?? true,
      value: prev?.value ?? "",
    };
  });
}

export function StepOwnerPaymentSplit({
  monthlyRent,
  splitMode,
  setSplitMode,
  splits,
  setSplits,
  onContinue,
}: StepOwnerPaymentSplitProps) {
  const totalRent = parseNum(monthlyRent);

  const { remaining, remainingLabel, canContinue } = useMemo(() => {
    const active = splits.filter((s) => s.selected);
    if (splitMode === "percent") {
      const used = active.reduce((sum, s) => sum + parseNum(s.value), 0);
      const left = Math.max(0, 100 - used);
      return {
        remaining: left,
        remainingLabel: (
          <>
            <span className="text-green-600 font-bold text-[24px] leading-none">{left}%</span>
            <span className="text-gray-500"> OF </span>
            <span className="text-green-600 font-bold text-[24px] leading-none">{formatInr(totalRent)}</span>
            <span className="text-gray-500"> IS REMAINING</span>
          </>
        ),
        canContinue: left === 0 && active.length > 0 && active.every((s) => parseNum(s.value) > 0),
      };
    }
    const used = active.reduce((sum, s) => sum + parseNum(s.value), 0);
    const left = Math.max(0, totalRent - used);
    return {
      remaining: left,
      remainingLabel: (
        <>
          <span className="text-green-600 font-bold text-[24px] leading-none">{formatInr(left)}</span>
          <span className="text-gray-500"> OF </span>
          <span className="text-green-600 font-bold text-[24px] leading-none">{formatInr(totalRent)}</span>
          <span className="text-gray-500"> IS REMAINING</span>
        </>
      ),
      canContinue: left === 0 && active.length > 0 && active.every((s) => parseNum(s.value) > 0),
    };
  }, [splits, splitMode, totalRent]);

  const updateSplit = (key: string, patch: Partial<OwnerRentSplit>) => {
    setSplits(splits.map((s) => (s.partyKey === key ? { ...s, ...patch } : s)));
  };

  return (
    <div className={`max-w-3xl w-full mx-auto ${FLOW_STICKY_CONTENT_CLASS}`}>
      <div className="text-center mb-8">
        <h2 className="text-xl font-semibold text-gray-900">Payment split between owners</h2>
        <p className="text-sm text-gray-500 mt-1">Who will receive the rent and how much?</p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <FlowSegmentTabs
          value={splitMode}
          onChange={setSplitMode}
          options={[
            { value: "percent", label: "Percentage %" },
            { value: "amount", label: "Exact Amount" },
          ]}
        />
        <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide text-right">
          {remainingLabel}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {splits.map((split, index) => (
          <div key={split.partyKey}>
            <p className="text-xs font-medium text-gray-500 mb-2">Owner {index + 1}</p>
            <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center gap-3 min-h-[88px]">
              <input
                type="checkbox"
                checked={split.selected}
                onChange={(e) => updateSplit(split.partyKey, { selected: e.target.checked })}
                className="w-4 h-4 rounded accent-primary shrink-0"
              />
              <div className="w-9 h-9 rounded-full bg-pink-50 flex items-center justify-center shrink-0">
                <User size={16} className="text-pink-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900 truncate">{split.name}</p>
                  {split.isPrimary ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/15 text-primary uppercase">
                      Primary
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center shrink-0 w-[88px] sm:w-[100px]">
                {splitMode === "percent" ? (
                  <input
                    type="text"
                    inputMode="numeric"
                    disabled={!split.selected}
                    value={split.value}
                    onChange={(e) =>
                      updateSplit(split.partyKey, {
                        value: e.target.value.replace(/[^\d]/g, "").slice(0, 3),
                      })
                    }
                    className="w-full h-10 px-2 rounded-lg border border-gray-200 bg-violet-50/80 text-sm text-center font-medium disabled:opacity-40 disabled:bg-gray-100"
                  />
                ) : (
                  <div
                    className={`flex items-center w-full h-10 rounded-lg border border-gray-200 overflow-hidden ${
                      split.selected ? "bg-violet-50/80" : "bg-gray-100 opacity-40"
                    }`}
                  >
                    <span className="px-2 text-sm text-gray-500 shrink-0">₹</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      disabled={!split.selected}
                      value={split.value}
                      onChange={(e) =>
                        updateSplit(split.partyKey, {
                          value: e.target.value.replace(/[^\d]/g, ""),
                        })
                      }
                      className="flex-1 h-full px-1 text-sm text-center font-medium bg-transparent focus:outline-none disabled:cursor-not-allowed"
                    />
                  </div>
                )}
                {splitMode === "percent" ? (
                  <span className="ml-1 text-sm text-gray-500 shrink-0">%</span>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden sm:flex justify-center">
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          className={`flex items-center justify-center gap-2 w-48 h-11 rounded-xl text-sm font-semibold transition-colors ${
            canContinue
              ? "bg-primary text-white hover:bg-primary/90"
              : "bg-gray-300 text-white cursor-not-allowed"
          }`}
        >
          Continue <ChevronRight size={16} />
        </button>
      </div>
      <FlowStickyActionBar>
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          className={`flex items-center justify-center gap-2 w-full h-10 rounded-[4px] text-sm font-semibold transition-colors ${
            canContinue
              ? "bg-primary text-white hover:bg-primary/90"
              : "bg-gray-300 text-white cursor-not-allowed"
          }`}
        >
          Continue <ChevronRight size={16} />
        </button>
      </FlowStickyActionBar>
    </div>
  );
}
