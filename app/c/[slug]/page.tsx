"use client"

import { useParams } from "next/navigation"
import { Suspense } from "react"
import { AudioRecorder } from "@/components/audio-recorder"

export default function CategoryPage() {
  const params = useParams<{ slug: string }>()
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug

  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="text-muted-foreground">Cargando...</div></div>}>
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <AudioRecorder categoryId={slug} />
        </div>
      </div>
    </Suspense>
  )
}

