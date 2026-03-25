"use client";

import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { type Role } from "@/types";
import {
  ClipboardList,
  LayoutDashboard,
  Users,
  BookOpen,
  LogOut,
  History,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import clsx from "clsx";

interface NavBarProps {
  role: Role;
  name: string;
}

const navItems: Record<Role, { href: string; label: string; icon: React.ReactNode }[]> = {
  staff: [
    { href: "/dashboard", label: "My Timecard", icon: <ClipboardList className="w-5 h-5" /> },
    { href: "/history", label: "History", icon: <History className="w-5 h-5" /> },
  ],
  supervisor: [
    { href: "/supervisor", label: "Approvals", icon: <ShieldCheck className="w-5 h-5" /> },
    { href: "/history", label: "History", icon: <History className="w-5 h-5" /> },
  ],
  admin: [
    { href: "/admin", label: "Employees", icon: <Users className="w-5 h-5" /> },
    { href: "/admin/grants", label: "Grants", icon: <BookOpen className="w-5 h-5" /> },
    { href: "/admin/periods", label: "Pay Periods", icon: <LayoutDashboard className="w-5 h-5" /> },
    { href: "/supervisor", label: "Approvals", icon: <ShieldCheck className="w-5 h-5" /> },
  ],
};

export default function NavBar({ role, name }: NavBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const items = navItems[role];

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Top bar */}
      <header className="bg-[#1e3a5f] text-white px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
            <ClipboardList className="w-4 h-4" />
          </div>
          <span className="font-bold text-base tracking-tight">EffortLog</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-blue-200 hidden sm:block">{name}</span>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 text-xs text-blue-200 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:block">Sign out</span>
          </button>
        </div>
      </header>

      {/* Bottom tab bar (mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 flex sm:hidden">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "flex-1 flex flex-col items-center gap-1 py-2 text-xs transition-colors",
              pathname === item.href
                ? "text-[#1e3a5f] font-semibold"
                : "text-slate-400 hover:text-slate-600"
            )}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Sidebar (desktop) */}
      <aside className="hidden sm:flex flex-col w-56 bg-white border-r border-slate-200 min-h-screen fixed top-14 left-0 pt-6 px-3">
        <nav className="space-y-1">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                pathname === item.href
                  ? "bg-[#1e3a5f] text-white"
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
    </>
  );
}
