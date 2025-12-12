import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SubscriptionService } from '../services/subscription.service';
import { AnalyticsService } from '../services/analytics.service';
import { SEOService } from '../services/seo.service';

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './pricing.component.html',
  styleUrl: './pricing.component.scss'
})
export class PricingComponent implements OnInit {
  private subscriptionService = inject(SubscriptionService);
  private analyticsService = inject(AnalyticsService);
  private seoService = inject(SEOService);

  currentTier: 'free' | 'pro' = 'free';

  ngOnInit(): void {
    this.currentTier = this.subscriptionService.getTier();
    
    this.seoService.updateSEO({
      title: 'Pricing - ComposeFlow',
      description: 'Choose the plan that fits your needs. Free forever for individuals, Pro for teams and advanced features.',
      keywords: 'composeflow pricing, docker compose editor pricing, pro features',
      url: 'https://docker-compose-manager-d829b.web.app/pricing'
    });
  }

  upgradeToPro(): void {
    
    this.analyticsService.trackUpgradeToProClicked('pricing_page');
    
    // Small delay to ensure event is sent before redirect
    setTimeout(() => {
      // Fake upgrade - just set to pro for testing
      this.subscriptionService.upgradeToPro();
      this.currentTier = 'pro';
      
      // Show success message
      alert('🎉 Welcome to ComposeFlow Pro! (This is a test - no payment required)');
      
      // Redirect to editor
      window.location.href = '/#/editor';
    }, 100);
  }

  requestProAccess(): void {
    // Track intent
    this.analyticsService.trackProAccessRequested('pricing_page');
    
    window.location.href = '/#/contact?message=I%27m%20interested%20in%20ComposeFlow%20Pro';
  }
}
