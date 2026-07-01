"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FileText, LinkIcon, Download, Eye, EyeOff, Loader2 } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function DocsPage() {
  const router = useRouter()
  const [inputType, setInputType] = useState<"url" | "pdf">("url")
  const [url, setUrl] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [showRaw, setShowRaw] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const { user } = useAuth()

  // TODO: Add auth middleware to protect this route
  // TODO: Add async queue for long-running summarization tasks

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) {
      setLoginOpen(true)
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const formData = new FormData()

      if (inputType === "url" && url) {
        formData.append("url", url)
        // Proxy to Python FastAPI endpoint
        const response = await fetch("/api/docs/summarize/url", {
          method: "POST",
          body: formData,
        })
        if (response.status === 401) {
          setLoginOpen(true)
          return
        }
        const data = await response.json()
        setResult(data)
      } else if (inputType === "pdf" && file) {
        formData.append("file", file)
        // Proxy to Python FastAPI endpoint
        const response = await fetch("/api/docs/summarize/pdf", {
          method: "POST",
          body: formData,
        })
        if (response.status === 401) {
          setLoginOpen(true)
          return
        }
        const data = await response.json()
        setResult(data)
      }
    } catch (error) {
      console.error("Summarization error:", error)
    } finally {
      setLoading(false)
    }
  }

  const downloadJSON = () => {
    if (!result) return
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "document-summary.json"
    a.click()
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <AlertDialog open={loginOpen} onOpenChange={setLoginOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Login required</AlertDialogTitle>
            <AlertDialogDescription>Please login to summarize documents.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setLoginOpen(false)
                router.push("/login")
              }}
            >
              Login
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <main className="px-4 py-12">
        <div className="mx-auto max-w-4xl space-y-8">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-balance">Document Summarizer</h1>
            <p className="text-muted-foreground text-lg">Upload a PDF or paste a URL to get an AI-powered summary</p>
          </div>

          {!loading && !result && (
            <Card className="p-6 space-y-6">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={inputType === "url" ? "default" : "outline"}
                  onClick={() => setInputType("url")}
                  className="flex-1"
                >
                  <LinkIcon className="size-4 mr-2" />
                  URL
                </Button>
                <Button
                  type="button"
                  variant={inputType === "pdf" ? "default" : "outline"}
                  onClick={() => setInputType("pdf")}
                  className="flex-1"
                >
                  <FileText className="size-4 mr-2" />
                  PDF Upload
                </Button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {inputType === "url" ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Documentation URL</label>
                    <Input
                      type="url"
                      placeholder="https://example.com/docs"
                      value={url}
                      onChange={(e) => {
                        const next = e.target.value
                        if (!user && next) {
                          setUrl("")
                          setLoginOpen(true)
                          return
                        }
                        setUrl(next)
                      }}
                      required
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Upload PDF</label>
                    <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                      <FileText className="size-12 mx-auto mb-4 text-muted-foreground" />
                      <Input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => {
                          if (!user) {
                            e.currentTarget.value = ""
                            setFile(null)
                            setLoginOpen(true)
                            return
                          }
                          setFile(e.target.files?.[0] || null)
                        }}
                        required
                        className="max-w-xs mx-auto"
                      />
                      {file && <p className="mt-2 text-sm text-muted-foreground">{file.name}</p>}
                    </div>
                  </div>
                )}

                <Button type="submit" className="w-full" size="lg">
                  Summarize Document
                </Button>
              </form>
            </Card>
          )}

          {loading && (
            <Card className="p-12 text-center space-y-4">
              <Loader2 className="size-12 mx-auto animate-spin text-primary" />
              <h2 className="text-xl font-semibold">Summarizing document...</h2>
              <p className="text-muted-foreground">This may take a moment</p>
            </Card>
          )}

          {result && !loading && (
            <div className="space-y-6">
              <div className="flex gap-2">
                <Button onClick={downloadJSON} variant="outline">
                  <Download className="size-4 mr-2" />
                  Download JSON
                </Button>
                <Button onClick={() => setShowRaw(!showRaw)} variant="outline">
                  {showRaw ? <EyeOff className="size-4 mr-2" /> : <Eye className="size-4 mr-2" />}
                  {showRaw ? "Hide" : "View"} Raw JSON
                </Button>
                <Button onClick={() => setResult(null)} variant="outline">
                  New Document
                </Button>
              </div>

              {showRaw ? (
                <Card className="p-6">
                  <pre className="text-xs overflow-auto max-h-96">{JSON.stringify(result, null, 2)}</pre>
                </Card>
              ) : (
                <div className="space-y-4">
                  {result.final_summary && (
                    <>
                      {result.final_summary.final_tldr && (
                        <Card className="p-6 bg-primary/5 border-primary/20">
                          <h3 className="text-sm font-semibold text-primary mb-2">TL;DR</h3>
                          <p className="text-lg">{result.final_summary.final_tldr}</p>
                        </Card>
                      )}

                      {result.final_summary.executive_summary && (
                        <Card className="p-6">
                          <h3 className="text-sm font-semibold mb-3">Executive Summary</h3>
                          <p className="leading-relaxed">{result.final_summary.executive_summary}</p>
                        </Card>
                      )}

                      {result.final_summary.top_bullets && result.final_summary.top_bullets.length > 0 && (
                        <Card className="p-6">
                          <h3 className="text-sm font-semibold mb-3">Key Points</h3>
                          <ul className="space-y-2">
                            {result.final_summary.top_bullets.map((bullet: string, idx: number) => (
                              <li key={idx} className="flex gap-2">
                                <span className="text-primary">•</span>
                                <span>{bullet}</span>
                              </li>
                            ))}
                          </ul>
                        </Card>
                      )}

                      {result.final_summary.combined_key_facts &&
                        result.final_summary.combined_key_facts.length > 0 && (
                          <Card className="p-6">
                            <h3 className="text-sm font-semibold mb-3">Key Facts</h3>
                            <div className="space-y-3">
                              {result.final_summary.combined_key_facts.map((fact: any, idx: number) => (
                                <div key={idx} className="border-l-2 border-primary/30 pl-4">
                                  <p className="font-medium">{fact.fact}</p>
                                  {fact.source_snippet && (
                                    <p className="text-sm text-muted-foreground mt-1">"{fact.source_snippet}"</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </Card>
                        )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
