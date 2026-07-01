"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/components/auth-provider"

type DocItem = {
  _id: string
  createdAt: string
  source?: string
  inputType?: string
}

export default function DocsHistoryPage() {
  const { user, loading } = useAuth()
  const [items, setItems] = useState<DocItem[]>([])

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const res = await fetch("/api/user/docs/recent")
      if (!res.ok) return
      const data = (await res.json()) as { items: DocItem[] }
      setItems(data.items || [])
    })()
  }, [user])

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="px-4 py-12">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">Docs</h1>
            <p className="text-muted-foreground">Recently summarized documents</p>
          </div>

          {!loading && !user && <Card className="p-6">Please login to view your docs.</Card>}

          {user && (
            <Card>
              <CardHeader>
                <CardTitle>Recent</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {items.length ? (
                  items.map((d) => (
                    <div key={d._id} className="text-sm flex items-center justify-between">
                      <div className="min-w-0 truncate">{d.source || "Document"}</div>
                      <div className="text-muted-foreground text-xs shrink-0 ml-4">
                        {new Date(d.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground">No docs yet.</div>
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
