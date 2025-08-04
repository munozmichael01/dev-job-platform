"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function TestAPIPage() {
  const [result, setResult] = useState<string>("")
  const [loading, setLoading] = useState(false)

  const testAPI = async () => {
    setLoading(true)
    try {
      console.log("Testing API connection...")
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
      console.log("Using API URL:", API_URL)
      console.log("Environment:", process.env.NEXT_PUBLIC_API_URL)
      const response = await fetch(`${API_URL}/api/connections`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })
      
      console.log("Response status:", response.status)
      console.log("Response headers:", [...response.headers.entries()])
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      setResult(`✅ SUCCESS: Got ${data.length} connections`)
      console.log("Data received:", data)
    } catch (error) {
      console.error("Error:", error)
      setResult(`❌ ERROR: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>API Connection Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={testAPI} disabled={loading}>
            {loading ? "Testing..." : "Test API Connection"}
          </Button>
          {result && (
            <div className="p-3 bg-gray-100 rounded">
              <pre>{result}</pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}