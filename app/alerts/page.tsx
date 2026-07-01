"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Briefcase, Rocket, Search, ExternalLink, MapPin, Building2, Calendar } from "lucide-react"

interface Job {
  apply_link: string
  company_name: string
  job_title: string
  description: string
  location: string
  posted_date: string
  keywords: string[]
}

interface Hackathon {
  Title: string
  Link: string
  createdAt: string
}

export default function AlertsPage() {
  const [keyword, setKeyword] = useState("")
  const [jobs, setJobs] = useState<Job[]>([])
  const [hackathons, setHackathons] = useState<Hackathon[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetchHackathons()
  }, [])

  async function fetchHackathons() {
    try {
      const response = await fetch("/api/alerts/hackathons?upcoming=true")
      if (!response.ok) throw new Error("Failed to fetch hackathons")

      const data = await response.json()
      setHackathons(data.hackathons || [])
    } catch (err) {
      console.error("Error fetching hackathons:", err)
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!keyword.trim()) return

    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/alerts/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword }),
      })

      if (!response.ok) throw new Error("Search failed")

      const data = await response.json()
      setJobs(data.results || [])

      if (data.results?.length === 0) {
        setError("No jobs found matching your search. Try different keywords.")
      }
    } catch (err) {
      setError("Failed to search jobs. Please try again.")
      console.error("Search error:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="px-4 py-12">
        <div className="mx-auto max-w-6xl space-y-12">
          <div className="space-y-4 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
              <Briefcase className="size-4" />
              Live Job Alerts & Opportunities
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-balance">Find Your Next Opportunity</h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Search through curated job postings and hackathons updated daily
            </p>
          </div>

          <section className="space-y-6">
            <div className="flex items-center gap-2">
              <Search className="size-5 text-primary" />
              <h2 className="text-2xl font-bold">Job Search</h2>
            </div>

            <Card className="p-6">
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="flex gap-3">
                  <Input
                    placeholder="Search by role, skill, or company (e.g., React Developer, Google)"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" size="lg" disabled={loading}>
                    {loading ? "Searching..." : "Search"}
                  </Button>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
              </form>

              {jobs.length > 0 && (
                <div className="mt-6 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Found {jobs.length} job{jobs.length !== 1 ? "s" : ""}
                  </p>
                  <div className="grid gap-4">
                    {jobs.map((job, index) => (
                      <Card key={index} className="p-4 hover:border-primary/50 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-2 flex-1">
                            <h3 className="font-semibold text-lg">{job.job_title}</h3>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Building2 className="size-4" />
                                {job.company_name}
                              </div>
                              <div className="flex items-center gap-1">
                                <MapPin className="size-4" />
                                {job.location}
                              </div>
                              <div className="flex items-center gap-1">
                                <Calendar className="size-4" />
                                {new Date(job.posted_date).toLocaleDateString()}
                              </div>
                            </div>
                            {job.description && (
                              <p className="text-sm text-muted-foreground line-clamp-3">{job.description}</p>
                            )}
                            {job.keywords && job.keywords.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {job.keywords.slice(0, 5).map((keyword, idx) => (
                                  <span key={idx} className="px-2 py-1 bg-muted text-muted-foreground text-xs rounded">
                                    {keyword}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <Button asChild variant="outline" size="sm">
                            <a href={job.apply_link} target="_blank" rel="noopener noreferrer">
                              Apply <ExternalLink className="ml-2 size-4" />
                            </a>
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </section>

          <section className="space-y-6">
            <div className="flex items-center gap-2">
              <Rocket className="size-5 text-primary" />
              <h2 className="text-2xl font-bold">Upcoming Hackathons & Opportunities</h2>
            </div>

            {hackathons.length === 0 ? (
              <Card className="p-8 text-center">
                <Rocket className="size-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">No hackathons available yet. Check back soon!</p>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {hackathons.map((hackathon, index) => (
                  <Card key={index} className="p-6 hover:border-primary/50 transition-colors">
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-semibold text-lg mb-2">{hackathon.Title}</h3>
                        <p className="text-sm text-muted-foreground">Added: {new Date(hackathon.createdAt).toLocaleDateString()}</p>
                      </div>

                      <Button asChild className="w-full bg-transparent" variant="outline">
                        <a href={hackathon.Link} target="_blank" rel="noopener noreferrer">
                          View Details <ExternalLink className="ml-2 size-4" />
                        </a>
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <Card className="p-6 bg-muted/30">
            <h3 className="font-semibold mb-2">Data Source</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Job postings and hackathons are synced daily from our curated Google Sheet via automated n8n workflows.
            </p>
            <p className="text-sm text-muted-foreground">
              Data includes opportunities from multiple platforms, updated every 24 hours.
            </p>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  )
}
