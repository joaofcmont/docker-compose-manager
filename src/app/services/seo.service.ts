import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

export interface SEOData {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: string;
  author?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SEOService {
  private meta = inject(Meta);
  private title = inject(Title);
  private router = inject(Router);
  
  private readonly defaultTitle = 'Docker Compose Manager - Visual Editor for Docker Compose Files';
  private readonly defaultDescription = 'Stop wrestling with YAML. Build, manage, and deploy multi-container Docker applications with a visual editor that just works. Free to use, no sign-up required.';
  private readonly defaultImage = 'https://docker-compose-manager-d829b.web.app/assets/favicon.png';
  private readonly baseUrl = 'https://docker-compose-manager-d829b.web.app';

  constructor() {
    // Update meta tags on route changes
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.updateCanonicalUrl();
    });
  }

  updateSEO(data: SEOData): void {
    const title = data.title || this.defaultTitle;
    const description = data.description || this.defaultDescription;
    const image = data.image || this.defaultImage;
    const url = data.url || `${this.baseUrl}${this.router.url}`;
    const type = data.type || 'website';
    const keywords = data.keywords || 'docker compose, docker-compose, visual editor, yaml editor, docker manager, container orchestration, devops tools';

    // Update title
    this.title.setTitle(title);

    // Primary Meta Tags
    this.meta.updateTag({ name: 'title', content: title });
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ name: 'keywords', content: keywords });
    if (data.author) {
      this.meta.updateTag({ name: 'author', content: data.author });
    }

    // Open Graph / Facebook
    this.meta.updateTag({ property: 'og:type', content: type });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:image', content: image });
    this.meta.updateTag({ property: 'og:site_name', content: 'Docker Compose Manager' });

    // Twitter
    this.meta.updateTag({ property: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ property: 'twitter:url', content: url });
    this.meta.updateTag({ property: 'twitter:title', content: title });
    this.meta.updateTag({ property: 'twitter:description', content: description });
    this.meta.updateTag({ property: 'twitter:image', content: image });

    // Update canonical URL
    this.updateCanonicalUrl(url);
  }

  private updateCanonicalUrl(url?: string): void {
    const canonicalUrl = url || `${this.baseUrl}${this.router.url}`;
    
    // Remove existing canonical link
    const existingLink = document.querySelector('link[rel="canonical"]');
    if (existingLink) {
      existingLink.remove();
    }

    // Add new canonical link
    const link: HTMLLinkElement = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    link.setAttribute('href', canonicalUrl);
    document.head.appendChild(link);
  }

  addStructuredData(data: any): void {
    // Remove existing structured data
    const existingScript = document.querySelector('script[type="application/ld+json"]');
    if (existingScript) {
      existingScript.remove();
    }

    // Add new structured data
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(data);
    document.head.appendChild(script);
  }
}

