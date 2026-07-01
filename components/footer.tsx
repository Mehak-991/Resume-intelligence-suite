"use client"

import Link from "next/link"
import { FileText } from "lucide-react"
import { motion } from "framer-motion"

const links = [
  { href: "/resume", label: "Resume" },
  { href: "/docs", label: "Docs" },
  { href: "/chatbot", label: "Chatbot" },
  { href: "/interview-prep", label: "Interview Prep" },
  { href: "/alerts", label: "Alerts" },
  { href: "/about", label: "About" },
]

export function Footer() {
  return (
    <footer className="px-4 py-12 border-t border-border">
      <div className="mx-auto max-w-6xl">
        <motion.div
          className="flex flex-col md:flex-row items-center justify-between gap-6"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {/* Brand */}
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-xl bg-primary flex items-center justify-center">
              <FileText className="size-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">ResumeIQ</span>
          </div>

          {/* Nav links */}
          <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            {links.map((link, i) => (
              <motion.div
                key={link.href}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.05 * i, duration: 0.4 }}
              >
                <Link href={link.href} className="hover:text-foreground transition-colors">
                  {link.label}
                </Link>
              </motion.div>
            ))}
          </nav>

          <p className="text-sm text-muted-foreground">© 2025 ResumeIQ. All rights reserved.</p>
        </motion.div>
      </div>
    </footer>
  )
}
