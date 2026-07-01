"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import type React from "react"
import { useState } from "react"
import { FileText, FileSearch, LogOut, MessageSquare, User } from "lucide-react"

import { useAuth } from "@/components/auth-provider"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"

export function UserSidePanel({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)

  if (!user) return null

  const initials = (user.name || user.email || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("")

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <div onClick={() => setOpen(true)}>{children}</div>
      <SheetContent side="left" className="p-0">
        <div className="p-4 border-b border-border">
          <SheetHeader className="p-0">
            <SheetTitle className="text-base">Account</SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex items-center gap-3">
            <Avatar className="size-10">
              <AvatarFallback className="text-sm font-medium">{initials || "U"}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{user.name || "User"}</div>
              <div className="text-xs text-muted-foreground truncate">{user.email}</div>
            </div>
          </div>
        </div>

        <div className="p-2">
          <Button asChild variant="ghost" className="w-full justify-start" onClick={() => setOpen(false)}>
            <Link href="/profile">
              <User className="size-4" />
              Profile
            </Link>
          </Button>
          <Button asChild variant="ghost" className="w-full justify-start" onClick={() => setOpen(false)}>
            <Link href="/resumes">
              <FileText className="size-4" />
              Resume
            </Link>
          </Button>
          <Button asChild variant="ghost" className="w-full justify-start" onClick={() => setOpen(false)}>
            <Link href="/chatbot">
              <MessageSquare className="size-4" />
              Chatbot
            </Link>
          </Button>
          <Button asChild variant="ghost" className="w-full justify-start" onClick={() => setOpen(false)}>
            <Link href="/docs/history">
              <FileSearch className="size-4" />
              Docs
            </Link>
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-start text-destructive hover:text-destructive"
            onClick={async () => {
              setOpen(false)
              await logout()
              router.push("/")
            }}
          >
            <LogOut className="size-4" />
            Logout
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
