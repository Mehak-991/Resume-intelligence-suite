"use client"

import { FileText, FileSearch, Briefcase, Bell, Sparkles, Shield } from "lucide-react"
import { motion } from "framer-motion"
import { FeatureCard } from "./feature-card"

const features = [
  {
    title: "Resume Optimizer",
    description: "AI-powered ATS scoring and tailored suggestions to improve your resume.",
    icon: FileText,
    stats: "74% avg improvement",
  },
  {
    title: "Doc Summarizer",
    description: "Extract key insights from any document, article, or webpage instantly.",
    icon: FileSearch,
    stats: "10k+ docs processed",
  },
  {
    title: "Interview Prep",
    description: "Practice interviews with AI-driven questions and real-time feedback.",
    icon: Briefcase,
    stats: "AI-powered",
  },
  {
    title: "Job Alerts",
    description: "Get notified when your dream companies post new opportunities.",
    icon: Bell,
    stats: "Real-time alerts",
  },
  {
    title: "AI Chat Assistant",
    description: "Get personalized career advice and resume tips from our AI.",
    icon: Sparkles,
    stats: "24/7 available",
  },
  {
    title: "Privacy First",
    description: "Your data is encrypted and never shared with third parties.",
    icon: Shield,
    stats: "SOC 2 compliant",
  },
]

export function FeatureGrid() {
  return (
    <section className="px-4 py-20">
      <div className="mx-auto max-w-6xl">
        {/* Section header */}
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="text-3xl font-bold text-foreground mb-4">Everything You Need to Succeed</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            A comprehensive suite of AI-powered tools designed to accelerate your career growth.
          </p>
        </motion.div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature, i) => (
            <FeatureCard key={feature.title} {...feature} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
