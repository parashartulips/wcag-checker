"use client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Pencil, Trash2, ExternalLink, RefreshCw, Save, X, Plus, AlertCircle } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "@/components/ui/use-toast"

interface Project {
  id: string
  name: string
  urls: { url: string }[]
  scans: { id: string; createdAt: string }[]
}

interface ProjectListProps {
  projects: Project[]
}

interface ValidationErrors {
  name?: string
  urls?: string[]
  general?: string
}

const MAX_URLS = 10

export function ProjectList({ projects: initialProjects }: ProjectListProps) {
  const [projects, setProjects] = useState(initialProjects)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState<{
    name: string
    urls: string[]
  }>({ name: "", urls: [] })
  const [isSaving, setIsSaving] = useState(false)
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({})

  const handleEdit = (project: Project) => {
    setEditingId(project.id)
    setEditData({
      name: project.name,
      urls: project.urls.map(u => u.url)
    })
    setValidationErrors({})
  }

  const handleCancel = () => {
    setEditingId(null)
    setEditData({ name: "", urls: [] })
    setValidationErrors({})
  }

  const handleNameChange = (value: string) => {
    setEditData(prev => ({ ...prev, name: value }))
    // Clear name validation error when user starts typing
    if (validationErrors.name) {
      setValidationErrors(prev => ({ ...prev, name: undefined }))
    }
  }

  const handleUrlChange = (index: number, value: string) => {
    setEditData(prev => ({
      ...prev,
      urls: prev.urls.map((url, i) => i === index ? value : url)
    }))
    // Clear URL-specific validation errors when user starts typing
    if (validationErrors.urls && validationErrors.urls[index]) {
      const newUrlErrors = [...(validationErrors.urls || [])]
      newUrlErrors[index] = ""
      setValidationErrors(prev => ({ ...prev, urls: newUrlErrors }))
    }
  }

  const handleAddUrl = () => {
    if (editData.urls.length < MAX_URLS) {
      setEditData(prev => ({
        ...prev,
        urls: [...prev.urls, ""]
      }))
    }
  }

  const handleRemoveUrl = (index: number) => {
    setEditData(prev => ({
      ...prev,
      urls: prev.urls.filter((_, i) => i !== index)
    }))
    // Remove corresponding validation error
    if (validationErrors.urls) {
      const newUrlErrors = validationErrors.urls.filter((_, i) => i !== index)
      setValidationErrors(prev => ({ ...prev, urls: newUrlErrors }))
    }
  }

  const validateData = () => {
    const errors: ValidationErrors = {}
    
    // Validate project name
    if (!editData.name.trim()) {
      errors.name = "Project name is required"
    } else if (editData.name.trim().length < 2) {
      errors.name = "Project name must be at least 2 characters long"
    } else if (editData.name.trim().length > 100) {
      errors.name = "Project name must be less than 100 characters"
    }

    // Validate URLs
    const validUrls = editData.urls.filter(url => url.trim() !== "")
    const urlErrors: string[] = []
    
    if (validUrls.length === 0) {
      errors.general = "At least one URL is required"
    } else if (validUrls.length > MAX_URLS) {
      errors.general = `Maximum ${MAX_URLS} URLs allowed per project`
    }

    // Check each URL
    const seenUrls = new Set<string>()
    editData.urls.forEach((url, index) => {
      const trimmedUrl = url.trim()
      
      if (trimmedUrl === "") {
        urlErrors[index] = ""
        return
      }

      // Check for duplicates
      if (seenUrls.has(trimmedUrl.toLowerCase())) {
        urlErrors[index] = "Duplicate URL"
        return
      }
      seenUrls.add(trimmedUrl.toLowerCase())

      // Validate URL format
      let formattedUrl = trimmedUrl
      if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
        formattedUrl = 'https://' + formattedUrl
      }

      try {
        const urlObj = new URL(formattedUrl)
        if (!urlObj.hostname.includes('.')) {
          urlErrors[index] = "Invalid URL format"
        }
      } catch (error) {
        urlErrors[index] = "Invalid URL format"
      }
    })

    if (urlErrors.some(error => error !== "")) {
      errors.urls = urlErrors
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async (id: string) => {
    // Clear previous errors
    setValidationErrors({})

    // Validate all data
    if (!validateData()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors below before saving",
        variant: "destructive"
      })
      return
    }

    const validUrls = editData.urls.filter(url => url.trim() !== "").map(url => {
      const trimmedUrl = url.trim()
      if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
        return 'https://' + trimmedUrl
      }
      return trimmedUrl
    })

    setIsSaving(true)
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: editData.name.trim(), 
          urls: validUrls 
        })
      })

      if (!response.ok) throw new Error('Failed to update project')

      // Update local state
      setProjects(projects.map(p =>
        p.id === id ? { 
          ...p, 
          name: editData.name.trim(),
          urls: validUrls.map(url => ({ url }))
        } : p
      ))
      
      setEditingId(null)
      setEditData({ name: "", urls: [] })
      setValidationErrors({})
      
      toast({
        title: "Success",
        description: `Project "${editData.name.trim()}" updated successfully with ${validUrls.length} URL${validUrls.length !== 1 ? 's' : ''}`
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update project",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    const project = projects.find(p => p.id === id)
    if (!confirm(`Are you sure you want to delete "${project?.name}"? This action cannot be undone.`)) return

    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete project')

      setProjects(projects.filter(p => p.id !== id))
      toast({
        title: "Success",
        description: `Project "${project?.name}" deleted successfully`
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete project",
        variant: "destructive"
      })
    }
  }

  const handleRescan = async (id: string) => {
    const project = projects.find(p => p.id === id)
    try {
      const response = await fetch(`/api/projects/${id}/rescan`, {
        method: 'POST'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to start rescan')
      }

      toast({
        title: "Rescan Started",
        description: `Started rescanning ${project?.urls.length} URL${project?.urls.length !== 1 ? 's' : ''} for "${project?.name}"`
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start rescan",
        variant: "destructive"
      })
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <Card key={project.id} className="flex flex-col">
          <CardHeader>
            {editingId === project.id ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Project Name</label>
                  <Input
                    value={editData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Enter project name"
                    className={`${validationErrors.name ? 'border-red-500 focus:border-red-500' : ''}`}
                  />
                  {validationErrors.name && (
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {validationErrors.name}
                    </p>
                  )}
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">
                      URLs ({editData.urls.filter(url => url.trim()).length}/{MAX_URLS})
                    </label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddUrl}
                      disabled={editData.urls.length >= MAX_URLS}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add URL
                    </Button>
                  </div>
                  
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {editData.urls.map((url, index) => (
                      <div key={index} className="space-y-1">
                        <div className="flex gap-2">
                          <Input
                            value={url}
                            onChange={(e) => handleUrlChange(index, e.target.value)}
                            placeholder="https://example.com"
                            className={`flex-1 ${validationErrors.urls?.[index] ? 'border-red-500 focus:border-red-500' : ''}`}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveUrl(index)}
                            disabled={editData.urls.length <= 1}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        {validationErrors.urls?.[index] && (
                          <p className="text-xs text-red-600 flex items-center gap-1 ml-1">
                            <AlertCircle className="h-3 w-3" />
                            {validationErrors.urls[index]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {editData.urls.length >= MAX_URLS && (
                    <p className="text-xs text-orange-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Maximum {MAX_URLS} URLs allowed for optimal performance
                    </p>
                  )}

                  {validationErrors.general && (
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      {validationErrors.general}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleSave(project.id)}
                    disabled={isSaving}
                    className="flex-1"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                    disabled={isSaving}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <CardTitle className="flex items-center justify-between">
                  <span className="truncate">{project.name}</span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(project)}
                      title="Edit project"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(project.id)}
                      title="Delete project"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>
                  {project.urls.length} URL{project.urls.length !== 1 ? 's' : ''} •
                  Last scan: {project.scans[0]?.createdAt
                    ? new Date(project.scans[0].createdAt).toLocaleDateString()
                    : 'Never'}
                </CardDescription>
              </>
            )}
          </CardHeader>

          {editingId !== project.id && (
            <>
              <CardContent className="flex-1">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">URLs:</h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {project.urls.map((url, index) => (
                      <div key={index} className="text-sm text-gray-600 truncate" title={url.url}>
                        {url.url}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>

              <CardFooter className="pt-4">
                <div className="flex gap-2 w-full">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRescan(project.id)}
                    className="flex-1"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Rescan
                  </Button>
                  <Link href={`/projects/${project.id}`} className="flex-1">
                    <Button variant="default" size="sm" className="w-full">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Results
                    </Button>
                  </Link>
                </div>
              </CardFooter>
            </>
          )}
        </Card>
      ))}
    </div>
  )
} 