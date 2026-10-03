"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Layers,
  Users,
  Settings,
  LogOut,
  Plus,
  Menu,
} from "lucide-react";
import { User } from "@/lib/types";
import { api } from "@/lib/api";
import DialogAccessibility from "./DialogAccessibility";
import ResponsiveTables from "./ResponsiveTables";
import InstallApp from "./InstallApp";
export default function Shell({
  children,
  adminOnly = false,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    if (!open) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  useEffect(() => {
    api<User>("/auth/me")
      .then((u) => {
        if (adminOnly && u.role !== "admin") router.replace("/");
        else setUser(u);
      })
      .catch(() => router.replace("/login"));
  }, [router, adminOnly]);
  if (!user) return <div className="loading">Loading workspace…</div>;
  const links = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/quotations", label: "Quotations", icon: FileText },
    { href: "/master-list", label: "Master List", icon: Layers },
    { href: "/customers", label: "Customers", icon: Users },
    ...(user.role === "admin"
      ? [
          { href: "/areas", label: "Areas & products", icon: Layers },
          {
            href: "/master-list/price-conflicts",
            label: "Price Conflicts",
            icon: Layers,
          },
          {
            href: "/master-list/import",
            label: "Excel imports",
            icon: FileText,
          },
          { href: "/settings", label: "Admin settings", icon: Settings },
        ]
      : []),
    { href: "/account", label: "My password", icon: Settings },
  ];
  return (
    <div className="workspace">
      <DialogAccessibility />
      <ResponsiveTables />
      {open && (
        <button
          className="nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={open ? "sidebar open" : "sidebar"}
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label="Workspace navigation"
        id="workspace-navigation"
      >
        <button
          className="drawer-close icon-button"
          aria-label="Close navigation menu"
          onClick={() => setOpen(false)}
        >
          ×
        </button>
        <Link href="/" className="brand">
          <img src="/api/branding/logo" alt="Casamelia International" />
          <span>QUOTATION SOFTWARE</span>
        </Link>
        <div className="nav-caption">WORKSPACE</div>
        <nav>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={
                (l.href === "/" ? path === "/" : path.startsWith(l.href))
                  ? "nav-link active"
                  : "nav-link"
              }
              onClick={() => setOpen(false)}
            >
              <l.icon size={18} />
              {l.label}
            </Link>
          ))}
        </nav>
        <InstallApp />
        <div className="sidebar-bottom">
          <span className="avatar">{user.username[0].toUpperCase()}</span>
          <div>
            <b>{user.username}</b>
            <small>
              {user.role === "admin" ? "Administrator" : "Sales Executive"}
            </small>
          </div>
          <button
            aria-label="Log out"
            className="icon-button"
            onClick={async () => {
              await api("/auth/logout", "POST");
              router.push("/login");
            }}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="main-wrap" inert={open ? true : undefined}>
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            aria-expanded={open}
            aria-controls="workspace-navigation"
            aria-label="Toggle menu"
            onClick={() => setOpen(!open)}
          >
            <Menu />
          </button>
          <span>CASAMELIA INTERNATIONAL</span>
          <Link href="/quotations/new" className="button small">
            <Plus size={16} /> New quotation
          </Link>
        </header>
        <main className="main">{children}</main>
        <footer className="app-footer">
          CASAMELIA INTERNATIONAL · Quotation workspace
        </footer>
      </div>
    </div>
  );
}
