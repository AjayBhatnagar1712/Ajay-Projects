import React, { useRef, useState } from "react";
import { ChevronDown, ChevronRight, Check, Plus, User } from "lucide-react";
import { getTenants, type Tenant } from "@/lib/tenants";
import { getOpenInquiriesForProperty, formatMemberContact } from "@/lib/ownerTenants";
import type { Property } from "@/lib/properties";

export interface AgreementParty {
  name: string;
  contact: string;
}

interface StepOwnerPartiesProps {
  property: Property | null;
  ownerName: string;
  ownerContact: string;
  primaryOwnerSelected: boolean;
  onPrimaryOwnerSelectedChange: (v: boolean) => void;
  additionalOwners: AgreementParty[];
  setAdditionalOwners: (v: AgreementParty[]) => void;
  selectedTenants: AgreementParty[];
  setSelectedTenants: (v: AgreementParty[]) => void;
  onManualTenantAdd?: (name: string, contact: string) => void;
  onContinue: () => void;
}

function PartyCard({ name, contact, badge, onRemove }: {
  name: string;
  contact: string;
  badge?: string;
  onRemove?: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border bg-white p-4 min-h-[88px] min-w-0 overflow-hidden ${
        badge ? "border-primary/30 bg-primary/5" : "border-gray-200"
      }`}
    >
      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
        <User size={16} className="text-gray-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
          {badge ? (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/15 text-primary uppercase tracking-wide">
              {badge}
            </span>
          ) : null}
        </div>
        <p className="text-xs text-gray-500 mt-0.5 break-words">{contact}</p>
      </div>
      {badge ? (
        <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0">
          <Check size={13} className="text-green-600" />
        </div>
      ) : (
        onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-red-500 font-medium hover:text-red-700 shrink-0 ml-1"
          >
            Remove
          </button>
        )
      )}
    </div>
  );
}

function InlinePartyForm({
  label,
  onAdd,
  onCancel,
}: {
  label: string;
  onAdd: (name: string, contact: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const digits = contact.replace(/\D/g, "").slice(0, 10);
  const canAdd = name.trim().length > 0 && digits.length === 10;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3 mb-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={`${label} name`}
        className="w-full h-9 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
      />
      <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
        <span className="px-3 h-9 flex items-center text-sm text-gray-500 border-r border-gray-200 bg-gray-50 shrink-0">
          +91
        </span>
        <input
          type="tel"
          inputMode="numeric"
          maxLength={10}
          value={digits}
          onChange={(e) => setContact(e.target.value.replace(/\D/g, "").slice(0, 10))}
          placeholder="10-digit number"
          className="flex-1 h-9 px-3 text-sm focus:outline-none"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (canAdd) onAdd(name.trim(), digits);
          }}
          disabled={!canAdd}
          className="px-5 h-9 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors"
        >
          Add
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 h-9 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function TenantPickList({
  listId,
  propertyId,
  selected,
  onSelect,
  onClose,
}: {
  listId: string;
  propertyId: string | undefined;
  selected: AgreementParty[];
  onSelect: (name: string, contact: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const inquiries = propertyId ? getOpenInquiriesForProperty(propertyId) : [];
  const leads = getTenants();
  const options = [
    ...inquiries.map((i) => ({ key: `inq-${i.id}`, name: i.name, phone: i.phone })),
    ...leads.map((t) => ({ key: `t-${t.id}`, name: t.name, phone: t.phone })),
  ].filter(
    (o, idx, arr) =>
      arr.findIndex((x) => x.name === o.name && x.phone === o.phone) === idx,
  );

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const filtered = options.filter((o) => {
    const q = query.toLowerCase();
    return o.name.toLowerCase().includes(q) || o.phone.includes(q);
  });

  return (
    <div
      ref={ref}
      className="absolute z-20 top-full mt-1 left-0 right-0 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden"
    >
      <div className="p-2 border-b border-gray-100">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tenants…"
          className="w-full h-8 px-3 rounded-md text-sm border border-gray-200 focus:outline-none focus:border-primary"
        />
      </div>
      <div className="max-h-44 overflow-y-auto" id={listId} role="listbox" aria-label="Tenant search results">
        {filtered.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-gray-400">No tenants found</div>
        ) : (
          filtered.map((o, i) => (
            <button
              key={o.key}
              type="button"
              role="option"
              disabled={selected.some((s) => s.name === o.name && s.contact.includes(o.phone.slice(-10)))}
              onClick={() => onSelect(o.name, o.phone)}
              className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors disabled:opacity-40 ${
                i > 0 ? "border-t border-gray-100" : ""
              }`}
            >
              <p className="text-sm font-medium text-gray-900">{o.name}</p>
              <p className="text-xs text-gray-400">{formatMemberContact(o.phone)}</p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function PrimaryOwnerSelectRow({
  name,
  contact,
  selected,
  onSelectedChange,
}: {
  name: string;
  contact: string;
  selected: boolean;
  onSelectedChange: (v: boolean) => void;
}) {
  return (
    <label
      className={`flex items-center gap-3 rounded-xl border p-4 min-h-[88px] cursor-pointer transition-colors min-w-0 overflow-hidden ${
        selected ? "border-primary/30 bg-primary/5" : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => onSelectedChange(e.target.checked)}
        className="w-4 h-4 rounded border-gray-300 text-primary accent-primary shrink-0"
      />
      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0 overflow-hidden">
        <User size={18} className="text-primary/70" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-900">{name || "Owner"}</p>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/15 text-primary uppercase tracking-wide">
            Primary
          </span>
        </div>
        {contact ? <p className="text-xs text-gray-500 mt-0.5 break-words">{contact}</p> : null}
      </div>
    </label>
  );
}

export function StepOwnerParties({
  property,
  ownerName,
  ownerContact,
  primaryOwnerSelected,
  onPrimaryOwnerSelectedChange,
  additionalOwners,
  setAdditionalOwners,
  selectedTenants,
  setSelectedTenants,
  onManualTenantAdd,
  onContinue,
}: StepOwnerPartiesProps) {
  const [showOwnerForm, setShowOwnerForm] = useState(false);
  const [tenantDropOpen, setTenantDropOpen] = useState(false);
  const [showTenantForm, setShowTenantForm] = useState(false);
  const tenantDropRef = useRef<HTMLDivElement>(null);

  const addOwner = (name: string, contact: string) => {
    setAdditionalOwners([
      ...additionalOwners,
      { name, contact: contact ? `+91 ${contact}` : "" },
    ]);
    setShowOwnerForm(false);
  };

  const removeOwner = (i: number) =>
    setAdditionalOwners(additionalOwners.filter((_, idx) => idx !== i));

  const addTenant = (name: string, contact: string) => {
    const formatted = contact.includes("+") ? contact : `+91 ${contact.replace(/\D/g, "").slice(-10)}`;
    if (!selectedTenants.find((s) => s.name === name)) {
      onManualTenantAdd?.(name, formatted);
      setSelectedTenants([...selectedTenants, { name, contact: formatted }]);
    }
    setTenantDropOpen(false);
    setShowTenantForm(false);
  };

  const addTenantManual = (name: string, contact: string) => {
    addTenant(name, contact);
  };

  const removeTenant = (i: number) =>
    setSelectedTenants(selectedTenants.filter((_, idx) => idx !== i));

  const canContinue = primaryOwnerSelected && selectedTenants.length > 0;

  return (
    <div className="max-w-3xl w-full mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-xl font-semibold text-gray-900">Rental Agreement Between</h2>
        <p className="text-sm text-gray-500 mt-1">Who will be part of this agreement?</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Owner(s)</p>
          <div className="space-y-4">

          <PrimaryOwnerSelectRow
            name={ownerName}
            contact={ownerContact}
            selected={primaryOwnerSelected}
            onSelectedChange={onPrimaryOwnerSelectedChange}
          />

          {additionalOwners.map((o, i) => (
            <PartyCard key={i} name={o.name} contact={o.contact} onRemove={() => removeOwner(i)} />
          ))}

          {showOwnerForm ? (
            <InlinePartyForm label="Owner" onAdd={addOwner} onCancel={() => setShowOwnerForm(false)} />
          ) : (
            <button
              type="button"
              onClick={() => setShowOwnerForm(true)}
              className="flex items-center justify-center gap-1.5 w-full h-9 rounded-xl border border-primary/40 text-sm text-primary font-medium hover:bg-primary/5 transition-colors"
            >
              <Plus size={14} /> Add New Owner
            </button>
          )}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Tenant(s)</p>
          <div className="space-y-4">

          {selectedTenants.map((t, i) => (
            <PartyCard key={i} name={t.name} contact={t.contact} onRemove={() => removeTenant(i)} />
          ))}

          <div ref={tenantDropRef} className="relative mb-3">
            <button
              type="button"
              onClick={() => {
                setTenantDropOpen((v) => !v);
                setShowTenantForm(false);
              }}
              aria-expanded={tenantDropOpen}
              aria-haspopup="listbox"
              aria-controls="owner-tenant-picker-list"
              aria-label="Choose a tenant"
              className="flex items-center justify-between w-full h-10 px-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-500 hover:border-primary/50 transition-colors"
            >
              <span>Choose a tenant…</span>
              <ChevronDown
                size={14}
                className={`text-gray-400 shrink-0 transition-transform ${tenantDropOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>
            {tenantDropOpen && (
              <TenantPickList
                listId="owner-tenant-picker-list"
                propertyId={property?.id}
                selected={selectedTenants}
                onSelect={addTenant}
                onClose={() => setTenantDropOpen(false)}
              />
            )}
          </div>

          {showTenantForm ? (
            <InlinePartyForm
              label="Tenant"
              onAdd={addTenantManual}
              onCancel={() => setShowTenantForm(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setShowTenantForm(true);
                setTenantDropOpen(false);
              }}
              className="flex items-center justify-center gap-1.5 w-full h-9 rounded-xl border border-primary/40 text-sm text-primary font-medium hover:bg-primary/5 transition-colors"
            >
              <Plus size={14} /> Add New Tenant
            </button>
          )}
          </div>
        </div>
      </div>

      <OwnerPartiesContinue onClick={onContinue} disabled={!canContinue} />
    </div>
  );
}

function OwnerPartiesContinue({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const cls = disabled
    ? "bg-primary/40 text-white cursor-not-allowed"
    : "bg-primary text-white hover:bg-primary/90";
  return (
    <>
      <div className="hidden sm:flex justify-center mt-6">
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={`flex items-center justify-center gap-2 w-48 h-11 rounded-xl text-sm font-semibold transition-colors ${cls}`}
        >
          Continue <ChevronRight size={16} />
        </button>
      </div>
      <div className="sm:hidden fixed inset-x-0 bottom-0 z-30 bg-white border-t border-gray-200 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={`flex items-center justify-center gap-2 w-full h-12 rounded-xl text-sm font-semibold transition-colors ${cls}`}
        >
          Continue <ChevronRight size={16} />
        </button>
      </div>
    </>
  );
}
