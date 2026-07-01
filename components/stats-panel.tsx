"use client"

interface StatItem {
  label: string
  value: number
  max: number
  color?: string
}

interface StatsPanelProps {
  title: string
  stats: StatItem[]
}

export function StatsPanel({ title, stats }: StatsPanelProps) {
  return (
    <div className="rounded-2xl bg-card border border-border p-6">
      <h3 className="font-semibold text-foreground mb-4">{title}</h3>
      <div className="space-y-4">
        {stats.map((stat, index) => (
          <div key={index}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">{stat.label}</span>
              <span className="text-sm font-medium text-foreground">
                {stat.value}/{stat.max}
              </span>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${(stat.value / stat.max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
