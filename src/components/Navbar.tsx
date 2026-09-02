"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Ambulance,
  Building2,
  LogOut,
  Shield,
  Siren,
  Truck,
  User,
  Menu,
  X,
} from "lucide-react";
import { useState, useMemo } from "react";

const roleConfig = {
  patient: {
    label: "Patient",
    color: "bg-red-500/15 text-red-300",
    icon: Siren,
    portalName: "SOS Portal",
  },
  driver: {
    label: "Driver",
    color: "bg-emerald-500/15 text-emerald-300",
    icon: Truck,
    portalName: "Driver HUD",
  },
  hospital: {
    label: "Hospital",
    color: "bg-blue-500/15 text-blue-300",
    icon: Building2,
    portalName: "ER Queue",
  },
  admin: {
    label: "Admin",
    color: "bg-purple-500/15 text-purple-300",
    icon: Shield,
    portalName: "Command Center",
  },
};

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const user = session?.user;
  const role = user?.role ?? "patient";
  const config = roleConfig[role] || roleConfig.patient;
  const RoleIcon = config.icon;

  // ═══ STRICT ROLE-BASED NAV LINKS ═══
  // Each role sees ONLY their own portal — zero cross-portal mixing
  const links = useMemo(() => {
    if (!user) return [];

    switch (user.role) {
      case "patient":
        // Patients only see the SOS Portal
        return [{ href: "/", label: "SOS Portal", icon: Siren }];

      case "driver":
        // Drivers only see their assigned vehicle HUD
        return [
          {
            href: `/driver/${user.vehicleNumber || "AMB-101"}`,
            label: "Driver HUD",
            icon: Truck,
          },
        ];

      case "hospital":
        // Hospital staff only see their ER queue
        return [
          {
            href: `/hospital/${user.hospitalId || "HOSP-001"}`,
            label: "ER Queue",
            icon: Building2,
          },
        ];

      case "admin":
        // Admins only see the command center
        return [{ href: "/admin", label: "Command Center", icon: Shield }];

      default:
        return [{ href: "/", label: "SOS Portal", icon: Siren }];
    }
  }, [user]);

  // Don't show navbar on login/register pages
  if (pathname === "/login" || pathname === "/register") {
    return null;
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo — always links to root (middleware routes to correct portal) */}
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
              <Ambulance className="h-5 w-5" />
            </div>
            <span className="text-lg font-black tracking-tight text-white hidden sm:block">
              Smart Ambulance
            </span>
          </Link>

          {/* Desktop Links — role-isolated */}
          <div className="hidden md:flex items-center gap-1">
            {links.map((link) => {
              const isActive =
                pathname === link.href ||
                (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-slate-800 text-white"
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                  }`}
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* User Section */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                {/* Role Badge */}
                <span
                  className={`hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${config.color}`}
                >
                  <RoleIcon className="h-3 w-3" />
                  {config.label}
                </span>

                {/* User Name + Email */}
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-sm text-slate-300 max-w-[140px] truncate">
                    {user.name}
                  </span>
                  <span className="text-xs text-slate-500 max-w-[140px] truncate">
                    {user.email}
                  </span>
                </div>

                {/* Sign Out */}
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:bg-slate-800 hover:text-white"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
                >
                  <User className="h-4 w-4" />
                  Staff Login
                </Link>
                <Link
                  href="/login"
                  className="flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-500"
                >
                  <Siren className="h-4 w-4" />
                  Request SOS
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden flex items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-slate-800"
            >
              {mobileOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu — role-isolated */}
      {mobileOpen && (
        <div className="border-t border-slate-800 bg-slate-950 px-4 py-3 md:hidden">
          {links.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/" && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                }`}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
