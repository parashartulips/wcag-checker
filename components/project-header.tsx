"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pencil, Save, X, RefreshCw, ChevronLeft } from "lucide-react"
import { useState } from "react"
import { toast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface Project {
  id: string
  name: string
  urls: { url: string }[]
  scans: {
    id: string
    createdAt: Date
    results: {
      id: string
      url: string
      message: string
      element: string | null
      severity: string
      help: string | null
      tags: string[]
      elementPath: string | null
      details: any
      createdAt: Date
      updatedAt: Date
    }[]
  }[]
}

interface ProjectHeaderProps {
  project: Project
}

export function ProjectHeader({ project }: ProjectHeaderProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(project.name)
  const [isRescanning, setIsRescanning] = useState(false)
  const router = useRouter()

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      })

      if (!response.ok) throw new Error('Failed to update project')

      setIsEditing(false)
      toast({
        title: "Success",
        description: "Project name updated successfully"
      })
      router.refresh()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update project name",
        variant: "destructive"
      })
    }
  }

  const handleRescan = async () => {
    setIsRescanning(true)
    try {
      const response = await fetch(`/api/projects/${project.id}/rescan`, {
        method: 'POST'
      })

      if (!response.ok) throw new Error('Failed to start rescan')

      toast({
        title: "Success",
        description: "Rescan started successfully"
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start rescan",
        variant: "destructive"
      })
    } finally {
      setIsRescanning(false)
      router.refresh()
    }
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-64"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
            >
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsEditing(false)
                setName(project.name)
              }}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-bold">{project.name}</h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      <div className="fixed top-5 left-10">
        <Link href="/" className="bg-white py-1 px-4 rounded-md text-black flex items-center gap-2"> <ChevronLeft className="h-4 w-4" /> Back</Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-sm text-gray-500">
          {project.urls.length} URL{project.urls.length !== 1 ? 's' : ''} •
          Last scan: {project.scans[0]?.createdAt
            ? new Date(project.scans[0].createdAt).toLocaleDateString()
            : 'Never'}
        </div>
        <Button
          variant="outline"
          onClick={handleRescan}
          disabled={isRescanning}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRescanning ? 'animate-spin' : ''}`} />
          {isRescanning ? 'Rescanning...' : 'Rescan'}
        </Button>
      </div>
    </div>
  )
} 