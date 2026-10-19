import React from "react";
import { IndianRupee, Clock, CheckCircle2 } from "lucide-react";
import BrokerLayout from "@/components/BrokerLayout";

const stats = [
  { id: "earned", label: "Total Earned", value: "0", icon: IndianRupee, iconColor: "text-accent" },
  { id: "pending", label: "Pending", value: "0", icon: Clock, iconColor: "text-orange-400" },
  { id: "avg", label: "Avg per Deal", value: "0", icon: CheckCircle2, iconColor: "text-primary" },
];

export default function BrokerCommission() {
  return (
    <BrokerLayout>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Commission Tracker</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.id}
              className="rounded-xl border border-gray-200 bg-white p-6"
            >
              <div className="flex items-center gap-2 mb-3">
                <Icon size={16} className={s.iconColor} />
                <span className="text-sm text-gray-500">{s.label}</span>
              </div>
              <p className="text-3xl font-semibold text-gray-900">{s.value}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            Commission History
          </h2>
        </div>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-10 h-10 flex items-center justify-center text-gray-400 mb-3">
            <IndianRupee size={26} />
          </div>
          <p className="text-gray-500 font-medium mb-1">No commissions yet</p>
          <p className="text-sm text-gray-400">
            You'll see your earnings here once deals are completed
          </p>
        </div>
      </div>
    </BrokerLayout>
  );
}
