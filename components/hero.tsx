"use client"

import Link from "next/link"
import { ArrowRight, Sparkles } from "lucide-react"
import { motion } from "framer-motion"

export function Hero() {
  return (
    <section className="relative px-4 py-20 md:py-32 overflow-hidden">
      {/* Ambient radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div className="w-[700px] h-[400px] rounded-full bg-primary/10 blur-[120px] opacity-60" />
      </div>

      {/* Floating dots decoration */}
      {[
        { top: "15%", left: "8%", delay: 0 },
        { top: "70%", left: "5%", delay: 0.4 },
        { top: "25%", right: "6%", delay: 0.2 },
        { top: "65%", right: "10%", delay: 0.6 },
      ].map((pos, i) => (
        <motion.div
          key={i}
          aria-hidden
          className="pointer-events-none absolute size-1.5 rounded-full bg-primary/50"
          style={{ top: pos.top, left: (pos as any).left, right: (pos as any).right }}
          animate={{ y: [0, -10, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 3 + i * 0.5, repeat: Infinity, ease: "easeInOut", delay: pos.delay }}
        />
      ))}

      <div className="relative mx-auto max-w-4xl text-center">
        {/* Badge */}
        <motion.div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm mb-8"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0 }}
        >
          <Sparkles className="size-4" />
          AI-Powered Career Tools
        </motion.div>

        {/* Headline */}
        <motion.h1
          className="text-4xl md:text-6xl font-bold text-foreground mb-6 text-balance leading-tight"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: "easeOut", delay: 0.12 }}
        >
          Optimize Your Resume with{" "}
          <span className="text-primary relative">
            Intelligence
            <motion.span
              className="absolute -bottom-1 left-0 h-px w-full bg-primary/50 rounded-full"
              initial={{ scaleX: 0, originX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.7, duration: 0.6, ease: "easeOut" }}
            />
          </span>
        </motion.h1>

        {/* Subtext */}
        <motion.p
          className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto text-pretty"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: "easeOut", delay: 0.22 }}
        >
          Boost your ATS score, get AI-powered suggestions, and land your dream job faster with our
          comprehensive career suite.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: "easeOut", delay: 0.32 }}
        >
          <Link
            href="/resume"
            className="group flex items-center gap-2 px-8 py-4 rounded-2xl bg-primary text-primary-foreground font-semibold text-lg hover:opacity-90 transition-all shadow-lg shadow-primary/20"
          >
            Start Optimizing
            <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/about"
            className="px-8 py-4 rounded-2xl bg-secondary text-secondary-foreground font-semibold text-lg hover:bg-secondary/80 transition-colors border border-border"
          >
            Learn More
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
