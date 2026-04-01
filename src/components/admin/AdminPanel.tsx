"use client";

import { useState } from "react";
import { DashboardTab } from "./tabs/DashboardTab";
import { MarginsTab } from "./tabs/MarginsTab";
import { PaymentsTab } from "./tabs/PaymentsTab";
import { WhatsAppTab } from "./tabs/WhatsAppTab";
import { ProductOverridesTab } from "./tabs/ProductOverridesTab";
import { HistoryTab } from "./tabs/HistoryTab";

const TABS = [
  {
    id: "resumo",
    label: "Resumo",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: "margens",
    label: "Margens",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: "pagamentos",
    label: "Pagamentos",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    id: "produtos",
    label: "Produtos",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    id: "historico",
    label: "Historico",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AdminPanel({ open, onClose }: Props) {
  const [activeTab, setActiveTab] = useState("resumo");

  if (!open) return null;

  const currentTab = TABS.find((t) => t.id === activeTab)!;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />

      <div className="fixed inset-0 z-[70] flex items-center justify-center md:p-6">
        <div className="relative w-full h-full md:max-w-5xl md:max-h-[90vh] md:rounded-2xl bg-white shadow-2xl flex flex-col md:flex-row overflow-hidden">
          {/* Desktop: sidebar tabs */}
          <nav className="hidden md:flex flex-col w-52 bg-gray-50 border-r border-gray-200 py-4">
            <div className="px-4 mb-6">
              <h2 className="text-lg font-black text-brand-500">Admin</h2>
              <p className="text-[10px] text-gray-400">Configuracoes do catalogo</p>
            </div>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm font-semibold transition-colors ${
                  activeTab === tab.id
                    ? "bg-brand-400/10 text-brand-500 border-r-2 border-brand-400"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Content area */}
          <main className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-gray-400 md:hidden">{currentTab.icon}</span>
                <h3 className="text-base font-bold text-gray-800">{currentTab.label}</h3>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 text-xl"
              >
                &times;
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 md:pb-6">
              {activeTab === "resumo" && <DashboardTab />}
              {activeTab === "margens" && <MarginsTab />}
              {activeTab === "pagamentos" && <PaymentsTab />}
              {activeTab === "whatsapp" && <WhatsAppTab />}
              {activeTab === "produtos" && <ProductOverridesTab />}
              {activeTab === "historico" && <HistoryTab />}
            </div>
          </main>

          {/* Mobile: bottom tab bar */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-[80]">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors ${
                  activeTab === tab.id
                    ? "text-brand-500"
                    : "text-gray-400"
                }`}
              >
                {tab.icon}
                <span className="text-[9px] font-semibold">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
}
