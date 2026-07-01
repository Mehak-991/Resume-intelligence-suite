"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Upload, FileText, Loader2, Sparkles } from "lucide-react"
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

export default function ResumePage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [jdText, setJdText] = useState("")
  const [recruiterEmail, setRecruiterEmail] = useState("")
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const { user } = useAuth()

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    if (!user) {
      setLoginOpen(true)
      return
    }

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && (droppedFile.type === "application/pdf" || droppedFile.name.toLowerCase().endsWith(".pdf"))) {
      setFile(droppedFile)
    }
  }, [user])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) {
      e.currentTarget.value = ""
      setLoginOpen(true)
      return
    }

    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
    }
  }

  const handleSubmit = async () => {
    if (!user) {
      setLoginOpen(true)
      return
    }
    if (!file) return
    setIsProcessing(true)
    setErrorMessage(null)
    try {
      const formData = new FormData()
      formData.append("resume", file)
      formData.append("job_description", jdText)
      formData.append("recruiter_email", recruiterEmail)

      const res = await fetch("/api/user/resumes/analyze", {
        method: "POST",
        body: formData,
      })

      if (res.status === 401) {
        setLoginOpen(true)
        return
      }
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

      const data = (await res.json()) as { id: string }
      if (!data?.id) return
      router.push(`/resume/results?id=${encodeURIComponent(data.id)}`)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <AlertDialog open={loginOpen} onOpenChange={setLoginOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Login required</AlertDialogTitle>
            <AlertDialogDescription>Please login to use the Resume Analyzer.</AlertDialogDescription>
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
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm mb-4">
              <Sparkles className="size-4" />
              AI-Powered Analysis
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Upload Your Resume</h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Get instant ATS scoring, tailored suggestions, and AI-powered improvements.
            </p>
          </div>

          <div className="space-y-6">
            {/* Upload Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`relative rounded-2xl border-2 border-dashed p-12 text-center transition-all ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : file
                    ? "border-primary/50 bg-primary/5"
                    : "border-border hover:border-primary/50"
              }`}
            >
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center gap-4">
                <div
                  className={`size-16 rounded-2xl flex items-center justify-center ${
                    file ? "bg-primary/20" : "bg-secondary"
                  }`}
                >
                  {file ? (
                    <FileText className="size-8 text-primary" />
                  ) : (
                    <Upload className="size-8 text-muted-foreground" />
                  )}
                </div>
                {file ? (
                  <div>
                    <p className="font-medium text-foreground">{file.name}</p>
                    <p className="text-sm text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div>
                    <p className="font-medium text-foreground">Drop your resume here or click to browse</p>
                    <p className="text-sm text-muted-foreground">Supports PDF files</p>
                  </div>
                )}
              </div>
            </div>

            {/* Job Description Input */}
            <div className="rounded-2xl bg-card border border-border p-6">
              <label className="block font-medium text-foreground mb-3">Paste Job Description (Optional)</label>
              <textarea
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                placeholder="Paste the job description here to get tailored suggestions..."
                className="w-full h-40 rounded-xl bg-secondary border border-border p-4 text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            {/* Recruiter's Email Input */}
            <div className="rounded-2xl bg-card border border-border p-6">
              <label className="block font-medium text-foreground mb-3">Recruiter's Email (Optional)</label>
              <input
                type="email"
                value={recruiterEmail}
                onChange={(e) => setRecruiterEmail(e.target.value)}
                placeholder="Enter recruiter's email address for cold mailing..."
                className="w-full rounded-xl bg-secondary border border-border p-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <p className="text-sm text-muted-foreground mt-2">
                Provide this to enable cold email functionality after resume analysis
              </p>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={!file || isProcessing}
              className="w-full flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-primary text-primary-foreground font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="size-5" />
                  Analyze Resume
                </>
              )}
            </button>

            {errorMessage && <div className="text-sm text-destructive">{errorMessage}</div>}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
