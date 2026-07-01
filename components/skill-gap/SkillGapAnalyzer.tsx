"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import {
    Upload, Loader2, CheckCircle2, AlertCircle,
    Target, TrendingUp, TrendingDown, XCircle,
    Download, Trash2, RefreshCw, Briefcase, ChevronRight,
    BookOpen, Star
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useSharedResume } from "@/context/ResumeContext"

// ─── Types (mirror backend Pydantic models exactly) ───────────────────────────

interface SkillItem {
    name: string
    proficiency: number   // 0-10 scale (per state.py)
    category: string
}

interface SkillGap {
    skill: string
    importance: number            // 0-10
    current_proficiency: number   // 0-10
    required_proficiency: number  // 0-10
    gap_severity: "low" | "medium" | "high" | "critical"
}

interface CourseRec {
    skill: string
    course_title: string
    platform: string
    url: string
    duration_hours: number
    level: string
    is_free: boolean
}

interface AnalysisResult {
    analysis_id: string
    status: string
    candidate_skills: SkillItem[]
    required_skills: SkillItem[]
    skill_gaps: SkillGap[]
    strong_skills: string[]
    weak_skills: string[]
    missing_skills: string[]
    course_recommendations: CourseRec[]
    total_learning_time: number
    errors: string[]
    created_at: string
}

type Phase = "idle" | "submitting" | "polling" | "fetching" | "done" | "error"

// ─── Small shared helpers ─────────────────────────────────────────────────────

const GAP_COLORS: Record<string, string> = {
    critical: "text-red-400 bg-red-400/10 border-red-400/30",
    high: "text-orange-400 bg-orange-400/10 border-orange-400/30",
    medium: "text-amber-400 bg-amber-400/10 border-amber-400/30",
    low: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
}

/** Generic progress bar — pass value and max on the same scale */
function Bar({ value, max = 100, color = "bg-primary" }: { value: number; max?: number; color?: string }) {
    const pct = Math.min(100, Math.max(0, Math.round((value / max) * 100)))
    return (
        <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
        </div>
    )
}

/** Group an array of SkillItems by their category field */
function groupByCategory(skills: SkillItem[]): Record<string, SkillItem[]> {
    return skills.reduce<Record<string, SkillItem[]>>((acc, s) => {
        const cat = (s.category || "General").trim()
            ; (acc[cat] ??= []).push(s)
        return acc
    }, {})
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SkillGapAnalyzer() {
    const { sharedResume, setSharedResume } = useSharedResume()

    const [jobDescription, setJobDescription] = useState("")
    const [phase, setPhase] = useState<Phase>("idle")
    const [analysisId, setAnalysisId] = useState<string | null>(null)
    const [pollProgress, setPollProgress] = useState("")
    const [result, setResult] = useState<AnalysisResult | null>(null)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const stopPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }
    useEffect(() => () => stopPolling(), [])

    // ── Step 3: fetch final results (HTTP 200 only) ────────────────────────────
    const fetchResults = useCallback(async (id: string) => {
        setPhase("fetching")
        try {
            const res = await fetch(`/api/skill-gap/analysis/${id}`)
            if (res.status !== 200) {
                const body = await res.json().catch(() => ({}))
                console.warn("[SkillGap] GET /analysis returned non-200:", res.status, body)
                throw new Error(`Unexpected status ${res.status} — analysis may still be running`)
            }
            const data: AnalysisResult = await res.json()
            if (!data || !("analysis_id" in data)) throw new Error("Malformed response from analysis endpoint")

            // ── Validation: log full JSON + field map ──────────────────────────────
            console.log("[SkillGap] ✅ Raw result from GET /analysis/{id}:", JSON.stringify(data, null, 2))
            console.table({
                "strong_skills count": { field: "result.strong_skills.length", value: data.strong_skills?.length ?? 0 },
                "weak_skills count": { field: "result.weak_skills.length", value: data.weak_skills?.length ?? 0 },
                "missing_skills count": { field: "result.missing_skills.length", value: data.missing_skills?.length ?? 0 },
                "skill_gaps count": { field: "result.skill_gaps.length", value: data.skill_gaps?.length ?? 0 },
                "candidate_skills": { field: "result.candidate_skills.length", value: data.candidate_skills?.length ?? 0 },
                "required_skills": { field: "result.required_skills.length", value: data.required_skills?.length ?? 0 },
                "courses count": { field: "result.course_recommendations.length", value: data.course_recommendations?.length ?? 0 },
            })

            setResult(data)
            setPhase("done")
        } catch (e: unknown) {
            console.error("[SkillGap] fetchResults error:", e)
            setErrorMsg(e instanceof Error ? e.message : "Failed to load analysis results")
            setPhase("error")
        }
    }, [])

    // ── Step 2: poll status ────────────────────────────────────────────────────
    const pollStatus = useCallback(async (id: string) => {
        try {
            const res = await fetch(`/api/skill-gap/analysis/${id}/status`)
            if (!res.ok) return
            const data = await res.json()
            console.log("[SkillGap] poll →", data.status, "|", data.progress)
            setPollProgress(data.progress ?? data.status ?? "Analyzing…")
            if (data.status === "completed") { stopPolling(); await fetchResults(id) }
            else if (data.status === "failed") {
                stopPolling()
                setErrorMsg(data.message ?? "Analysis failed on the server")
                setPhase("error")
            }
        } catch (e) { console.warn("[SkillGap] poll error (will retry):", e) }
    }, [fetchResults])

    // ── Step 1: submit ─────────────────────────────────────────────────────────
    const handleAnalyze = async () => {
        if (!sharedResume || !jobDescription.trim()) { setErrorMsg("Please upload a resume and enter a job description."); return }
        stopPolling(); setResult(null); setErrorMsg(null); setAnalysisId(null); setPollProgress(""); setPhase("submitting")
        try {
            const form = new FormData()
            form.append("resume_pdf", sharedResume)
            form.append("job_description", jobDescription.trim())
            console.log("[SkillGap] POST /analyze → job_description length:", jobDescription.trim().length, "| file:", sharedResume.name)
            const res = await fetch("/api/skill-gap/analyze", { method: "POST", body: form })
            const data = await res.json().catch(() => ({ error: "Invalid response" }))
            if (!res.ok) throw new Error(data.error ?? data.detail ?? `POST failed ${res.status}`)
            const id: string = data.analysis_id
            if (!id) throw new Error("No analysis_id in POST response")
            console.log("[SkillGap] queued, analysis_id:", id)
            setAnalysisId(id); setPollProgress(data.progress ?? "Queued"); setPhase("polling")
            pollRef.current = setInterval(() => pollStatus(id), 3000)
        } catch (e: unknown) {
            console.error("[SkillGap] POST error:", e)
            setErrorMsg(e instanceof Error ? e.message : "Failed to start analysis"); setPhase("error")
        }
    }

    // ── Actions ────────────────────────────────────────────────────────────────
    const handleDownloadSummary = async () => {
        if (!analysisId) return
        try {
            const res = await fetch(`/api/skill-gap/analysis/${analysisId}/summary`)
            if (!res.ok) throw new Error("Summary unavailable")
            const data = await res.json()
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
            const url = URL.createObjectURL(blob)
            Object.assign(document.createElement("a"), { href: url, download: `skill-gap-${analysisId.slice(0, 8)}.json` }).click()
            URL.revokeObjectURL(url)
        } catch { setErrorMsg("Failed to download summary.") }
    }

    const handleDelete = () => {
        if (analysisId) fetch(`/api/skill-gap/analysis/${analysisId}`, { method: "DELETE" }).catch(() => { })
        handleReset()
    }

    const handleReset = () => {
        stopPolling(); setResult(null); setErrorMsg(null); setAnalysisId(null); setPollProgress(""); setPhase("idle")
    }

    // ── Derived values (from backend data only) ────────────────────────────────
    const matchScore: number = (() => {
        if (!result) return 0

        // Match score should evaluate across all required skills.
        // A gap tells us current_proficiency < required_proficiency.
        // A strong skill means candidate perfectly met or exceeded requirement.

        const totalReq = result.required_skills?.length || 0
        if (totalReq === 0) return 0

        // Create a lookup for current proficiency points from candidate skills
        const candidateMap = new Map(result.candidate_skills?.map(s => [s.name, s.proficiency]) || [])

        let sumPct = 0
        for (const req of result.required_skills) {
            const currentProf = candidateMap.get(req.name) || 0
            const requiredProf = Math.max(0.1, req.proficiency)

            // max cap at 1.0 per skill so overqualified doesn't push it > 100%
            sumPct += Math.min(1, currentProf / requiredProf)
        }

        return Math.round((sumPct / totalReq) * 100)
    })()

    const matchColor = matchScore >= 70 ? "bg-emerald-500" : matchScore >= 40 ? "bg-amber-500" : "bg-red-500"
    const matchTextColor = matchScore >= 70 ? "text-emerald-400" : matchScore >= 40 ? "text-amber-400" : "text-red-400"
    const isLoading = phase === "submitting" || phase === "polling" || phase === "fetching"

    // Pre-compute category maps for results
    const candidateByCat = result ? groupByCategory(result.candidate_skills) : {}
    const requiredByCat = result ? groupByCategory(result.required_skills) : {}

    // ─────────────────────────────────────────────────────────────────────────────
    return (
        <section className="space-y-5">

            {/* ── HEADER ──────────────────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 mb-1">
                <Target className="size-5 text-primary" />
                <h2 className="text-2xl font-bold text-foreground">Skill Gap Analyzer</h2>
            </div>
            <p className="text-muted-foreground text-sm -mt-2">
                Understand exactly which skills you need for your target role — powered by your resume.
            </p>

            {/* ── ERROR BANNER ─────────────────────────────────────────────────────── */}
            {errorMsg && (
                <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                    <AlertCircle className="size-5 shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <span>{errorMsg}</span>
                        <button onClick={handleReset} className="block text-xs mt-2 underline underline-offset-2 hover:no-underline">
                            Try again
                        </button>
                    </div>
                </div>
            )}

            {/* ── INPUT / LOADING CARD ────────────────────────────────────────────── */}
            {phase !== "done" && (
                <Card className="border-border bg-card p-8">
                    <div className="space-y-5">

                        {/* Resume upload */}
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                                Resume (PDF) — shared with Interview section
                            </label>
                            <input type="file" accept=".pdf" id="sg-resume-upload" className="hidden"
                                disabled={isLoading}
                                onChange={(e) => { setSharedResume(e.target.files?.[0] || null); setErrorMsg(null) }} />
                            <label htmlFor="sg-resume-upload"
                                className={`flex items-center justify-center gap-3 px-4 py-7 rounded-xl border-2 border-dashed transition-colors
                  ${isLoading ? "border-border cursor-not-allowed opacity-60" : "border-border hover:border-primary/60 cursor-pointer"}`}>
                                <Upload className="size-5 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">
                                    {sharedResume
                                        ? <span className="text-primary font-medium flex items-center gap-2"><CheckCircle2 className="size-4" />{sharedResume.name}</span>
                                        : "Click to upload resume (PDF only)"}
                                </span>
                            </label>
                            {sharedResume && <p className="text-xs text-muted-foreground mt-1.5 pl-1">✓ Shared with the AI Mock Interview section above.</p>}
                        </div>

                        {/* Job Description input */}
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                                <Briefcase className="inline size-4 mr-1.5 -mt-0.5" />
                                Job Description
                            </label>
                            <textarea value={jobDescription} disabled={isLoading}
                                onChange={(e) => setJobDescription(e.target.value)}
                                rows={6}
                                placeholder="Paste the full job description here — including responsibilities, requirements, and qualifications…"
                                className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60 resize-none" />
                            <p className="text-xs text-muted-foreground mt-1.5 pl-1">The LLM will extract the required skills directly from this description.</p>
                        </div>

                        {/* Phase status */}
                        {phase === "submitting" && (
                            <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
                                <Loader2 className="size-4 animate-spin text-primary shrink-0" />
                                <span>Uploading and queuing analysis…</span>
                            </div>
                        )}
                        {(phase === "polling" || phase === "fetching") && (
                            <div className="space-y-1">
                                <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
                                    <Loader2 className="size-4 animate-spin text-primary shrink-0" />
                                    <span>{phase === "fetching" ? "Loading analysis results…" : (pollProgress || "Analysis in progress…")}</span>
                                </div>
                                {analysisId && <p className="text-xs text-muted-foreground/50 pl-1">ID: {analysisId}</p>}
                            </div>
                        )}

                        <Button onClick={handleAnalyze} disabled={isLoading || !sharedResume || !jobDescription.trim()} className="w-full gap-2">
                            {isLoading
                                ? <><Loader2 className="size-4 animate-spin" />Analyzing…</>
                                : <><span>Analyze Skill Gap</span><ChevronRight className="size-4" /></>}
                        </Button>
                    </div>
                </Card>
            )}

            {/* ══════════════════════════════════════════════════════════════════════
          RESULTS — all sections below. Only rendered when phase === "done".
          Every value is sourced 1:1 from GET /analysis/{id} JSON fields.
      ══════════════════════════════════════════════════════════════════════ */}
            {phase === "done" && result && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                    {/* ── SECTION 1: HEADLINE SCORE ─────────────────────────────────── */}
                    <Card className="border-border bg-card p-6">
                        <div className="flex items-start justify-between gap-4 mb-5">
                            <div>
                                <h3 className="font-semibold text-foreground text-lg">Skill Match Score</h3>
                                <p className="text-muted-foreground text-sm mt-0.5">
                                    Resume vs. <span className="text-foreground font-medium">Job Requirements</span>
                                </p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className={`text-5xl font-bold ${matchTextColor}`}>
                                    {matchScore}<span className="text-xl font-normal text-muted-foreground">%</span>
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {matchScore >= 70 ? "Strong match" : matchScore >= 40 ? "Moderate match" : "Needs improvement"}
                                </p>
                            </div>
                        </div>

                        {/* Big score bar */}
                        <div className="mb-5">
                            <Bar value={matchScore} max={100} color={matchColor} />
                        </div>

                        {/* Stat pills — from strong_skills / weak_skills / missing_skills */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="rounded-xl bg-emerald-400/10 border border-emerald-400/20 p-4 text-center">
                                <p className="text-3xl font-bold text-emerald-400">{result.strong_skills.length}</p>
                                <p className="text-xs text-muted-foreground mt-1">Strong Skills</p>
                                {result.strong_skills.length > 0 && (
                                    <p className="text-xs text-emerald-400/70 mt-1 truncate">{result.strong_skills.slice(0, 2).join(", ")}</p>
                                )}
                            </div>
                            <div className="rounded-xl bg-amber-400/10 border border-amber-400/20 p-4 text-center">
                                <p className="text-3xl font-bold text-amber-400">{result.weak_skills.length}</p>
                                <p className="text-xs text-muted-foreground mt-1">Needs Work</p>
                                {result.weak_skills.length > 0 && (
                                    <p className="text-xs text-amber-400/70 mt-1 truncate">{result.weak_skills.slice(0, 2).join(", ")}</p>
                                )}
                            </div>
                            <div className="rounded-xl bg-red-400/10 border border-red-400/20 p-4 text-center">
                                <p className="text-3xl font-bold text-red-400">{result.missing_skills.length}</p>
                                <p className="text-xs text-muted-foreground mt-1">Missing Skills</p>
                                {result.missing_skills.length > 0 && (
                                    <p className="text-xs text-red-400/70 mt-1 truncate">{result.missing_skills.slice(0, 2).join(", ")}</p>
                                )}
                            </div>
                        </div>
                    </Card>

                    {/* ── SECTION 2: CANDIDATE SKILLS — grouped by category ──────────── */}
                    {result.candidate_skills.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <TrendingUp className="size-4 text-primary" />
                                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Your Skills</h3>
                                <span className="text-xs text-muted-foreground">
                                    {result.candidate_skills.length} skills detected from your resume
                                </span>
                            </div>

                            {/* Parent div containing one sub-card per category */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {Object.entries(candidateByCat).map(([category, skills]) => {
                                    const avgProf = skills.reduce((s, k) => s + k.proficiency, 0) / skills.length
                                    const catColor = avgProf >= 7 ? "border-emerald-400/25 bg-emerald-400/5"
                                        : avgProf >= 4 ? "border-amber-400/25 bg-amber-400/5"
                                            : "border-border bg-card"
                                    const catLabel = avgProf >= 7 ? "text-emerald-400" : avgProf >= 4 ? "text-amber-400" : "text-muted-foreground"
                                    return (
                                        <div key={category} className={`rounded-xl border p-4 space-y-3 ${catColor}`}>
                                            {/* Category header */}
                                            <div className="flex items-center justify-between">
                                                <p className={`text-xs font-semibold uppercase tracking-wide ${catLabel}`}>{category}</p>
                                                <span className="text-xs text-muted-foreground">{skills.length} skill{skills.length !== 1 ? "s" : ""}</span>
                                            </div>

                                            {/* Individual skills with bars */}
                                            {skills
                                                .slice()
                                                .sort((a, b) => b.proficiency - a.proficiency)
                                                .map((skill, i) => {
                                                    const barColor = skill.proficiency >= 7 ? "bg-emerald-500"
                                                        : skill.proficiency >= 4 ? "bg-amber-500" : "bg-red-500"
                                                    return (
                                                        <div key={i}>
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="text-sm text-foreground">{skill.name}</span>
                                                                <span className="text-xs text-muted-foreground tabular-nums">
                                                                    {skill.proficiency.toFixed(1)}<span className="text-muted-foreground/40">/10</span>
                                                                </span>
                                                            </div>
                                                            <Bar value={skill.proficiency} max={10} color={barColor} />
                                                        </div>
                                                    )
                                                })}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* ── SECTION 3: REQUIRED SKILLS — grouped by category ───────────── */}
                    {result.required_skills.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <Target className="size-4 text-primary" />
                                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Role Requirements</h3>
                                <span className="text-xs text-muted-foreground">
                                    {result.required_skills.length} skills extracted from job description
                                </span>
                            </div>

                            {/* Parent div — one sub-card per category */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {Object.entries(requiredByCat).map(([category, skills]) => (
                                    <div key={category} className="rounded-xl border border-border bg-secondary/20 p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{category}</p>
                                            <span className="text-xs text-muted-foreground">{skills.length} required</span>
                                        </div>

                                        {skills
                                            .slice()
                                            .sort((a, b) => b.proficiency - a.proficiency)
                                            .map((skill, i) => {
                                                const isMissing = result.missing_skills.includes(skill.name)
                                                const isWeak = result.weak_skills.includes(skill.name)
                                                const isStrong = result.strong_skills.includes(skill.name)
                                                const textColor = isMissing ? "text-red-400" : isWeak ? "text-amber-400" : isStrong ? "text-emerald-400" : "text-foreground"
                                                const barColor = isMissing ? "bg-red-500/50" : isWeak ? "bg-amber-500/50" : "bg-emerald-500/50"
                                                return (
                                                    <div key={i}>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className={`text-sm font-medium ${textColor}`}>{skill.name}</span>
                                                                {isMissing && <span className="text-xs text-red-400/70 border border-red-400/30 rounded-full px-1.5">missing</span>}
                                                                {isWeak && <span className="text-xs text-amber-400/70 border border-amber-400/30 rounded-full px-1.5">gap</span>}
                                                                {isStrong && <span className="text-xs text-emerald-400/70">✓</span>}
                                                            </div>
                                                            <span className="text-xs text-muted-foreground tabular-nums">
                                                                {skill.proficiency.toFixed(1)}<span className="text-muted-foreground/40">/10</span>
                                                            </span>
                                                        </div>
                                                        <Bar value={skill.proficiency} max={10} color={barColor} />
                                                    </div>
                                                )
                                            })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── SECTION 4: SKILL GAP DETAIL — dual bar per gap ─────────────── */}
                    {result.skill_gaps.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <TrendingDown className="size-4 text-primary" />
                                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Gap Breakdown</h3>
                                <span className="text-xs text-muted-foreground">{result.skill_gaps.length} gap{result.skill_gaps.length !== 1 ? "s" : ""} identified</span>
                            </div>

                            {/* Parent div — one card per gap */}
                            <div className="space-y-3">
                                {result.skill_gaps.map((g, i) => (
                                    <Card key={i} className="border-border bg-card p-4">
                                        {/* Header */}
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-foreground">{g.skill}</span>
                                                <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${GAP_COLORS[g.gap_severity] ?? GAP_COLORS.medium}`}>
                                                    {g.gap_severity}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Star className="size-3" />
                                                importance: <span className="text-foreground font-medium ml-0.5">{g.importance.toFixed(1)}/10</span>
                                            </div>
                                        </div>

                                        {/* Dual bars */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {/* Your level */}
                                            <div>
                                                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                                                    <span>Your level</span>
                                                    <span className="tabular-nums font-medium text-foreground">{g.current_proficiency.toFixed(1)}/10</span>
                                                </div>
                                                <Bar value={g.current_proficiency} max={10} color="bg-primary/80" />
                                            </div>

                                            {/* Required level */}
                                            <div>
                                                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                                                    <span>Required level</span>
                                                    <span className="tabular-nums font-medium text-foreground">{g.required_proficiency.toFixed(1)}/10</span>
                                                </div>
                                                <div className="relative w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                                                    {/* Required bar background */}
                                                    <div
                                                        className="h-full rounded-full bg-foreground/20 transition-all duration-700"
                                                        style={{ width: `${Math.min(100, (g.required_proficiency / 10) * 100)}%` }}
                                                    />
                                                    {/* Gap overlay — shows what's missing */}
                                                    {g.current_proficiency < g.required_proficiency && (
                                                        <div
                                                            className={`absolute top-0 h-full rounded-r-full opacity-70 transition-all duration-700 ${g.gap_severity === "critical" ? "bg-red-500"
                                                                : g.gap_severity === "high" ? "bg-orange-500"
                                                                    : g.gap_severity === "medium" ? "bg-amber-500"
                                                                        : "bg-yellow-500"}`}
                                                            style={{
                                                                left: `${(g.current_proficiency / 10) * 100}%`,
                                                                width: `${((g.required_proficiency - g.current_proficiency) / 10) * 100}%`,
                                                            }}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Gap delta label */}
                                        {g.current_proficiency < g.required_proficiency && (
                                            <p className="text-xs text-muted-foreground mt-3">
                                                Gap: <span className={`font-semibold ${g.gap_severity === "critical" ? "text-red-400"
                                                    : g.gap_severity === "high" ? "text-orange-400"
                                                        : g.gap_severity === "medium" ? "text-amber-400"
                                                            : "text-yellow-400"}`}>
                                                    −{(g.required_proficiency - g.current_proficiency).toFixed(1)} points
                                                </span> below requirement
                                            </p>
                                        )}
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── SECTION 5: COURSE RECOMMENDATIONS ──────────────────────────── */}
                    {result.course_recommendations.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <BookOpen className="size-4 text-primary" />
                                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Recommended Courses</h3>
                                {result.total_learning_time > 0 && (
                                    <span className="text-xs text-muted-foreground">
                                        ~{result.total_learning_time.toFixed(0)}h total · ~{Math.ceil(result.total_learning_time / 40)} weeks
                                    </span>
                                )}
                            </div>

                            {/* Parent div — 2-column grid of course cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {result.course_recommendations.map((c, i) => (
                                    <div key={i} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">{c.course_title}</p>
                                            {c.is_free && (
                                                <span className="shrink-0 text-xs font-bold text-emerald-400 border border-emerald-400/30 bg-emerald-400/10 rounded-full px-2 py-0.5">
                                                    Free
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap gap-1.5">
                                            <span className="text-xs text-muted-foreground border border-border bg-secondary/50 rounded-full px-2 py-0.5">{c.platform}</span>
                                            <span className="text-xs text-muted-foreground border border-border bg-secondary/50 rounded-full px-2 py-0.5 capitalize">{c.level}</span>
                                            <span className="text-xs text-muted-foreground border border-border bg-secondary/50 rounded-full px-2 py-0.5">{c.duration_hours}h</span>
                                        </div>

                                        <p className="text-xs text-muted-foreground/70">
                                            For: <span className="text-muted-foreground">{c.skill}</span>
                                        </p>

                                        {c.url && (
                                            <a href={c.url} target="_blank" rel="noopener noreferrer"
                                                className="mt-auto text-xs font-medium text-primary underline underline-offset-2 hover:no-underline self-start">
                                                View Course →
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── SECTION 6: ANALYSIS WARNINGS ────────────────────────────────── */}
                    {result.errors && result.errors.length > 0 && (
                        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                            <p className="font-medium mb-1">Analysis warnings:</p>
                            <ul className="space-y-0.5">{result.errors.map((e, i) => <li key={i}>• {e}</li>)}</ul>
                        </div>
                    )}

                    {/* ── SECTION 7: ACTIONS ───────────────────────────────────────────── */}
                    <div className="flex flex-wrap gap-3 pt-1">
                        <Button onClick={handleDownloadSummary} variant="outline" className="gap-2 bg-transparent">
                            <Download className="size-4" />Download Summary
                        </Button>
                        <Button onClick={handleDelete} variant="outline"
                            className="gap-2 bg-transparent text-destructive border-destructive/40 hover:bg-destructive/10">
                            <Trash2 className="size-4" />Delete Analysis
                        </Button>
                        <Button onClick={handleReset} variant="ghost" className="gap-2 ml-auto">
                            <RefreshCw className="size-4" />New Analysis
                        </Button>
                    </div>

                </div>
            )}
        </section>
    )
}
