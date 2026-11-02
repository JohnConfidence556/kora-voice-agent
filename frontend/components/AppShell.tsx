"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House, LogOut, MessageSquareText, Phone, Receipt, WifiOff, Zap,
} from "lucide-react";
import Logo from "@/components/Logo";
import PendingOrders from "@/components/PendingOrders";
import { AccountProvider, useAccountState } from "@/lib/account";
import { ToastProvider } from "@/lib/toast";
import { initialFor } from "@/lib/format";

const NAV = [
  { href: "/dashboard", label: "Overview", short: "Home", icon: House, exact: true },
  { href: "/dashboard/recharge", label: "Recharge", short: "Recharge", icon: Zap, exact: false },
  { href: "/dashboard/assistant", label: "Assistant", short: "Chat", icon: MessageSquareText, exact: false },
  { href: "/dashboard/call", label: "Voice call", short: "Call", icon: Phone, exact: false },
  { href: "/dashboard/activity", label: "Activity", short: "Activity", icon: Receipt, exact: false },
];

function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your account">
      <div className="skel" style={{ height: 34, width: 260, marginBottom: 12 }} />
      <div className="skel" style={{ height: 18, width: 340, marginBottom: 28 }} />
      <div className="skel" style={{ height: 250, marginBottom: 20 }} />
      <div className="skel" style={{ height: 160 }} />
    </div>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const { status, profile, logout, retry } = useAccountState();
  const pathname = usePathname();

  const isActive = (item: (typeof NAV)[number]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <div className="app">
      <aside className="side">
        <Link href="/" className="side__brand" aria-label="Kora home">
          <Logo />
        </Link>

        <nav className="side__nav" aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="side__link"
              aria-current={isActive(item) ? "page" : undefined}
            >
              <item.icon size={20} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="side__foot">
          {profile && (
            <div className="who">
              <span className="who__avatar">{initialFor(profile.email)}</span>
              <span className="who__text">
                <span className="who__mail">{profile.email}</span>
                <span className="who__num">{profile.demo_number}</span>
              </span>
            </div>
          )}
          <button className="side__logout" onClick={logout}>
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="top">
          <Link href="/" className="top__brand" aria-label="Kora home">
            <Logo />
          </Link>
          <span className="pill pill--demo">Simulated data</span>
          <button className="iconBtn top__logout" onClick={logout} aria-label="Sign out">
            <LogOut size={18} />
          </button>
        </header>

        <PendingOrders />

        <div className="page">
          {status === "loading" && <PageSkeleton />}
          {status === "offline" && (
            <div className="offline">
              <WifiOff size={36} />
              <h1 className="offline__title">Can&apos;t reach the server</h1>
              <p>Your account didn&apos;t load. Check that the backend is running, then try again.</p>
              <button className="btn btn--primary" onClick={retry}>Try again</button>
            </div>
          )}
          {status === "ready" && children}
        </div>
      </div>

      <nav className="tabbar" aria-label="Main">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="tab"
            aria-current={isActive(item) ? "page" : undefined}
          >
            <item.icon size={22} />
            <span>{item.short}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AccountProvider>
        <Frame>{children}</Frame>
      </AccountProvider>
    </ToastProvider>
  );
}
