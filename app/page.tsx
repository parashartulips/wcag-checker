import { ProjectList } from "@/components/project-list"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { NewProjectForm } from "@/components/new-project-form"
import { DashboardOverview } from "@/components/dashboard/dashboard-overview"
import { getProjects } from "@/lib/project-actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Info } from "lucide-react"

interface Project {
  id: string;
  name: string;
  urls: { url: string }[];
  scans: { id: string; status: string; createdAt: string }[];
}

export default async function Home() {
  const rawProjects = await getProjects()
  
  // Transform the data to match expected types
  const projects: Project[] = rawProjects.map(project => ({
    id: project.id,
    name: project.name,
    urls: project.urls,
    scans: project.scans.map(scan => ({
      id: scan.id,
      status: scan.status,
      createdAt: scan.createdAt.toISOString()
    }))
  }))

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">WCAG Accessibility Checker</h1>
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="new-project">New Project</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard">
          <DashboardOverview />
        </TabsContent>
        <TabsContent value="projects">
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                For performance reasons and to reduce scan time, each project is limited to a maximum of 10 URLs. This ensures faster scanning and better system performance.
              </AlertDescription>
            </Alert>
            <Card>
              <CardHeader>
                <CardTitle>Your Projects</CardTitle>
                <CardDescription>Select a project to view or manage its accessibility scans</CardDescription>
              </CardHeader>
              <CardContent>
                <ProjectList projects={projects} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="new-project">
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                For performance reasons and to reduce scan time, each project is limited to a maximum of 10 URLs. This ensures faster scanning and better system performance.
              </AlertDescription>
            </Alert>
            <Card>
              <CardHeader>
                <CardTitle>Create New Project</CardTitle>
                <CardDescription>Create a new project and add URLs to analyze for WCAG accessibility compliance</CardDescription>
              </CardHeader>
              <CardContent>
                <NewProjectForm />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
      </Tabs>
    </div>
  )
}
