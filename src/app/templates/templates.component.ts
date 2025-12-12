import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TemplateService } from '../services/template.service';
import { Template, TemplateMetadata } from '../models/template.model';
import { AnalyticsService } from '../services/analytics.service';

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
  private router = inject(Router);

  templates: TemplateMetadata[] = [];
  isLoading: boolean = false;
  searchQuery: string = '';
  selectedTag: string = '';
  availableTags: string[] = [];

  ngOnInit(): void {
    this.loadTemplates();
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
}
