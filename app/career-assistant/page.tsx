"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function CareerAssistantPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to chatbot with career assistant context
    router.push("/chatbot")
  }, [router])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
        <p className="text-muted-foreground">Loading AI Career Assistant...</p>
      </div>
    </div>
  )
}
