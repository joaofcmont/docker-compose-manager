import { Injectable } from '@angular/core';

export type SubscriptionTier = 'free' | 'pro';

@Injectable({
  providedIn: 'root'
})
export class SubscriptionService {
  private readonly STORAGE_KEY = 'composeflow_subscription_tier';
  private readonly FREE_SERVICE_LIMIT = 3;
  private readonly FREE_ENVIRONMENT_LIMIT = 1; // base only

  getTier(): SubscriptionTier {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    return (stored as SubscriptionTier) || 'free';
  }

  setTier(tier: SubscriptionTier): void {
    localStorage.setItem(this.STORAGE_KEY, tier);
  }

  isPro(): boolean {
    return this.getTier() === 'pro';
  }

  isFree(): boolean {
    return this.getTier() === 'free';
  }

  // Feature limits
  getMaxServices(): number {
    return this.isPro() ? Infinity : this.FREE_SERVICE_LIMIT;
  }

  getMaxEnvironments(): number {
    return this.isPro() ? Infinity : this.FREE_ENVIRONMENT_LIMIT;
  }

  canAddService(currentCount: number): boolean {
    return this.isPro() || currentCount < this.FREE_SERVICE_LIMIT;
  }

  canAddEnvironment(currentCount: number): boolean {
    return this.isPro() || currentCount <= this.FREE_ENVIRONMENT_LIMIT;
  }

  canUseStackTemplates(): boolean {
    return this.isPro();
  }

  canUseAdvancedTemplates(): boolean {
    return this.isPro();
  }

  canShareConfigs(): boolean {
    return this.isPro();
  }

  canExportDockerRun(): boolean {
    return this.isPro();
  }

  // For testing: allow setting to pro (fake upgrade)
  upgradeToPro(): void {
    this.setTier('pro');
  }

  // For testing: reset to free
  downgradeToFree(): void {
    this.setTier('free');
  }
}

