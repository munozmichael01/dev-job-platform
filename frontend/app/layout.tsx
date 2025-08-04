import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  title: "Plataforma de Distribución de Ofertas",
  description: "Gestión de campañas y distribución de ofertas de empleo",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className="font-sans">
        <SidebarProvider>
          <AppSidebar />
          <main className="flex-1 overflow-auto">{children}</main>
          <Toaster />
        </SidebarProvider>
      </body>
    </html>
  )
}
