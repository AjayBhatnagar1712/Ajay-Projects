import React from "react";
import { ChevronLeft, PhoneCall } from "lucide-react";
import { useLocation } from "wouter";
import OwnerLayout from "@/components/OwnerLayout";
import { Button } from "@/components/ui/button";

export default function OwnerTenantProfile() {
  const [, setLocation] = useLocation();

  return (
    <OwnerLayout>
      <div className="p-4 sm:p-8 max-w-5xl mx-auto">
        <button onClick={() => setLocation("/owner/tenants")} className="flex items-center gap-2 text-primary font-medium text-lg mb-6 hover:underline">
          <ChevronLeft size={20} /> Back to Dashboard
        </button>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mb-6 p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 bg-gray-100">
                <img src="https://ui-avatars.com/api/?name=Karthik+M&background=EBF4FF&color=1E40AF&size=128" alt="Karthik M." className="w-full h-full object-cover" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 mb-1">Karthik M.</h1>
                <p className="text-sm text-gray-500">Prestige Unit - 1806</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                    <span className="text-green-500">✓</span> Occupied
                  </span>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-gray-200 text-gray-700">
                    2 BHK independent
                  </span>
                </div>
              </div>
            </div>
            <div>
              <Button variant="outline" className="border-primary text-primary text-sm px-6">
                View documents
              </Button>
            </div>
          </div>

          <div className="mt-10 relative">
            <div className="h-2 bg-gray-200 rounded-full w-full">
              <div className="h-2 bg-blue-600 rounded-full" style={{ width: "55%" }}></div>
            </div>
            <div className="absolute top-1/2 left-[55%] -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white border-2 border-blue-600 text-blue-600 text-[10px] font-semibold rounded-full flex items-center justify-center shadow-sm">
              55%
            </div>
            <div className="flex justify-between mt-3 text-xs text-gray-500 font-medium">
              <span>05 Sept, 2025</span>
              <span>05 Aug, 2026</span>
            </div>
          </div>
        </div>

        <div className="mb-6 bg-white rounded-md border border-gray-200 p-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="w-10 h-10 rounded-full bg-blue-50 text-primary flex items-center justify-center shrink-0">
              <PhoneCall size={18} />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-gray-800">Need help with maintaining your property?</p>
              <p className="text-[11px] text-gray-500">Our Manager will help you out</p>
            </div>
          </div>
          <Button variant="outline" className="border-primary text-primary hover:bg-blue-50 text-xs px-6 h-8 rounded-sm">
            I'm interested
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 flex flex-col">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Property Maintenance</h2>
            <p className="text-xs text-gray-500 mb-2">Last inspection: 15 days ago</p>
            <p className="text-xs text-red-500 font-medium mb-6">1 active issues</p>

            <div className="space-y-4 flex-1">
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-sm text-gray-800">AC servicing - <span className="text-red-500 font-medium">Pending</span></span>
                <span className="text-[11px] text-gray-500 font-medium">15 Nov 2025</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-sm text-gray-800">Bathroom tap leak - <span className="text-green-600 font-medium">Resolved</span></span>
                <span className="text-[11px] text-gray-500 font-medium">3 Oct 2025</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-sm text-gray-800">Geyser not heating - <span className="text-green-600 font-medium">Resolved</span></span>
                <span className="text-[11px] text-gray-500 font-medium">21 Sep 2025</span>
              </div>
            </div>

            <button className="text-primary text-sm font-medium hover:underline w-full pt-4 mt-auto">
              View All Tickets
            </button>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 flex flex-col">
            <h2 className="text-base font-semibold text-gray-900 mb-6">Lease Information</h2>

            <div className="space-y-4 mb-8 flex-1">
              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-gray-500">Start Date</span>
                <span className="text-sm font-semibold text-gray-900">2025-05-01</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-gray-500">End Date</span>
                <span className="text-sm font-semibold text-gray-900">2026-08-28</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-gray-500">Duration</span>
                <span className="text-sm font-semibold text-gray-900">11 months</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-gray-500">Monthly Rent</span>
                <span className="text-sm font-semibold text-gray-900">₹28,000</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-gray-500">Deposit</span>
                <span className="text-sm font-semibold text-gray-900">₹56,000</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-gray-500">Lock-in</span>
                <span className="text-sm font-semibold text-gray-900">6 months</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-auto">
              <Button className="bg-blue-600 hover:bg-blue-700 w-full rounded text-sm">Start Renewal</Button>
              <Button variant="outline" className="border-gray-200 text-gray-700 hover:bg-gray-50 w-full rounded text-sm">Find New Tenant</Button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-6">Recent Payments</h2>
          <div className="space-y-4">
            {[
              { month: "Jan 2026", date: "Paid 3 Jan 2026", early: "2 days early", amount: "₹28,000" },
              { month: "Dec 2025", date: "Paid 4 Dec 2025", early: "1 days early", amount: "₹28,000" },
              { month: "Nov 2025", date: "Paid 8 Nov 2025", early: "1 days early", amount: "₹28,000" },
              { month: "Oct 2025", date: "Paid 5 Oct 2025", late: "3 days late", amount: "₹28,000" },
            ].map((p, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-gray-50">
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-0.5">{p.month}</p>
                  <p className="text-[11px] text-gray-500">
                    {p.date} | <span className={p.early ? "text-green-600" : "text-amber-500"}>{p.early || p.late}</span>
                  </p>
                </div>
                <div className="text-sm font-semibold text-gray-900">{p.amount}</div>
              </div>
            ))}
          </div>
          <button className="text-primary text-sm font-medium hover:underline w-full pt-4 text-center mt-2">
            View All Payment
          </button>
        </div>

      </div>
    </OwnerLayout>
  );
}
