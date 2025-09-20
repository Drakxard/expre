"use client"
import { Suspense } from "react"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { AudioRecorder } from "@/components/audio-recorder"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Info } from "lucide-react"

function HomeContent() {
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 text-center"></header>

        <Tabs defaultValue="recorder" className="w-full">
          <TabsContent value="recorder" className="space-y-4">
            <AudioRecorder />
          </TabsContent>

          <TabsContent value="info" className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Acceso a carpeta local:</strong> Para guardar y recuperar tus datos localmente, presiona
                <kbd className="bg-muted px-1 py-0.5 rounded text-sm"> Enter </kbd>
                para seleccionar la carpeta <code className="bg-muted px-1 py-0.5 rounded text-sm">/gestor/system</code>.
                Los datos se almacenan en el localStorage de tu navegador.
              </AlertDescription>
            </Alert>

            <div className="bg-card p-6 rounded-lg border">
              <h3 className="text-lg font-semibold mb-4">Funcionalidades:</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Presiona <kbd className="bg-muted px-1 py-0.5 rounded text-xs">+</kbd> para agregar filas</li>
                <li>• Presiona <kbd className="bg-muted px-1 py-0.5 rounded text-xs">Enter</kbd> para configurar acceso a carpeta</li>
                <li>• Nombrar cada fila</li>
                <li>• Marcar cada fila con el check</li>
                <li>• Click en la fila (no el nombre) para agregar o abrir un link</li>
                <li>• Almacenamiento automático en localStorage</li>
                <li>• Interfaz minimalista en tonos café</li>
              </ul>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-muted-foreground">Cargando...</div>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  )
}

