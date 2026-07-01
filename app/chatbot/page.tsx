"use client"

import { useState, useRef, useEffect } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Upload, Send, Bot, User, Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

interface Message {
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

export default function ChatbotPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [sessionId] = useState(() => `session-${Date.now()}`)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const pdfFiles = Array.from(files).filter((file) => file.type === "application/pdf")

    if (pdfFiles.length === 0) {
      alert("Please upload PDF files only")
      return
    }

    setIsLoading(true)
    const formData = new FormData()
    pdfFiles.forEach((file) => formData.append("files", file))

    try {
      const response = await fetch("/api/chatbot/upload", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) throw new Error("Upload failed")

      const data = await response.json()
      setUploadedFiles((prev) => [...prev, ...pdfFiles])

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Successfully processed ${data.files_processed} file(s) with ${data.total_chunks} chunks. You can now ask questions about the content.`,
          timestamp: new Date(),
        },
      ])
    } catch (error) {
      console.error("[v0] Upload error:", error)
      alert("Failed to upload files. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      role: "user",
      content: inputValue,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue("")
    setIsLoading(true)

    try {
      const response = await fetch("/api/chatbot/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: inputValue,
          session_id: sessionId,
        }),
      })

      if (!response.ok) throw new Error("Query failed")

      const data = await response.json()

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer,
          timestamp: new Date(),
        },
      ])
    } catch (error) {
      console.error("[v0] Query error:", error)
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const clearChat = () => {
    setMessages([])
    setUploadedFiles([])
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="px-4 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">AI Chatbot</h1>
            <p className="text-muted-foreground">Upload PDFs and ask questions about their content</p>
          </div>

          <Card className="border-border bg-card">
            {/* Upload Section */}
            <div className="p-6 border-b border-border">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileUpload(e.target.files)}
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="gap-2"
                  disabled={isLoading}
                >
                  <Upload className="size-4" />
                  Upload PDFs
                </Button>
                {uploadedFiles.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{uploadedFiles.length} file(s) uploaded</span>
                    </div>
                    <Button onClick={clearChat} variant="outline" size="sm" className="gap-2 ml-auto bg-transparent">
                      <Trash2 className="size-4" />
                      Clear Chat
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Messages Section */}
            <div className="h-[500px] overflow-y-auto p-6 space-y-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                    <Bot className="size-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Start a Conversation</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Upload one or more PDF files and ask questions about their content. The AI will provide contextual
                    answers based on the documents.
                  </p>
                </div>
              )}

              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : "flex-row"} animate-in fade-in slide-in-from-bottom-4 duration-300`}
                >
                  <div
                    className={`size-8 rounded-xl flex items-center justify-center shrink-0 ${
                      message.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary"
                    }`}
                  >
                    {message.role === "user" ? <User className="size-4" /> : <Bot className="size-4" />}
                  </div>
                  <div
                    className={`max-w-[80%] rounded-2xl p-4 ${
                      message.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="size-8 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                    <Bot className="size-4" />
                  </div>
                  <div className="rounded-2xl bg-secondary p-4">
                    <div className="flex gap-1">
                      <div className="size-2 rounded-full bg-muted-foreground animate-bounce" />
                      <div className="size-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.2s]" />
                      <div className="size-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Section */}
            <div className="p-6 border-t border-border">
              <div className="flex gap-3">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder="Ask a question about your documents..."
                  className="flex-1"
                  disabled={isLoading || uploadedFiles.length === 0}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={isLoading || !inputValue.trim() || uploadedFiles.length === 0}
                  className="gap-2"
                >
                  {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  Send
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  )
}
