"use client"

import { createContext, useContext, useState, ReactNode } from "react"

// ── Shared resume state ───────────────────────────────────────────────────────
// A single File (PDF) is stored here so both the AI Mock Interview setup and
// the Skill Gap Analyzer section share the same uploaded resume without
// requiring the user to upload twice.

interface ResumeContextValue {
    sharedResume: File | null
    setSharedResume: (file: File | null) => void
}

const ResumeContext = createContext<ResumeContextValue | undefined>(undefined)

export function ResumeProvider({ children }: { children: ReactNode }) {
    const [sharedResume, setSharedResume] = useState<File | null>(null)

    return (
        <ResumeContext.Provider value={{ sharedResume, setSharedResume }}>
            {children}
        </ResumeContext.Provider>
    )
}

export function useSharedResume(): ResumeContextValue {
    const ctx = useContext(ResumeContext)
    if (!ctx) {
        throw new Error("useSharedResume must be used inside <ResumeProvider>")
    }
    return ctx
}
