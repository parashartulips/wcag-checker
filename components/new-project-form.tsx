"use client"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { toast } from "@/components/ui/use-toast"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Download } from "lucide-react"

const projectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  sitemapUrl: z.string().optional().refine(
    (val) => !val || val === "" || z.string().url().safeParse(val).success,
    "Please enter a valid sitemap URL"
  ),
  urls: z.string().optional(),
  wcagLevel: z.enum(["a", "aa", "aaa"]).default("aa"),
  section508: z.boolean().default(false),
  bestPractices: z.boolean().default(true),
  experimental: z.boolean().default(false),
}).refine(
  (data) => data.sitemapUrl || data.urls,
  {
    message: "Either provide a sitemap URL or enter URLs manually",
    path: ["urls"],
  }
)

type ProjectFormData = z.infer<typeof projectSchema>

export function NewProjectForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingSitemap, setIsFetchingSitemap] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    getValues,
    watch
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      wcagLevel: "aa",
      section508: false,
      bestPractices: true,
      experimental: false,
    },
  })

  const watchedSitemapUrl = watch("sitemapUrl")
  const watchedUrls = watch("urls")

  const fetchSitemapUrls = async () => {
    const sitemapUrl = watchedSitemapUrl?.trim()
    
    if (!sitemapUrl) {
      toast({
        title: "Error",
        description: "Please enter a sitemap URL",
        variant: "destructive",
      })
      return
    }

    let url = sitemapUrl
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`
    }

    // Check if the URL ends with sitemap.xml, if not append it
    if (!url.includes("sitemap.xml") && !url.includes("sitemap")) {
      if (url.endsWith("/")) {
        url += "sitemap.xml"
      } else {
        url += "/sitemap.xml"
      }
    }

    setIsFetchingSitemap(true)
    try {
      const response = await fetch(`/api/sitemap?url=${encodeURIComponent(url)}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch sitemap: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      if (data.urls && data.urls.length > 0) {
        // Add the URLs to our textarea, preserving any existing URLs
        const existingUrls = watchedUrls ? watchedUrls.split("\n").filter(u => u.trim() !== "") : []
        const newUrls = [...new Set([...existingUrls, ...data.urls])]
        const MAX_URLS = 10
        
        // Limit to MAX_URLS
        if (newUrls.length > MAX_URLS) {
          setValue("urls", newUrls.slice(0, MAX_URLS).join("\n"))
          toast({
            title: "URL Limit Applied",
            description: `Added ${MAX_URLS} URLs from the sitemap. For performance reasons, projects are limited to ${MAX_URLS} URLs.`,
            variant: "destructive",
          })
        } else {
          setValue("urls", newUrls.join("\n"))
          toast({
            title: "Sitemap Processed",
            description: `Added ${data.urls.length} unique URLs from the sitemap.`,
          })
        }
      } else {
        toast({
          title: "No URLs Found",
          description: "The sitemap did not contain any valid URLs.",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process sitemap.",
        variant: "destructive",
      })
    } finally {
      setIsFetchingSitemap(false)
    }
  }

  const onSubmit = async (data: ProjectFormData) => {
    try {
      setIsLoading(true)
      setError(null)

      // Process URLs
      let urls: string[] = []
      const MAX_URLS = 10

      if (data.urls) {
        // Process manually entered URLs with validation
        const rawUrls = data.urls
          .split("\n")
          .map((url) => url.trim())
          .filter((url) => url.length > 0)
        
        // Validate and format URLs
        const invalidUrls: string[] = []
        for (const rawUrl of rawUrls) {
          let formattedUrl = rawUrl
          
          // Add protocol if missing
          if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
            formattedUrl = 'https://' + formattedUrl
          }
          
          // Validate URL format
          try {
            new URL(formattedUrl)
            urls.push(formattedUrl)
          } catch (error) {
            console.warn(`Invalid URL skipped: ${rawUrl}`)
            invalidUrls.push(rawUrl)
          }
        }
        
        // Show warning if some URLs were invalid
        if (invalidUrls.length > 0) {
          toast({
            title: "Invalid URLs Skipped",
            description: `${invalidUrls.length} invalid URLs were skipped: ${invalidUrls.slice(0, 3).join(', ')}${invalidUrls.length > 3 ? '...' : ''}`,
            variant: "destructive",
          })
        }
      }

      // Enforce URL limit
      if (urls.length > MAX_URLS) {
        toast({
          title: "URL Limit Exceeded",
          description: `Only the first ${MAX_URLS} URLs will be processed. For performance reasons, projects are limited to ${MAX_URLS} URLs.`,
          variant: "destructive",
        })
        urls = urls.slice(0, MAX_URLS)
      }

      // Validate at least one valid URL is provided
      if (urls.length === 0 && !data.sitemapUrl) {
        throw new Error("At least one valid URL is required")
      }

      // Create project
      const projectResponse = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          urls,
          complianceOptions: {
            wcagLevel: data.wcagLevel,
            section508: data.section508,
            bestPractices: data.bestPractices,
            experimental: data.experimental,
          },
        }),
      })

      if (!projectResponse.ok) {
        const errorData = await projectResponse.json()
        throw new Error(errorData.error || "Failed to create project")
      }

      const project = await projectResponse.json()

      // Create scans for each URL
      if (urls.length > 0) {
        const scanPromises = urls.map((url) =>
          fetch("/api/scans", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: project.id,
              url,
              complianceOptions: {
                wcagLevel: data.wcagLevel,
                section508: data.section508,
                bestPractices: data.bestPractices,
                experimental: data.experimental,
              },
            }),
          })
        )

        await Promise.all(scanPromises)
      }

      toast({
        title: "Success",
        description: "Project created successfully"
      })

      router.push(`/projects/${project.id}`)
      router.refresh()
    } catch (error) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Project Name</Label>
        <Input
          id="name"
          {...register("name")}
          placeholder="Enter project name"
          disabled={isLoading}
        />
        {errors.name && (
          <p className="text-sm text-red-500">{errors.name.message}</p>
        )}
      </div>

      {/* Sitemap Import Section */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <Label>Import URLs from Sitemap (Optional)</Label>
            <div className="flex gap-2">
              <Input
                id="sitemapUrl"
                {...register("sitemapUrl")}
                placeholder="https://example.com/sitemap.xml"
                disabled={isLoading || isFetchingSitemap}
                className="flex-1"
              />
              <Button 
                type="button" 
                variant="secondary" 
                onClick={fetchSitemapUrls}
                disabled={isLoading || isFetchingSitemap || !watchedSitemapUrl}
              >
                {isFetchingSitemap ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Import
                  </>
                )}
              </Button>
            </div>
            {errors.sitemapUrl && (
              <p className="text-sm text-red-500">{errors.sitemapUrl.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Label htmlFor="urls">URLs to Analyze</Label>
        <Textarea
          id="urls"
          {...register("urls")}
          placeholder="Enter URLs (one per line)&#10;https://example.com&#10;https://example.com/about&#10;https://example.com/contact"
          disabled={isLoading}
          rows={8}
          className="resize-y"
        />
        <p className="text-xs text-gray-600">
          Maximum 10 URLs allowed per project for optimal performance and faster scan times.
        </p>
        {errors.urls && (
          <p className="text-sm text-red-500">{errors.urls.message}</p>
        )}
      </div>

      <div className="space-y-4">
        <Label>Compliance Options</Label>
        
        <div className="space-y-2">
          <Label htmlFor="wcagLevel">WCAG Level</Label>
          <select
            id="wcagLevel"
            {...register("wcagLevel")}
            className="w-full rounded-md border border-input bg-background px-3 py-2"
            disabled={isLoading}
          >
            <option value="a">WCAG 2.1 Level A</option>
            <option value="aa">WCAG 2.1 Level AA</option>
            <option value="aaa">WCAG 2.1 Level AAA</option>
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="section508"
            {...register("section508")}
            disabled={isLoading}
          />
          <Label htmlFor="section508">Include Section 508 Requirements</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="bestPractices"
            {...register("bestPractices")}
            disabled={isLoading}
          />
          <Label htmlFor="bestPractices">Include Best Practices</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="experimental"
            {...register("experimental")}
            disabled={isLoading}
          />
          <Label htmlFor="experimental">Include Experimental Rules</Label>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating Project...
          </>
        ) : (
          "Create Project"
        )}
      </Button>
    </form>
  )
} 