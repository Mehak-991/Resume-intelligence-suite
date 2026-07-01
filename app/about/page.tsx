import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Sparkles, Users, Target, Shield } from "lucide-react"

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm mb-6">
              <Sparkles className="size-4" />
              Our Mission
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6 text-balance">
              Empowering Careers Through AI
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
              We're building the most comprehensive AI-powered career suite to help professionals land their dream jobs
              faster.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {[
              {
                icon: Users,
                title: "10K+",
                description: "Professionals helped",
              },
              {
                icon: Target,
                title: "74%",
                description: "Average ATS improvement",
              },
              {
                icon: Shield,
                title: "100%",
                description: "Privacy guaranteed",
              },
            ].map((stat) => (
              <div key={stat.title} className="rounded-2xl bg-card border border-border p-8 text-center">
                <div className="size-12 rounded-xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
                  <stat.icon className="size-6 text-primary" />
                </div>
                <p className="text-3xl font-bold text-foreground mb-1">{stat.title}</p>
                <p className="text-muted-foreground">{stat.description}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-card border border-border p-8 md:p-12">
            <h2 className="text-2xl font-bold text-foreground mb-6">About the Team</h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              We're a passionate team of engineers and career coaches dedicated to democratizing access to professional
              career tools. Our AI-powered solutions are built on cutting-edge machine learning models and years of
              industry expertise.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Note:</strong> LLM integration and AI model development is handled by
              our specialized AI team. We leverage the latest in natural language processing to provide accurate,
              personalized career advice.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
