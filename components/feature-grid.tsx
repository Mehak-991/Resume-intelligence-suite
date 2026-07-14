"use client"

import { memo } from "react"
import { Bot, FileSearch, Mic2, BarChart2, BriefcaseBusiness } from "lucide-react"
import { motion } from "framer-motion"
import { FeatureCard } from "./feature-card"

const features = [
  {
    title: "AI Career Assistant",
    description:
      "Get personalized career advice, resume tips, and job-hunting strategies from your 24/7 AI-powered career coach.",
    icon: Bot,
    href: "/chatbot",
    stats: "24/7 available",
  },
  {
    title: "Document Summarizer",
    description:
      "Extract key insights from any document, article, or webpage in seconds and save hours of reading time.",
    icon: FileSearch,
    href: "/document-summarizer",
    stats: "10k+ docs processed",
  },
  {
    title: "AI Mock Interview",
    description:
      "Practice with AI-generated interview questions tailored to your target role and get instant feedback.",
    icon: Mic2,
    href: "/mock-interview",
    stats: "AI-powered feedback",
  },
  {
    title: "Skill Gap Analyzer",
    description:
      "Identify the exact skills missing for your dream job and get a personalized roadmap to close those gaps fast.",
    icon: BarChart2,
    href: "/skill-gap-analyzer",
    stats: "Role-specific insights",
  },
  {
    title: "Find Your Next Opportunity",
    description:
      "Receive real-time job alerts matched to your profile from thousands of companies actively hiring right now.",
    icon: BriefcaseBusiness,
    href: "/opportunities",
    stats: "Real-time alerts",
  },
]

export const FeatureGrid = memo(function FeatureGrid() {
  return (
    <section className="px-4 py-20" aria-labelledby="features-heading">
      <div className="mx-auto max-w-7xl">
        {/* Section header */}
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2
            id="features-heading"
            className="text-3xl md:text-4xl font-bold text-foreground mb-4"
          >
            Everything You Need to Succeed
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-balance">
            A comprehensive suite of AI-powered tools designed to accelerate your career growth —
            all in one place.
          </p>
        </motion.div>

        {/* Responsive grid:
            Mobile  (< md) : 1 column
            Tablet  (md)   : 2 columns
            Desktop (lg)   : 3 columns
            XL      (xl)   : 5 columns (all 5 in one row)
        */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {features.map((feature, i) => (
            <FeatureCard key={feature.title} {...feature} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
})
