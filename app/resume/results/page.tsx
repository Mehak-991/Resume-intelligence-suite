"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { StatsPanel } from "@/components/stats-panel"
import { Target, TrendingUp, CheckCircle2, AlertCircle, Download, MessageSquare, Sparkles, Mail } from "lucide-react"

type ResumeAnalysis = {
  _id: string
  createdAt: string
  fileName?: string
  atsScore?: number | null
  jdText?: string
  recruiterEmail?: string
  resumeUrl?: string
  parsed?: {
    overallATSScore?: number | null
    strengths?: string[]
    improvements?: string[]
    keywords?: string[]
    summary?: string | null
    performanceMetrics?: { parameter: string; score: number }[]
    actionItems?: string[]
    proTips?: string[]
    atsChecklist?: string[]
    optimizedResume?: string | null
  }
  optimizedResume?: string | null
}

function ResultsContent() {
  const searchParams = useSearchParams()
  const id = searchParams.get("id")

  const [loading, setLoading] = useState(false)
  const [item, setItem] = useState<ResumeAnalysis | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSendingColdMail, setIsSendingColdMail] = useState(false)
  const [coldMailMessage, setColdMailMessage] = useState<string | null>(null)
  const [assistantQuestion, setAssistantQuestion] = useState("")
  const [assistantAnswer, setAssistantAnswer] = useState<string | null>(null)
  const [assistantError, setAssistantError] = useState<string | null>(null)
  const [assistantLoading, setAssistantLoading] = useState(false)
  const [assistantUploaded, setAssistantUploaded] = useState(false)
  const [assistantSessionId] = useState(() => `results-assistant-${Date.now()}`)

  useEffect(() => {
    if (!id) {
      setErrorMessage("Missing resume id")
      return
    }
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      setErrorMessage("Invalid resume id")
      return
    }
    setLoading(true)
    setErrorMessage(null)
    ;(async () => {
      try {
        const res = await fetch(`/api/user/resumes/${encodeURIComponent(id)}`)
        if (!res.ok) {
          const raw = await res.text().catch(() => "")
          let message = `Request failed (${res.status})`
          try {
            const parsed = JSON.parse(raw) as { message?: string; error?: string }
            message = parsed.message || parsed.error || message
          } catch {
            if (raw) message = raw
          }
          setErrorMessage(message)
          return
        }
        const data = (await res.json()) as { item: ResumeAnalysis }
        setItem(data.item)
        // Debug: Log the retrieved data to check if recruiterEmail and resumeUrl are present
        console.log("Resume analysis data retrieved:", {
          recruiterEmail: data.item.recruiterEmail,
          resumeUrl: data.item.resumeUrl,
          fileName: data.item.fileName,
          hasRecruiterEmail: !!data.item.recruiterEmail,
          hasResumeUrl: !!data.item.resumeUrl,
          shouldShowButton: !!(data.item.recruiterEmail && data.item.resumeUrl)
        })
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  const atsPercent = useMemo(() => {
    if (typeof item?.atsScore === "number") return item.atsScore
    const overall = item?.parsed?.overallATSScore
    if (typeof overall === "number") return Math.round(overall * 10)
    return null
  }, [item])

  const strengths = item?.parsed?.strengths || []
  const improvements = item?.parsed?.improvements || []
  const summary = item?.parsed?.summary || ""
  const optimizedResume = item?.optimizedResume || item?.parsed?.optimizedResume || ""

  const performanceStats = useMemo(() => {
    const metrics = item?.parsed?.performanceMetrics || []
    return metrics.slice(0, 5).map((m) => ({
      label: m.parameter,
      value: Math.max(0, Math.min(10, Math.round(m.score))),
      max: 10,
    }))
  }, [item])

  const downloadOptimizedResume = () => {
    if (!optimizedResume) return
    const blob = new Blob([optimizedResume], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `optimized_resume${item?.fileName ? "_" + item.fileName.replace(/\.[^/.]+$/, "") : ""}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const ensureAssistantUpload = async () => {
    if (assistantUploaded || !item?.resumeUrl) return

    const resumeUrl = item.resumeUrl
    const fileName = item.fileName || "resume.pdf"

    const response = await fetch(resumeUrl)
    if (!response.ok) {
      throw new Error("Failed to fetch resume for assistant")
    }
    const blob = await response.blob()

    const file = new File([blob], fileName, {
      type: blob.type || "application/pdf",
    })

    const formData = new FormData()
    formData.append("files", file)

    const uploadResponse = await fetch("/api/chatbot/upload", {
      method: "POST",
      body: formData,
    })

    if (!uploadResponse.ok) {
      const errorBody = await uploadResponse.text().catch(() => "")
      console.error("Assistant upload error:", errorBody)
      throw new Error("Failed to prepare resume for assistant")
    }

    setAssistantUploaded(true)
  }

  const handleAssistantSend = async () => {
    if (!assistantQuestion.trim() || assistantLoading) return

    if (!item?.resumeUrl) {
      setAssistantError("Resume is not available for this analysis.")
      return
    }

    setAssistantLoading(true)
    setAssistantError(null)

    try {
      await ensureAssistantUpload()

      const response = await fetch("/api/chatbot/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: assistantQuestion,
          session_id: assistantSessionId,
        }),
      })

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "")
        console.error("Assistant query error:", errorBody)
        throw new Error("Failed to get answer from assistant")
      }

      const data = (await response.json()) as { answer?: string }
      setAssistantAnswer(data.answer || "No answer returned.")
      setAssistantQuestion("")
    } catch (error) {
      console.error("Assistant interaction error:", error)
      setAssistantError(
        error instanceof Error ? error.message : "Something went wrong while contacting the assistant.",
      )
    } finally {
      setAssistantLoading(false)
    }
  }

  const handleColdMail = async () => {
    console.log("Cold mail button clicked", {
      hasItem: !!item,
      recruiterEmail: item?.recruiterEmail,
      resumeUrl: item?.resumeUrl,
      hasRecruiterEmail: !!item?.recruiterEmail,
      hasResumeUrl: !!item?.resumeUrl
    })
    
    if (!item?.recruiterEmail || !item?.resumeUrl) {
      setColdMailMessage("Recruiter email or resume URL is missing")
      return
    }

    setIsSendingColdMail(true)
    setColdMailMessage(null)

    try {
      // Candidate email will be extracted from authenticated user in the API
      const requestBody = {
        resume_url: item.resumeUrl,
        recruiter_email: item.recruiterEmail,
        job_description: item.jdText || ''
      }
      
      console.log("Sending cold mail request with body:", requestBody)
      
      const response = await fetch('/api/cold-mail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (response.ok) {
        setColdMailMessage("Cold email sent successfully!")
      } else {
        const error = await response.json()
        setColdMailMessage(`Failed to send cold email: ${error.message || 'Unknown error'}`)
      }
    } catch (error) {
      setColdMailMessage(`Error sending cold email: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsSendingColdMail(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="px-4 py-12">
        <div className="mx-auto max-w-6xl">
          {errorMessage && (
            <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {errorMessage}
            </div>
          )}
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Resume Analysis</h1>
              <p className="text-muted-foreground">Here's how your resume performed</p>
            </div>
            <button
              onClick={downloadOptimizedResume}
              disabled={!optimizedResume}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-secondary text-secondary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="size-4" />
              Download Updated Resume
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-1 space-y-6">
              {/* ATS Score Card */}
              <div className="rounded-2xl bg-card border border-border p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="size-12 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Target className="size-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">ATS Score</p>
                    <p className="text-4xl font-bold text-foreground">{atsPercent ?? (loading ? "..." : "-")}%</p>
                  </div>
                </div>
                <div className="h-3 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-1000"
                    style={{ width: `${atsPercent ?? 0}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-3">
                  {(atsPercent ?? 0) >= 80
                    ? "Excellent"
                    : (atsPercent ?? 0) >= 60
                      ? "Good"
                      : "Needs Improvement"}{" "}
                  - Above average compared to similar resumes
                </p>
              </div>

              {/* Stats Panel */}
              {performanceStats.length ? <StatsPanel title="Performance Matrix" stats={performanceStats} /> : null}

              {/* Strengths */}
              <div className="rounded-2xl bg-card border border-border p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="size-5 text-primary" />
                  <h3 className="font-semibold text-foreground">Top Strengths</h3>
                </div>
                <ul className="space-y-3">
                  {strengths.map((strength, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <div className="size-1.5 rounded-full bg-primary mt-2 shrink-0" />
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Right Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Executive Summary */}
              <div className="rounded-2xl bg-card border border-border p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="size-5 text-primary" />
                  <h3 className="font-semibold text-foreground">Executive Summary</h3>
                </div>
                <p className="text-muted-foreground leading-relaxed">{summary || (loading ? "Loading..." : "-")}</p>
              </div>

              {/* Improvements */}
              <div className="rounded-2xl bg-card border border-border p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="size-5 text-primary" />
                  <h3 className="font-semibold text-foreground">Suggested Improvements</h3>
                </div>
                <div className="space-y-4">
                  {improvements.map((suggestion, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-4 p-4 rounded-xl bg-secondary/50 hover:bg-secondary/70 transition-colors"
                    >
                      <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <AlertCircle className="size-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground text-sm">Suggestion</p>
                        <p className="text-sm text-muted-foreground mt-1">{suggestion}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cold Mail Button */}
              {(() => {
                console.log("Checking cold mail button visibility:", {
                  item: !!item,
                  recruiterEmail: item?.recruiterEmail,
                  resumeUrl: item?.resumeUrl,
                  shouldShow: !!(item?.recruiterEmail && item?.resumeUrl)
                })
                const shouldShow = !!(item?.recruiterEmail && item?.resumeUrl)
                console.log("Button will render:", shouldShow)
                return shouldShow
              })() && (
                <div className="rounded-2xl bg-card border border-border p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Mail className="size-5 text-primary" />
                    <h3 className="font-semibold text-foreground">Cold Email Outreach</h3>
                  </div>
                  <p className="text-muted-foreground mb-4">
                    Send a personalized cold email to the recruiter with your resume details.
                  </p>
                  <button
                    onClick={handleColdMail}
                    disabled={isSendingColdMail}
                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSendingColdMail ? (
                      <>
                        <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="size-4" />
                        Initiate with a cold mail
                      </>
                    )}
                  </button>
                  {coldMailMessage && (
                    <div className={`mt-4 rounded-xl border p-3 text-sm ${
                      coldMailMessage.includes("success") 
                        ? "border-green-500/30 bg-green-500/10 text-green-700"
                        : "border-destructive/30 bg-destructive/10 text-destructive"
                    }`}>
                      {coldMailMessage}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Chat Placeholder - full-width below main grid */}
          <div className="mt-6 rounded-2xl bg-card border border-border p-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="size-5 text-primary" />
              <h3 className="font-semibold text-foreground">AI Career Assistant</h3>
            </div>
            <div className="rounded-xl bg-secondary/50 p-8 text-center">
              <div className="size-12 rounded-xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="size-6 text-primary" />
              </div>
              <p className="text-muted-foreground mb-4">
                Ask questions about your resume or get personalized career advice
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="Ask a question..."
                  className="flex-1 px-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={assistantQuestion}
                  onChange={(e) => setAssistantQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleAssistantSend()
                    }
                  }}
                  disabled={assistantLoading || !item?.resumeUrl}
                />
                <button
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleAssistantSend}
                  disabled={assistantLoading || !assistantQuestion.trim() || !item?.resumeUrl}
                >
                  Send
                </button>
              </div>
              {assistantError && (
                <p className="mt-3 text-sm text-destructive">
                  {assistantError}
                </p>
              )}
              {assistantAnswer && (
                <div className="mt-4 text-left">
                  <p className="text-xs text-muted-foreground mb-1">Assistant response</p>
                  <div className="rounded-xl bg-muted/50 border border-border px-4 py-3 text-sm text-foreground whitespace-pre-wrap">
                    {assistantAnswer}
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-4">
                {/* TODO: Replace with real LLM chat integration */}
                Coming soon: AI-powered career coaching
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>}>
      <ResultsContent />
    </Suspense>
  )
}
