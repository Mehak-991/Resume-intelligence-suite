"use client"

import { FileText, TrendingUp, Target, Zap, BarChart3, CheckCircle2 } from "lucide-react"
import { motion } from "framer-motion"

export function DashboardPreview() {
  return (
    <motion.div
      className="rounded-3xl bg-card/50 border border-border p-4 md:p-6 backdrop-blur-sm overflow-hidden"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease: "easeOut" }}
    >
      {/* Top Navigation Pills */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        {["Overview", "Analysis", "Suggestions", "History", "Settings"].map((tab, i) => (
          <motion.button
            key={tab}
            className={`px-4 py-2 rounded-xl text-sm whitespace-nowrap transition-all ${i === 0
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 + i * 0.06, duration: 0.4, ease: "easeOut" }}
          >
            {tab}
          </motion.button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Panel - Stats */}
        <div className="lg:col-span-1 space-y-4">
          {/* ATS Score */}
          <motion.div
            className="rounded-2xl bg-secondary/50 p-5"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="size-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Target className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ATS Score</p>
                <p className="text-2xl font-bold text-foreground">74%</p>
              </div>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                whileInView={{ width: "74%" }}
                viewport={{ once: true }}
                transition={{ delay: 0.5, duration: 1, ease: "easeOut" }}
              />
            </div>
          </motion.div>

          {/* Quick Stats */}
          <div className="space-y-3">
            {[
              { label: "Keywords Matched", value: "12/18", icon: CheckCircle2 },
              { label: "Skills Identified", value: "8", icon: Zap },
              { label: "Improvement Areas", value: "5", icon: TrendingUp },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                className="flex items-center gap-3 rounded-xl bg-secondary/30 p-3"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, ease: "easeOut", delay: 0.15 + i * 0.07 }}
              >
                <div className="size-8 rounded-lg bg-secondary flex items-center justify-center">
                  <item.icon className="size-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{item.label}</p>
                  <p className="text-sm font-medium text-foreground">{item.value}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Progress Bars */}
          <motion.div
            className="rounded-2xl bg-secondary/30 p-4 space-y-3"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, ease: "easeOut", delay: 0.35 }}
          >
            {[
              { label: "Experience Match", value: 85 },
              { label: "Education Fit", value: 70 },
              { label: "Skills Alignment", value: 62 },
            ].map((item, i) => (
              <div key={item.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="text-foreground">{item.value}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-primary/70"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${item.value}%` }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.6 + i * 0.1, duration: 0.9, ease: "easeOut" }}
                  />
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-4">
          {/* Large Preview Card */}
          <motion.div
            className="rounded-2xl bg-secondary/30 border border-border/50 p-6 min-h-[200px] flex flex-col"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="size-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <FileText className="size-5 text-primary" />
              </div>
              <div>
                <h4 className="font-medium text-foreground">Resume Preview</h4>
                <p className="text-xs text-muted-foreground">Last updated 2 hours ago</p>
              </div>
            </div>
            <div className="flex-1 rounded-xl bg-muted/30 border border-border/30 p-4">
              <div className="space-y-3">
                {[75, 100, 83, 67].map((w, i) => (
                  <motion.div
                    key={i}
                    className="h-3 rounded-full bg-muted/50"
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.45 + i * 0.08, duration: 0.5, ease: "easeOut" }}
                    style={{ width: `${w}%`, transformOrigin: "left" }}
                  />
                ))}
              </div>
            </div>
          </motion.div>

          {/* Bottom Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: "Suggestions", icon: TrendingUp, value: "5 new" },
              { label: "Analytics", icon: BarChart3, value: "View" },
              { label: "Export", icon: FileText, value: "PDF" },
            ].map((item, i) => (
              <motion.button
                key={item.label}
                className="rounded-2xl bg-secondary/50 border border-border/50 p-4 hover:bg-secondary/70 hover:border-primary/30 transition-all group"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, ease: "easeOut", delay: 0.3 + i * 0.07 }}
                whileHover={{ y: -3, transition: { duration: 0.15 } }}
              >
                <div className="size-8 rounded-lg bg-muted/50 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors">
                  <item.icon className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.value}</p>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Center Decorative Element */}
      <div className="flex justify-center mt-6">
        <div className="size-10 rounded-full border-2 border-border flex items-center justify-center">
          <motion.div
            className="size-2 rounded-full bg-primary"
            animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </div>
    </motion.div>
  )
}
