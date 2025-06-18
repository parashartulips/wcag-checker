"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import { Loader2 } from "lucide-react"
import { addUrlsForAnalysis } from "@/lib/actions"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { ComplianceOptions } from "@/lib/types"

export function UrlForm() {
  const [urls, setUrls] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [wcagLevel, setWcagLevel] = useState("aa")
  const [complianceOptions, setComplianceOptions] = useState({
    section508: false,
    bestPractices: true,
    experimental: false,
  })
  const [hydrated, setHydrated] = useState(false);
  const [sitemapUrl, setSitemapUrl] = useState("");
  const [isFetchingSitemap, setIsFetchingSitemap] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!urls.trim()) {
      toast({
        title: "Error",
        description: "Please enter at least one URL",
        variant: "destructive",
      })
      return
    }

    // Split by newlines and filter empty lines
    const urlList = urls
      .split("\n")
      .map((url) => url.trim())
      .filter((url) => url.length > 0)
      .map((url) => {
        // Add https:// if no protocol is specified
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
          return `https://${url}`
        }
        return url
      })

    if (urlList.length === 0) {
      toast({
        title: "Error",
        description: "Please enter at least one valid URL",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    toast({
      title: "Starting Analysis",
      description: `Beginning accessibility scan of ${urlList.length} URL(s). This may take a few moments.`,
    })

    try {
      const options: ComplianceOptions = {
        // @ts-ignore
        wcagLevel,
        section508: complianceOptions.section508,
        bestPractices: complianceOptions.bestPractices,
        experimental: complianceOptions.experimental,
      }

      const result = await addUrlsForAnalysis(urlList, options)
      console.log(result,"result")
      toast({
        title: "Analysis Complete",
        description: `Completed accessibility scan of ${result.count} URL(s).`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to analyze URLs. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCheckboxChange = (option: keyof typeof complianceOptions) => {
    setComplianceOptions((prev) => ({
      ...prev,
      [option]: !prev[option],
    }))
  }

  // Sitemap fetch handler
  const fetchSitemapUrls = async () => {
    if (!sitemapUrl) {
      toast({
        title: "Error",
        description: "Please enter a sitemap URL",
        variant: "destructive",
      })
      return
    }

    let url = sitemapUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }

    // Check if the URL ends with sitemap.xml, if not append it
    if (!url.includes("sitemap.xml")) {
      if (url.endsWith("/")) {
        url += "sitemap.xml";
      } else {
        url += "/sitemap.xml";
      }
    }

    setIsFetchingSitemap(true);
    try {
      // Fetch the sitemap using a server action or API endpoint
      const response = await fetch(`/api/sitemap?url=${encodeURIComponent(url)}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch sitemap: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.urls && data.urls.length > 0) {
        // Add the URLs to our textarea, preserving any existing URLs
        const newUrls = [...new Set([...urls.split("\n").filter(u => u.trim() !== ""), ...data.urls])];
        setUrls(newUrls.join("\n"));
        
        toast({
          title: "Sitemap Processed",
          description: `Added ${data.urls.length} unique URLs from the sitemap.`,
        });
      } else {
        toast({
          title: "No URLs Found",
          description: "The sitemap did not contain any valid URLs.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process sitemap.",
        variant: "destructive",
      });
    } finally {
      setIsFetchingSitemap(false);
    }
  };

  useEffect(() => {
    setHydrated(true)
  }, [])
  
  if(!hydrated) {
    return null
  }
  
  // Check if there are any URLs added already
  const hasUrls = urls.trim().length > 0;
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="urls" className="text-sm font-medium">
          Enter URLs (one per line)
        </label>
        <Textarea
          id="urls"
          placeholder="https://example.com&#10;https://example.com/about&#10;https://example.com/contact"
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          rows={6}
          className="resize-y"
        />
      </div>

      {/* Sitemap Scanner */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <Label className="text-sm font-medium">Scan from Sitemap</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Enter sitemap URL (e.g., example.com/sitemap.xml)"
                value={sitemapUrl}
                onChange={(e) => setSitemapUrl(e.target.value)}
                className="flex-1"
              />
              <Button 
                type="button" 
                variant="secondary" 
                onClick={fetchSitemapUrls}
                disabled={isFetchingSitemap}
              >
                {isFetchingSitemap ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Fetching...
                  </>
                ) : (
                  "Import from Sitemap"
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Only show the compliance options if URLs have been added */}
      {hasUrls && (
        <>
          <div className="space-y-4">
            <div>
              <Label htmlFor="wcag-level" className="text-sm font-medium">
                WCAG Compliance Level
              </Label>
              <Select value={wcagLevel} onValueChange={setWcagLevel}>
                <SelectTrigger id="wcag-level" className="w-full mt-1">
                  <SelectValue placeholder="Select WCAG level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a">WCAG 2.1 A</SelectItem>
                  <SelectItem value="aa">WCAG 2.1 AA (Recommended)</SelectItem>
                  <SelectItem value="aaa">WCAG 2.1 AAA</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Additional Compliance Checks</Label>
                  <div className="grid gap-3 pt-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="section508"
                        checked={complianceOptions.section508}
                        onCheckedChange={() => handleCheckboxChange("section508")}
                      />
                      <Label htmlFor="section508" className="text-sm font-normal">
                        Section 508
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="bestPractices"
                        checked={complianceOptions.bestPractices}
                        onCheckedChange={() => handleCheckboxChange("bestPractices")}
                      />
                      <Label htmlFor="bestPractices" className="text-sm font-normal">
                        Best Practices
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="experimental"
                        checked={complianceOptions.experimental}
                        onCheckedChange={() => handleCheckboxChange("experimental")}
                      />
                      <Label htmlFor="experimental" className="text-sm font-normal">
                        Experimental Rules
                      </Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              "Run Accessibility Scan"
            )}
          </Button>
        </>
      )}
    </form>
  )
}
