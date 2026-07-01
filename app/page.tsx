import { Header } from "@/components/header"
import { Hero } from "@/components/hero"
import { DashboardPreview } from "@/components/dashboard-preview"
import { FeatureGrid } from "@/components/feature-grid"
import { Footer } from "@/components/footer"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <section className="px-4 pb-16">
          <div className="mx-auto max-w-6xl">
            <DashboardPreview />
          </div>
        </section>
        <FeatureGrid />
      </main>
      <Footer />
    </div>
  )
}
