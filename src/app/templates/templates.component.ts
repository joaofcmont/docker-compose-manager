import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TemplateService } from '../services/template.service';
import { Template, TemplateMetadata, StackTemplate } from '../models/template.model';
import { AnalyticsService } from '../services/analytics.service';
import { DockerComposeService } from '../services/docker-compose.service';
import { SEOService } from '../services/seo.service';
import { SubscriptionService } from '../services/subscription.service';

@Component({
  selector: 'app-templates',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './templates.component.html',
  styleUrl: './templates.component.scss'
})
export class TemplatesComponent implements OnInit {
  private templateService = inject(TemplateService);
  private analyticsService = inject(AnalyticsService);
  private dockerComposeService = inject(DockerComposeService);
  private router = inject(Router);
  private seoService = inject(SEOService);
  subscriptionService = inject(SubscriptionService); // Public for template access

  templates: TemplateMetadata[] = [];
  stackTemplates: StackTemplate[] = [];
  isLoading: boolean = false;
  searchQuery: string = '';
  selectedTag: string = '';
  availableTags: string[] = [];
  showStackTemplates: boolean = true;

  ngOnInit(): void {
    this.loadTemplates();
    this.loadStackTemplates();
    
    // Update SEO for templates page
    this.seoService.updateSEO({
      title: 'Docker Compose Templates - Pre-built Configurations | ComposeFlow',
      description: 'Browse and use pre-built Docker Compose templates. Quick-start configurations for Node.js, Java, LAMP, MEAN, Django, and more. Save and share your own templates.',
      keywords: 'docker compose templates, docker templates, compose file templates, docker stack templates, pre-built docker configs',
      url: 'https://docker-compose-manager-d829b.web.app/templates'
    });
  }

  loadStackTemplates(): void {
    this.stackTemplates = this.dockerComposeService.getStackTemplates();
  }

  async loadTemplates(): Promise<void> {
    this.isLoading = true;
    try {
      this.templates = await this.templateService.getAllTemplateMetadata();
      this.extractTags();
    } catch (error) {
      console.error('Error loading templates:', error);
      this.templates = [];
    } finally {
      this.isLoading = false;
    }
  }

  extractTags(): void {
    const tagSet = new Set<string>();
    this.templates.forEach(template => {
      if (template.tags) {
        template.tags.forEach(tag => tagSet.add(tag));
      }
    });
    this.availableTags = Array.from(tagSet).sort();
  }

  get filteredTemplates(): TemplateMetadata[] {
    let filtered = this.templates;

    // Filter by search query
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.name.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Filter by tag
    if (this.selectedTag) {
      filtered = filtered.filter(t => 
        t.tags && t.tags.includes(this.selectedTag)
      );
    }

    return filtered;
  }

  async loadTemplate(templateId: string): Promise<void> {
    try {
      const template = await this.templateService.loadTemplate(templateId);
      if (!template) {
        alert('Template not found');
        return;
      }

      // Store template data in sessionStorage to pass to editor
      sessionStorage.setItem('loadTemplate', JSON.stringify({
        id: templateId,
        services: template.services
      }));

      // Navigate to editor
      this.analyticsService.trackEvent('template_loaded_from_page', {
        template_id: templateId,
        template_name: template.name
      });

      this.router.navigate(['/editor']);
    } catch (error: any) {
      console.error('Error loading template:', error);
      alert(`Failed to load template: ${error.message || 'Unknown error'}`);
    }
  }

  async deleteTemplate(templateId: string, templateName: string): Promise<void> {
    if (!confirm(`Are you sure you want to delete "${templateName}"?`)) {
      return;
    }

    try {
      const success = await this.templateService.deleteTemplate(templateId);
      if (success) {
        await this.loadTemplates();
        this.analyticsService.trackEvent('template_deleted_from_page', {
          template_id: templateId
        });
      } else {
        alert('Failed to delete template');
      }
    } catch (error: any) {
      console.error('Error deleting template:', error);
      alert(`Failed to delete template: ${error.message || 'Unknown error'}`);
    }
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedTag = '';
  }

  hasActiveFilters(): boolean {
    return !!this.searchQuery.trim() || !!this.selectedTag;
  }

  async loadStackTemplate(stackId: string): Promise<void> {
    if (!this.subscriptionService.canUseStackTemplates()) {
      if (confirm('Stack templates are a Pro feature. Upgrade to Pro to use pre-built stack configurations like Node.js + PostgreSQL, LAMP, and more!\n\nWould you like to upgrade?')) {
        this.analyticsService.trackUpgradePromptAccepted('stack-templates', 'templates_page');
        this.router.navigate(['/pricing']);
      } else {
        this.analyticsService.trackUpgradePromptDeclined('stack-templates', 'templates_page');
      }
      return;
    }

    try {
      const stackTemplate = this.dockerComposeService.getStackTemplate(stackId);
      if (!stackTemplate) {
        alert('Stack template not found');
        return;
      }

      sessionStorage.setItem('loadTemplate', JSON.stringify({
        id: stackId,
        services: stackTemplate.services,
        isStackTemplate: true
      }));

      this.analyticsService.trackEvent('stack_template_loaded', {
        stack_id: stackId,
        stack_name: stackTemplate.name
      });

      this.router.navigate(['/editor']);
    } catch (error: any) {
      console.error('Error loading stack template:', error);
      alert(`Failed to load stack template: ${error.message || 'Unknown error'}`);
    }
  }
}