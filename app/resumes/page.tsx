"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/components/auth-provider"

type ResumeItem = {
  _id: string
  createdAt: string
  fileName?: string
  atsScore?: number
}

export default function ResumesPage() {
  const { user, loading } = useAuth()
  const [items, setItems] = useState<ResumeItem[]>([])

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const res = await fetch("/api/user/resumes/recent")
      if (!res.ok) return
      const data = (await res.json()) as { items: ResumeItem[] }
      setItems(data.items || [])
    })()
  }, [user])

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="px-4 py-12">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">Resumes</h1>
            <p className="text-muted-foreground">Your most recently generated resumes</p>
          </div>

          {!loading && !user && <Card className="p-6">Please login to view your resumes.</Card>}

          {user && (
            <Card>
              <CardHeader>
                <CardTitle>Latest 3</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {items.length ? (
                  items.slice(0, 3).map((r) => (
                    <div key={r._id} className="text-sm flex items-center justify-between">
                      <div className="min-w-0 truncate">{r.fileName || "Resume"}</div>
                      <div className="text-muted-foreground text-xs shrink-0 ml-4">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground">No resumes yet.</div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
