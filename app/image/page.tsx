"use client"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ImageIcon } from "lucide-react"

export default function ImageLabPage() {
  // TODO: Integrate Stable Diffusion / image generation backend
  // TODO: Add prompt engineering helpers
  // TODO: Add style presets and image controls

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="px-4 py-12">
        <div className="mx-auto max-w-4xl space-y-8">
          <div className="space-y-2 text-center">
            <ImageIcon className="size-16 mx-auto text-muted-foreground/50" />
            <h1 className="text-4xl font-bold">Image Lab</h1>
            <p className="text-muted-foreground text-lg">This feature is under development</p>
          </div>

          <Card className="p-6 space-y-4 opacity-60">
            <div className="space-y-2">
              <label className="text-sm font-medium">Image Prompt</label>
              <Textarea placeholder="Describe the image you want to generate..." rows={4} disabled />
            </div>
            <Button className="w-full" size="lg" disabled>
              Generate Image
            </Button>
          </Card>

          <Card className="p-6 bg-muted/30">
            <h3 className="font-semibold mb-2">Coming Soon</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• AI-powered image generation</li>
              <li>• Multiple style presets</li>
              <li>• High-resolution outputs</li>
              <li>• Batch generation</li>
            </ul>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  )
}
