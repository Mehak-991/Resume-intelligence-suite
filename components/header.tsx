"use client"

import Link from "next/link"
import { useState } from "react"
import { FileText, FileSearch, ImageIcon, Bell, Info, User, Menu, X, MessageSquare, Briefcase } from "lucide-react"
import { Logo } from "./logo"
import { useAuth } from "@/components/auth-provider"
import { UserSidePanel } from "@/components/user-side-panel"

const navItems = [
  { label: "Resume", href: "/resume", icon: FileText },
  { label: "Docs", href: "/docs", icon: FileSearch },
  { label: "Chatbot", href: "/chatbot", icon: MessageSquare },
  { label: "Interview Prep", href: "/interview-prep", icon: Briefcase },
  // { label: "Image Lab", href: "/image", icon: ImageIcon },
  { label: "Alerts", href: "/alerts", icon: Bell },
  { label: "About", href: "/about", icon: Info },
]

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { user, loading } = useAuth()

  return (
    <header className="w-full px-4 py-3">
      <div className="mx-auto flex items-center justify-between gap-4 rounded-2xl bg-card/80 backdrop-blur-sm border border-border px-4 py-2">
        <Link href="/" className="flex items-center gap-2">
          <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Logo className="size-6" />
          </div>
          <span className="font-semibold text-foreground hidden sm:inline">ResumeIQ</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {!loading && (
            <>
              {user ? (
                <UserSidePanel>
                  <button className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
                    <User className="size-4" />
                    {user.name || "Account"}
                  </button>
                </UserSidePanel>
              ) : (
                <Link
                  href="/login"
                  className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  <User className="size-4" />
                  Login
                </Link>
              )}
            </>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl hover:bg-secondary/50 transition-colors"
          >
            {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <nav className="md:hidden mt-2 mx-auto rounded-2xl bg-card/95 backdrop-blur-sm border border-border p-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
          {!loading && (
            <>
              {user ? (
                <UserSidePanel>
                  <button className="w-full flex items-center justify-center gap-2 px-4 py-3 mt-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium">
                    <User className="size-4" />
                    {user.name || "Account"}
                  </button>
                </UserSidePanel>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 mt-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
                >
                  <User className="size-4" />
                  Login
                </Link>
              )}
            </>
          )}
        </nav>
      )}
    </header>
  )
}
