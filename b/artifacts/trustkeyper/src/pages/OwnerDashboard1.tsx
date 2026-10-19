import React, { useEffect, useState } from "react";
import { Plus, MapPin, Building2, Wallet, Clock, AlertTriangle, ArrowRight, Wrench, PenTool, Check, Search, Bell, User } from "lucide-react";
import { Link, useLocation } from "wouter";
import OwnerLayout, { getOwnerName } from "@/components/OwnerLayout";
import { getProperties, type Property } from "@/lib/properties";
import { Button } from "@/components/ui/button";

export default function OwnerDashboard1() {
  const [, setLocation] = useLocation();
  const ownerName = getOwnerName();
  const [properties, setProperties] = useState<Property[]>([]);

  useEffect(() => {
    const all = getProperties();
    const ownerProps = all.filter(p => p.uploadedBy === "owner" || p.ownerName === ownerName);
    setProperties(ownerProps);
  }, [ownerName]);

  return (
    <OwnerLayout>
      <div className="p-6 sm:p-10 max-w-[1200px] mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-10">
          <h1 className="text-[28px] font-semibold text-[#2D3748]">
            Welcome back, {ownerName.replace("!", "")}!
          </h1>
          <Button
            onClick={() => setLocation("/owner/properties/add")}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 h-11 rounded-xl font-semibold flex items-center gap-2 shadow-lg shadow-primary/25 transition-all"
          >
            Add Property <Plus size={18} />
          </Button>
        </div>

        <div className="mb-10">
          <h2 className="text-[18px] font-semibold text-[#1A202C] mb-5">Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total Properties Card */}
            <div className="bg-white rounded-[24px] border border-gray-100 p-6 shadow-sm flex flex-col relative overflow-hidden transition-all hover:shadow-md">
              <div className="flex justify-between items-start mb-6">
                <p className="text-[14px] font-semibold text-gray-500">Total Properties</p>
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-primary">
                  <Building2 size={20} />
                </div>
              </div>
              <div className="mb-6">
                <h3 className="text-[34px] font-semibold text-[#1A202C] mb-1">50</h3>
                <p className="text-[13px] font-semibold text-gray-500">47 Occupied <span className="mx-1 text-gray-300">|</span> <span className="text-gray-400 font-medium">3 Vacant</span></p>
              </div>
              <div className="mt-auto">
                <div className="w-full bg-[#E2E8F0] rounded-full h-2.5 mb-2">
                  <div className="bg-[#2ECC71] h-2.5 rounded-full" style={{ width: "94%" }}></div>
                </div>
                <p className="text-[11px] font-semibold text-gray-400">94% occupied</p>
              </div>
            </div>

            {/* Monthly Revenue Card */}
            <div className="bg-white rounded-[24px] border border-gray-100 p-6 shadow-sm flex flex-col transition-all hover:shadow-md">
              <div className="flex justify-between items-start mb-6">
                <p className="text-[14px] font-semibold text-gray-500">Monthly Revenue</p>
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-[#2ECC71]">
                  <Wallet size={20} />
                </div>
              </div>
              <div className="mb-6">
                <h3 className="text-[34px] font-semibold text-[#1A202C] mb-1">₹14,28,000</h3>
                <p className="text-[13px] font-semibold">
                  <span className="text-[#2ECC71]">40 Paid</span> <span className="mx-1 text-gray-300">|</span> <span className="text-[#E74C3C]">7 Overdue</span>
                </p>
              </div>
              <div className="mt-auto">
                <Link href="/owner/finances" className="inline-flex items-center justify-center text-[12px] font-semibold text-primary bg-white border-2 border-primary/10 px-6 py-2 rounded-xl hover:bg-blue-50 transition-colors w-fit">
                  View Details
                </Link>
              </div>
            </div>

            {/* Open Tickets Card */}
            <div className="bg-[#FFF5F0] rounded-[24px] border border-[#FFE7DB] p-6 shadow-sm flex flex-col transition-all hover:shadow-md">
              <div className="flex justify-between items-start mb-6">
                <p className="text-[14px] font-semibold text-gray-500">Open Tickets</p>
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-[#E67E22]">
                  <AlertTriangle size={20} />
                </div>
              </div>
              <div className="flex gap-6 mb-6">
                <h3 className="text-[44px] font-semibold text-[#E67E22] leading-none">4</h3>
                <div className="flex flex-col gap-3 flex-1 justify-center">
                  <div className="flex items-center justify-between text-[11px] font-semibold">
                    <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#E74C3C]"></span> Urgent</span>
                    <span className="text-[#1A202C]">2</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-semibold">
                    <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#3B82F6]"></span> Work in Progress</span>
                    <span className="text-[#1A202C]">2</span>
                  </div>
                </div>
              </div>
              <div className="mt-auto">
                <Link href="/owner/tickets" className="inline-flex items-center justify-center text-[12px] font-semibold text-primary bg-white border-2 border-primary/10 px-6 py-2 rounded-xl hover:bg-blue-50 transition-colors w-fit">
                  View Details
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Your Properties Section */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[18px] font-semibold text-[#1A202C]">Your Properties</h2>
            <Link href="/owner/properties" className="text-[13px] font-semibold text-primary flex items-center gap-1 hover:underline">
              View all <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white rounded-[24px] border border-gray-100 overflow-hidden shadow-sm flex flex-col relative transition-all hover:shadow-lg hover:-translate-y-1">
              <div className="relative h-52 group">
                <img src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" alt="Property" className="w-full h-full object-cover" />
                <div className="absolute top-4 left-4 bg-[#2ECC71] text-white text-[10px] font-semibold px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-lg uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> Occupied
                </div>
              </div>
              <div className="p-6 flex flex-col flex-1">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-semibold text-[#1A202C] text-lg leading-tight">Prestige Unit 1806</h3>
                  <button className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-100 text-gray-400 hover:bg-gray-50 transition-colors">
                    <ArrowRight size={14} />
                  </button>
                </div>
                <p className="text-[12px] text-gray-500 font-medium flex items-center gap-1.5 mb-5">
                  <MapPin size={14} className="text-primary" /> Plot - 160 , nanakaram guda....
                </p>

                <div className="flex items-center gap-4 mb-6">
                  <div className="flex items-center gap-1.5 text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                    <Building2 size={14} className="text-primary" />
                    <span className="text-[11px] font-semibold">3 BHK</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                    <Clock size={14} className="text-primary" />
                    <span className="text-[11px] font-semibold">1200 sq.ft</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-primary text-[11px] font-semibold flex items-center justify-center">
                    AR
                  </div>
                  <span className="text-[13px] text-[#2D3748] font-semibold">Arjun Reddy</span>
                </div>
                
                <div className="mt-auto border-t border-gray-50 pt-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-[#1A202C] text-[20px]">
                      ₹32,583<span className="text-[12px] text-gray-400 font-semibold">/mo</span>
                    </p>
                    <p className="text-[10px] font-semibold text-[#2ECC71] mt-0.5 flex items-center gap-1">
                      <Check size={12} /> Rent received 7 days ago
                    </p>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[14px] font-semibold text-[#E67E22]">79/100</span>
                    <span className="text-[10px] text-gray-400 font-semibold">Trust Score</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity Section */}
        <div>
          <h2 className="text-[18px] font-semibold text-[#1A202C] mb-6">Recent Activity</h2>
          <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden mb-10">
            <div className="divide-y divide-gray-50">
              {/* Activity Items */}
              {[
                { time: "2h ago", icon: Wallet, color: "bg-green-50 text-[#2ECC71]", title: "Rent received", subtitle: "Prestige Lakeside Unit 1204", amount: "+₹28,000" },
                { time: "4h ago", icon: Wrench, color: "bg-blue-50 text-primary", title: "Repair ticket closed (AC Fixed)", subtitle: "Prestige Sunrise Unit 305" },
                { time: "5h ago", icon: AlertTriangle, color: "bg-orange-50 text-[#E67E22]", title: "Inspection alert: Minor leak detected", subtitle: "Prestige Heights Unit 1107" },
                { time: "1d ago", icon: PenTool, color: "bg-purple-50 text-[#9B59B6]", title: "New tenant moved in: Priya Sharma", subtitle: "Prestige Royale Unit 204" },
                { time: "1d ago", icon: Check, color: "bg-green-50 text-[#2ECC71]", title: "Rent received", subtitle: "Lodha Belleza Unit 401", amount: "+₹32,000" }
              ].map((activity, idx) => (
                <div key={idx} className="p-5 sm:px-8 flex items-center gap-6 hover:bg-gray-50/50 transition-colors cursor-pointer group">
                  <span className="text-[12px] font-semibold text-gray-400 w-14 text-right shrink-0">{activity.time}</span>
                  <div className={`w-10 h-10 rounded-xl ${activity.color} flex items-center justify-center shrink-0 border border-current opacity-80 group-hover:opacity-100 transition-opacity`}>
                    <activity.icon size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-[#1A202C] text-[15px]">{activity.title}</p>
                    <p className="text-[12px] font-semibold text-gray-500">{activity.subtitle}</p>
                  </div>
                  {activity.amount && (
                    <div className="text-[16px] font-semibold text-[#2ECC71] shrink-0">{activity.amount}</div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="border-t border-gray-50 p-4 text-center bg-gray-50/20">
              <button className="text-[13px] font-semibold text-primary hover:underline">View All Activity</button>
            </div>
          </div>
        </div>
      </div>
    </OwnerLayout>
  );
}
