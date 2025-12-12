import { CommonModule, ViewportScroller } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AnalyticsService } from '../services/analytics.service';
import { SEOService } from '../services/seo.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit, OnDestroy {
  private routerSubscription: Subscription;
  isYearly = false;
  isComposeFormPage = false;

  constructor(
    private router: Router,
    private viewportScroller: ViewportScroller,
    private analyticsService: AnalyticsService,
    private seoService: SEOService
  ) {
    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.isComposeFormPage = this.router.url.includes('compose-form');
    });
  }

  ngOnInit(): void {
    this.seoService.updateSEO({
      title: 'Docker Compose Manager - Visual Editor for Docker Compose Files',
      description: 'Stop wrestling with YAML. Build, manage, and deploy multi-container Docker applications with a visual editor that just works. Free to use, no sign-up required.',
      keywords: 'docker compose, docker-compose, visual editor, yaml editor, docker manager, container orchestration, devops tools, docker compose generator, docker compose builder',
      url: 'https://docker-compose-manager-d829b.web.app/home'
    });

    // Add structured data for homepage
    this.seoService.addStructuredData({
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "Docker Compose Manager - Visual Editor",
      "description": "Free visual editor for creating and managing Docker Compose files",
      "url": "https://docker-compose-manager-d829b.web.app/home"
    });
  }

  onButtonClick(): void {
    this.router.navigate(['/compose-form']);
  }

  onTryEditorClick(): void {
    this.analyticsService.trackTryEditorClick('landing_page');
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
  }
  
  scrollToSection(section: string, event: Event): void {
    event.preventDefault();
    this.viewportScroller.scrollToAnchor(section);
  }


}