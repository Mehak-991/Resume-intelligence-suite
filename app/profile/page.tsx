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

type DocItem = {
  _id: string
  createdAt: string
  source?: string
  inputType?: string
}

export default function ProfilePage() {
  const { user, loading } = useAuth()
  const [resumes, setResumes] = useState<ResumeItem[]>([])
  const [docs, setDocs] = useState<DocItem[]>([])

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const [rRes, dRes] = await Promise.all([fetch("/api/user/resumes/recent"), fetch("/api/user/docs/recent")])
      if (rRes.ok) {
        const data = (await rRes.json()) as { items: ResumeItem[] }
        setResumes(data.items || [])
      }
      if (dRes.ok) {
        const data = (await dRes.json()) as { items: DocItem[] }
        setDocs(data.items || [])
      }
    })()
  }, [user])

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="px-4 py-12">
        <div className="mx-auto max-w-4xl space-y-8">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">Profile</h1>
            <p className="text-muted-foreground">Your activity overview</p>
          </div>

          {!loading && !user && <Card className="p-6">Please login to view your profile.</Card>}

          {user && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Account</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-sm">Email: {user.email}</div>
                  <div className="text-sm">Name: {user.name || "User"}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Current Resume</CardTitle>
                </CardHeader>
                <CardContent>
                  {resumes[0] ? (
                    <div className="text-sm">
                      {resumes[0].fileName || "Resume"} ({new Date(resumes[0].createdAt).toLocaleString()})
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">No resumes yet.</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recently Studied Docs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {docs.length ? (
                    docs.slice(0, 3).map((d) => (
                      <div key={d._id} className="text-sm">
                        {d.source || "Document"} ({new Date(d.createdAt).toLocaleString()})
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">No docs yet.</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Alerts</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">Coming soon</CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
