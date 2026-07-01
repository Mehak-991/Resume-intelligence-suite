"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import {
  Upload, Mic, Play, CheckCircle2,
  Loader2, ChevronRight, BarChart3, AlertCircle,
  RefreshCw, StopCircle, User, Briefcase, FileText
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { ResumeProvider, useSharedResume } from "@/context/ResumeContext"
import SkillGapAnalyzer from "@/components/skill-gap/SkillGapAnalyzer"

// ─── Types ───────────────────────────────────────────────────────────────────

interface Question {
  number: number
  difficulty: "easy" | "medium" | "hard"
  text: string
  question?: string // backend may return either key
}

interface AnswerFeedback {
  question_number: number
  transcription: string
  word_count: number
  analysis: {
    overall_score?: number
    content_accuracy?: number
    communication_clarity?: number
    tone_confidence?: number
    relevance?: number
    feedback?: string
    strengths?: string[]
    improvements?: string[]
  }
  feedback: string
}

interface Report {
  candidate_name?: string
  position?: string
  overall_score?: number
  overall_performance?: string
  summary?: string
  strengths?: string[]
  areas_for_improvement?: string[]
  preparation_topics?: string[]
  questions_and_answers?: Array<{
    question_number?: number
    question?: string
    difficulty?: string
    analysis?: { overall_score?: number; feedback?: string }
  }>
}

type Phase = "setup" | "interview" | "feedback" | "report"

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  medium: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  hard: "text-red-400 bg-red-400/10 border-red-400/30",
}

// ─── Main Component ───────────────────────────────────────────────────────────

// ─── Inner component that uses the shared context ────────────────────────────
function InterviewPageInner() {
  // Shared resume state (synced with Skill Gap Analyzer)
  const { sharedResume: resumeFile, setSharedResume: setResumeFile } = useSharedResume()

  // Setup state
  const [candidateName, setCandidateName] = useState("")
  const [position, setPosition] = useState("")
  const [jobDescription, setJobDescription] = useState("")

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answeredCount, setAnsweredCount] = useState(0)

  // Recording state
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [recordingSeconds, setRecordingSeconds] = useState(0)

  // Phase & loading
  const [phase, setPhase] = useState<Phase>("setup")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Feedback state (shown after each answer)
  const [currentFeedback, setCurrentFeedback] = useState<AnswerFeedback | null>(null)

  // Report
  const [report, setReport] = useState<Report | null>(null)

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Current question helper
  const currentQuestion = questions[currentIndex]
  const questionText = currentQuestion?.text || currentQuestion?.question || ""

  // ── Recording timer cleanup ───────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // ── Setup submit ─────────────────────────────────────────────────────────
  const handleSetup = async () => {
    if (!resumeFile || !candidateName.trim() || !position.trim() || !jobDescription.trim()) {
      setError("Please fill in all fields and upload your resume.")
      return
    }
    setError(null)
    setIsLoading(true)

    try {
      const formData = new FormData()
      formData.append("resume", resumeFile)
      formData.append("candidate_name", candidateName.trim())
      formData.append("position", position.trim())
      formData.append("job_description", jobDescription.trim())

      const res = await fetch("/api/interview/setup", { method: "POST", body: formData })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Setup failed" }))
        throw new Error(err.error || err.detail || "Setup failed")
      }

      const data = await res.json()

      // The backend returns questions_preview (preview only) in InterviewSetupResponse
      // Fetch all full questions via GET question/{session_id} after setup
      // But since the backend advances current_question on each GET,
      // we parse questions from the preview/setup response if available
      // Fallback: use questions_preview with truncated text until each question is fetched live
      const rawQuestions: Question[] = (data.questions || data.questions_preview || []).map(
        (q: { number?: number; difficulty: string; question?: string; text?: string }, i: number) => ({
          number: q.number ?? i + 1,
          difficulty: (q.difficulty as "easy" | "medium" | "hard") || "easy",
          text: q.question || q.text || "",
        })
      )

      setSessionId(data.session_id)
      setQuestions(rawQuestions)
      setCurrentIndex(0)
      setAnsweredCount(0)
      setPhase("interview")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to start interview. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  // ── Fetch current question from backend (live) ────────────────────────────
  const fetchCurrentQuestion = useCallback(async (sid: string) => {
    try {
      const res = await fetch(`/api/interview/question/${sid}`)
      if (!res.ok) return
      const data = await res.json()
      // Update current question text if it came truncated from setup
      setQuestions((prev) =>
        prev.map((q) =>
          q.number === data.question_number
            ? { ...q, text: data.question || q.text, difficulty: data.difficulty || q.difficulty }
            : q
        )
      )
    } catch {
      // Non-critical — question text already shown from setup
    }
  }, [])

  useEffect(() => {
    if (phase === "interview" && sessionId) {
      fetchCurrentQuestion(sessionId)
    }
  }, [phase, sessionId, currentIndex, fetchCurrentQuestion])

  // ── Voice recording ───────────────────────────────────────────────────────
  const startRecording = async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" })
        setAudioBlob(blob)
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)
        stream.getTracks().forEach((t) => t.stop())
      }

      mediaRecorder.start(250)
      setIsRecording(true)
      setRecordingSeconds(0)
      setAudioBlob(null)
      setAudioUrl(null)

      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1)
      }, 1000)
    } catch {
      setError("Microphone access denied. Please allow microphone permission and try again.")
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`

  // ── Submit voice answer ───────────────────────────────────────────────────
  const submitAnswer = async () => {
    if (!audioBlob || !sessionId || !currentQuestion) return
    setError(null)
    setIsLoading(true)

    try {
      const formData = new FormData()
      formData.append("session_id", sessionId)
      formData.append("question_number", String(currentQuestion.number))
      formData.append("audio_answer", audioBlob, "answer.webm")

      const res = await fetch("/api/interview/answer", { method: "POST", body: formData })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Submission failed" }))
        throw new Error(err.error || err.detail || "Failed to submit answer")
      }

      const data: AnswerFeedback = await res.json()
      setCurrentFeedback(data)
      setAnsweredCount((c) => c + 1)
      setPhase("feedback")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to submit answer. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  // ── Advance to next question ──────────────────────────────────────────────
  const handleNext = () => {
    const nextIndex = currentIndex + 1
    setAudioBlob(null)
    setAudioUrl(null)
    setRecordingSeconds(0)
    setCurrentFeedback(null)
    setError(null)

    if (nextIndex >= questions.length) {
      // All answered — fetch report
      fetchReport()
    } else {
      setCurrentIndex(nextIndex)
      setPhase("interview")
    }
  }

  // ── Fetch final report ────────────────────────────────────────────────────
  const fetchReport = async () => {
    if (!sessionId) return
    setIsLoading(true)
    setPhase("report")

    try {
      const res = await fetch(`/api/interview/report/${sessionId}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Report failed" }))
        throw new Error(err.error || err.detail || "Failed to generate report")
      }
      const data: Report = await res.json()
      setReport(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load report.")
    } finally {
      setIsLoading(false)
    }
  }

  // ── Reset session ─────────────────────────────────────────────────────────
  const handleReset = async () => {
    // Clean up session on backend (best-effort)
    if (sessionId) {
      fetch(`/api/interview/session/${sessionId}`, { method: "DELETE" }).catch(() => { })
    }

    // Revoke audio URLs
    if (audioUrl) URL.revokeObjectURL(audioUrl)

    setSessionId(null)
    setQuestions([])
    setCurrentIndex(0)
    setAnsweredCount(0)
    setPhase("setup")
    setResumeFile(null)  // also clears shared context
    setCandidateName("")
    setPosition("")
    setJobDescription("")
    setAudioBlob(null)
    setAudioUrl(null)
    setCurrentFeedback(null)
    setReport(null)
    setError(null)
    setIsRecording(false)
    setRecordingSeconds(0)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="px-4 py-12">
        <div className="mx-auto max-w-3xl space-y-0">

          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">AI Mock Interview</h1>
            <p className="text-muted-foreground">
              {phase === "setup" && "Upload your resume and tell us about the role you're applying for."}
              {phase === "interview" && `Question ${currentIndex + 1} of ${questions.length} — Record your answer below.`}
              {phase === "feedback" && "Here's how you did on that question."}
              {phase === "report" && "Your interview is complete. Here's your full performance report."}
            </p>
          </div>

          {/* ── Error Banner ─────────────────────────────────────────────── */}
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertCircle className="size-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* PHASE 1 — SETUP                                               */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {phase === "setup" && (
            <Card className="border-border bg-card p-8">
              <div className="space-y-5">

                {/* Resume upload */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Resume (PDF)
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="resume-upload"
                  />
                  <label
                    htmlFor="resume-upload"
                    className="flex items-center justify-center gap-3 px-4 py-7 rounded-xl border-2 border-dashed border-border hover:border-primary/60 transition-colors cursor-pointer"
                  >
                    <Upload className="size-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {resumeFile ? (
                        <span className="text-primary font-medium">{resumeFile.name}</span>
                      ) : (
                        "Click to upload resume (PDF, DOCX, TXT)"
                      )}
                    </span>
                  </label>
                </div>

                {/* Candidate name */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    <User className="inline size-4 mr-1.5 -mt-0.5" />
                    Candidate Name
                  </label>
                  <input
                    type="text"
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {/* Position */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    <Briefcase className="inline size-4 mr-1.5 -mt-0.5" />
                    Position Applying For
                  </label>
                  <input
                    type="text"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="e.g. Senior Software Engineer"
                    className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {/* Job Description */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    <FileText className="inline size-4 mr-1.5 -mt-0.5" />
                    Job Description
                  </label>
                  <Textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Paste the job description here..."
                    rows={7}
                    className="resize-none"
                  />
                </div>

                <Button
                  onClick={handleSetup}
                  disabled={isLoading || !resumeFile || !candidateName.trim() || !position.trim() || !jobDescription.trim()}
                  className="w-full gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Setting up interview…
                    </>
                  ) : (
                    <>
                      Start Mock Interview
                      <ChevronRight className="size-4" />
                    </>
                  )}
                </Button>
              </div>
            </Card>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* PHASE 2 — INTERVIEW SESSION                                   */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {phase === "interview" && currentQuestion && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-400">

              {/* Session info bar */}
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  <span className="text-foreground font-medium">{candidateName}</span> — {position}
                </span>
                <button onClick={handleReset} className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                  <RefreshCw className="size-3.5" />
                  End Session
                </button>
              </div>

              {/* Progress */}
              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                  <span>Question {currentIndex + 1} of {questions.length}</span>
                  <span>{answeredCount} answered</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Question card */}
              <Card className="border-border bg-card p-6">
                {/* Difficulty badge */}
                <div className="flex items-center gap-2 mb-5">
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${DIFFICULTY_COLORS[currentQuestion.difficulty] || DIFFICULTY_COLORS.easy}`}>
                    {currentQuestion.difficulty.charAt(0).toUpperCase() + currentQuestion.difficulty.slice(1)}
                  </span>
                </div>

                <h2 className="text-lg font-semibold text-foreground leading-relaxed mb-8">
                  {questionText || (
                    <span className="text-muted-foreground italic text-sm">Loading question…</span>
                  )}
                </h2>

                {/* Recording interface */}
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    {!isRecording ? (
                      <Button
                        onClick={startRecording}
                        disabled={!!audioBlob}
                        variant={audioBlob ? "outline" : "default"}
                        className="gap-2"
                      >
                        <Mic className="size-4" />
                        {audioBlob ? "Recording saved" : "Start Recording"}
                      </Button>
                    ) : (
                      <Button onClick={stopRecording} variant="destructive" className="gap-2 animate-pulse">
                        <StopCircle className="size-4" />
                        Stop Recording
                      </Button>
                    )}

                    {isRecording && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="size-2 rounded-full bg-red-500 animate-pulse" />
                        {formatTime(recordingSeconds)}
                      </div>
                    )}

                    {audioBlob && !isRecording && (
                      <button
                        onClick={() => {
                          setAudioBlob(null)
                          setAudioUrl(null)
                          setRecordingSeconds(0)
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                      >
                        Re-record
                      </button>
                    )}
                  </div>

                  {/* Audio preview */}
                  {audioUrl && !isRecording && (
                    <div className="rounded-xl border border-border bg-secondary/40 p-3">
                      <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                        <Play className="size-3" />
                        Preview your recording
                      </p>
                      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                      <audio ref={audioRef} src={audioUrl} controls className="w-full h-8" />
                    </div>
                  )}

                  {/* Submit */}
                  <Button
                    onClick={submitAnswer}
                    disabled={!audioBlob || isLoading || isRecording}
                    className="w-full gap-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Analysing your answer…
                      </>
                    ) : (
                      <>
                        Submit Answer
                        <ChevronRight className="size-4" />
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* PHASE 3 — ANSWER FEEDBACK                                     */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {phase === "feedback" && currentFeedback && currentQuestion && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-400">

              {/* Progress */}
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${(answeredCount / questions.length) * 100}%` }}
                />
              </div>

              <Card className="border-border bg-card p-6 space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-5 text-primary" />
                    <h3 className="font-semibold text-foreground">Answer Submitted</h3>
                  </div>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${DIFFICULTY_COLORS[currentQuestion.difficulty] || DIFFICULTY_COLORS.easy}`}>
                    {currentQuestion.difficulty.charAt(0).toUpperCase() + currentQuestion.difficulty.slice(1)}
                  </span>
                </div>

                {/* Score */}
                {currentFeedback.analysis?.overall_score !== undefined && (
                  <div className="flex items-center gap-4 py-3 px-4 rounded-xl bg-secondary/50">
                    <BarChart3 className="size-5 text-primary shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Overall Score</p>
                      <p className="text-2xl font-bold text-primary">
                        {currentFeedback.analysis.overall_score}
                        <span className="text-sm font-normal text-muted-foreground">/100</span>
                      </p>
                    </div>
                    {/* Sub-scores */}
                    <div className="ml-auto grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                      {currentFeedback.analysis.content_accuracy !== undefined && (
                        <span className="text-muted-foreground">Content: <span className="text-foreground font-medium">{currentFeedback.analysis.content_accuracy}</span></span>
                      )}
                      {currentFeedback.analysis.communication_clarity !== undefined && (
                        <span className="text-muted-foreground">Clarity: <span className="text-foreground font-medium">{currentFeedback.analysis.communication_clarity}</span></span>
                      )}
                      {currentFeedback.analysis.tone_confidence !== undefined && (
                        <span className="text-muted-foreground">Confidence: <span className="text-foreground font-medium">{currentFeedback.analysis.tone_confidence}</span></span>
                      )}
                      {currentFeedback.analysis.relevance !== undefined && (
                        <span className="text-muted-foreground">Relevance: <span className="text-foreground font-medium">{currentFeedback.analysis.relevance}</span></span>
                      )}
                    </div>
                  </div>
                )}

                {/* Transcription */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Your Answer (Transcribed)</p>
                  <p className="text-sm text-foreground leading-relaxed bg-secondary/30 rounded-xl p-4 border border-border">
                    {currentFeedback.transcription || <span className="italic text-muted-foreground">No transcription available</span>}
                  </p>
                </div>

                {/* Feedback */}
                {currentFeedback.feedback && (
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                    <p className="text-sm text-foreground leading-relaxed">{currentFeedback.feedback}</p>
                  </div>
                )}

                {/* Strengths */}
                {currentFeedback.analysis?.strengths && currentFeedback.analysis.strengths.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-emerald-400 uppercase tracking-wide mb-2">Strengths</p>
                    <ul className="space-y-1">
                      {currentFeedback.analysis.strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                          <span className="text-emerald-400 mt-0.5">•</span>{s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Improvements */}
                {currentFeedback.analysis?.improvements && currentFeedback.analysis.improvements.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-amber-400 uppercase tracking-wide mb-2">Areas to Improve</p>
                    <ul className="space-y-1">
                      {currentFeedback.analysis.improvements.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                          <span className="text-amber-400 mt-0.5">•</span>{s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <Button onClick={handleNext} className="w-full gap-2">
                  {answeredCount >= questions.length
                    ? <><BarChart3 className="size-4" />View Full Report</>
                    : <>Next Question <ChevronRight className="size-4" /></>}
                </Button>
              </Card>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* PHASE 4 — REPORT                                              */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {phase === "report" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">

              {isLoading && (
                <Card className="border-border bg-card p-12 flex flex-col items-center gap-4">
                  <Loader2 className="size-10 animate-spin text-primary" />
                  <p className="text-muted-foreground text-sm">Generating your performance report…</p>
                </Card>
              )}

              {!isLoading && report && (
                <>
                  {/* Overall score card */}
                  <Card className="border-border bg-card p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h2 className="text-xl font-bold text-foreground">{report.candidate_name || candidateName}</h2>
                        <p className="text-muted-foreground text-sm">{report.position || position}</p>
                      </div>
                      {report.overall_score !== undefined && (
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground mb-1">Overall Score</p>
                          <p className="text-4xl font-bold text-primary">{report.overall_score}<span className="text-base font-normal text-muted-foreground">/100</span></p>
                        </div>
                      )}
                    </div>
                    {(report.overall_performance || report.summary) && (
                      <p className="text-sm text-muted-foreground leading-relaxed border-t border-border pt-4 mt-4">
                        {report.overall_performance || report.summary}
                      </p>
                    )}
                  </Card>

                  {/* Strengths & Improvements */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {report.strengths && report.strengths.length > 0 && (
                      <Card className="border-emerald-400/20 bg-emerald-400/5 p-5">
                        <h3 className="text-sm font-semibold text-emerald-400 mb-3 uppercase tracking-wide">Strengths</h3>
                        <ul className="space-y-2">
                          {report.strengths.map((s, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                              <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>{s}
                            </li>
                          ))}
                        </ul>
                      </Card>
                    )}
                    {report.areas_for_improvement && report.areas_for_improvement.length > 0 && (
                      <Card className="border-amber-400/20 bg-amber-400/5 p-5">
                        <h3 className="text-sm font-semibold text-amber-400 mb-3 uppercase tracking-wide">Areas to Improve</h3>
                        <ul className="space-y-2">
                          {report.areas_for_improvement.map((s, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                              <span className="text-amber-400 mt-0.5 shrink-0">→</span>{s}
                            </li>
                          ))}
                        </ul>
                      </Card>
                    )}
                  </div>

                  {/* Preparation topics */}
                  {report.preparation_topics && report.preparation_topics.length > 0 && (
                    <Card className="border-border bg-card p-5">
                      <h3 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">Suggested Study Topics</h3>
                      <div className="flex flex-wrap gap-2">
                        {report.preparation_topics.map((t, i) => (
                          <span key={i} className="text-xs px-3 py-1 rounded-full border border-border bg-secondary text-secondary-foreground">
                            {t}
                          </span>
                        ))}
                      </div>
                    </Card>
                  )}

                  {/* Per-question breakdown */}
                  {report.questions_and_answers && report.questions_and_answers.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">Question Breakdown</h3>
                      <div className="space-y-3">
                        {report.questions_and_answers.map((qa, i) => (
                          <Card key={i} className="border-border bg-card p-5">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs text-muted-foreground">Q{qa.question_number ?? i + 1}</span>
                                {qa.difficulty && (
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${DIFFICULTY_COLORS[qa.difficulty] || DIFFICULTY_COLORS.easy}`}>
                                    {qa.difficulty}
                                  </span>
                                )}
                              </div>
                              {qa.analysis?.overall_score !== undefined && (
                                <span className="text-sm font-bold text-primary shrink-0">{qa.analysis.overall_score}/100</span>
                              )}
                            </div>
                            <p className="text-sm text-foreground mb-2">{qa.question}</p>
                            {qa.analysis?.feedback && (
                              <p className="text-xs text-muted-foreground leading-relaxed">{qa.analysis.feedback}</p>
                            )}
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button onClick={handleReset} variant="outline" className="w-full gap-2 bg-transparent">
                    <RefreshCw className="size-4" />
                    Start New Interview
                  </Button>
                </>
              )}

              {!isLoading && !report && error && (
                <Card className="border-border bg-card p-8 text-center">
                  <p className="text-muted-foreground mb-4">Could not load your report. Please try again.</p>
                  <Button onClick={fetchReport} className="gap-2">
                    <RefreshCw className="size-4" />
                    Retry
                  </Button>
                </Card>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* SKILL GAP ANALYZER SECTION                                    */}
          {/* ══════════════════════════════════════════════════════════════ */}
          <div className="mt-16 pt-10 border-t border-border">
            <SkillGapAnalyzer />
          </div>

        </div>
      </main>
      <Footer />
    </div>
  )
}

// ─── Page export wrapped with shared resume provider ──────────────────────────
export default function InterviewPage() {
  return (
    <ResumeProvider>
      <InterviewPageInner />
    </ResumeProvider>
  )
}
