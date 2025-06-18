import { prisma } from './db'

export async function createProject(name: string, urls: string[]) {
  return prisma.project.create({
    data: {
      name,
      urls: {
        create: urls.map(url => ({ url }))
      }
    },
    include: {
      urls: true,
      scans: true
    }
  })
}

export async function getProjects() {
  return prisma.project.findMany({
    include: {
      urls: true,
      scans: {
        orderBy: {
          createdAt: 'desc'
        },
        take: 1
      }
    }
  })
}

export async function getProject(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: {
      urls: true,
      scans: {
        orderBy: {
          createdAt: 'desc'
        },
        include: {
          results: true
        }
      }
    }
  })
}

export async function updateProject(id: string, name: string) {
  return prisma.project.update({
    where: { id },
    data: { name },
    include: {
      urls: true,
      scans: true
    }
  })
}

export async function deleteProject(id: string) {
  return prisma.project.delete({
    where: { id }
  })
}

export async function updateProjectUrls(id: string, urls: string[]) {
  // Delete existing URLs
  await prisma.url.deleteMany({
    where: { projectId: id }
  })

  // Create new URLs
  return prisma.project.update({
    where: { id },
    data: {
      urls: {
        create: urls.map(url => ({ url }))
      }
    },
    include: {
      urls: true,
      scans: true
    }
  })
} 