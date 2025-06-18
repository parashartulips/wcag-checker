import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseStringPromise } from 'xml2js';

// Schema for validating the sitemap URL
const SitemapUrlSchema = z.object({
  url: z.string().url(),
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json(
        { error: 'URL parameter is required' },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      SitemapUrlSchema.parse({ url });
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    const result = await processSitemap(url);
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Sitemap processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process sitemap' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      SitemapUrlSchema.parse({ url });
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    const result = await processSitemap(url);
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Sitemap processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process sitemap' },
      { status: 500 }
    );
  }
}

async function processSitemap(url: string) {
  // Fetch the sitemap
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'WCAG Accessibility Checker/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch sitemap: ${response.statusText}`);
  }

  const xmlContent = await response.text();
  
  // Parse XML content
  const parsed = await parseStringPromise(xmlContent, {
    explicitArray: false,
    normalizeTags: true,
  });

  // Extract URLs from sitemap
  let urls: string[] = [];
  
  // Handle standard sitemaps
  if (parsed.urlset && parsed.urlset.url) {
    const urlEntries = Array.isArray(parsed.urlset.url) 
      ? parsed.urlset.url 
      : [parsed.urlset.url];
    
    urls = urlEntries
      .map((entry: any) => entry.loc)
      .filter((url: any) => url && typeof url === 'string');
  }
  
  // Handle sitemap indexes
  else if (parsed.sitemapindex && parsed.sitemapindex.sitemap) {
    const sitemaps = Array.isArray(parsed.sitemapindex.sitemap)
      ? parsed.sitemapindex.sitemap
      : [parsed.sitemapindex.sitemap];
    
    // For sitemap indexes, we just return the first 10 sitemap URLs
    // In a real app, you might want to fetch all of them
    urls = sitemaps
      .slice(0, 10)
      .map((entry: any) => entry.loc)
      .filter((url: any) => url && typeof url === 'string');
    
    // Add a message that this is a sitemap index
    return {
      type: 'sitemapindex',
      message: 'This is a sitemap index. Consider checking individual sitemaps.',
      urls,
    };
  }
  
  return {
    type: 'urlset',
    urls,
  };
} 