import { notFound } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getProject } from "@/lib/project-actions"
import { ProjectHeader } from "@/components/project-header"
import { ProjectResults } from "@/components/project-results"

interface ProjectPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params
  const project = await getProject(id)

  if (!project) {
    notFound()
  }

  return (
    <div className="container mx-auto py-10">
      <ProjectHeader project={project} /> 
      
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Accessibility Results</CardTitle>
          <CardDescription>
            View and filter accessibility issues found during analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectResults project={project} />
        </CardContent>
      </Card>
    </div>
  )
} 