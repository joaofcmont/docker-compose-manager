import { Injectable } from '@angular/core';
import { logEvent, isSupported } from 'firebase/analytics';
import { analytics } from '../../firebase';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  constructor() {
    // Check if analytics is available
    this.checkAnalyticsSupport();
  }

  private async checkAnalyticsSupport(): Promise<void> {
    try {
      const supported = await isSupported();
      console.log('📊 Firebase Analytics supported:', supported);
      if (!supported) {
        console.warn('⚠️ Firebase Analytics is not supported in this environment');
      }
    } catch (error) {
      console.error('❌ Error checking analytics support:', error);
    }
  }

  trackEvent(eventName: string, eventParams?: { [key: string]: any }): void {
    try {
      
      if (!analytics) {
        console.error('❌ Analytics not initialized');
        return;
      }

      logEvent(analytics, eventName, eventParams);
      console.log('✅ Event sent successfully:', eventName);
    } catch (error) {
      console.error('❌ Error tracking analytics event:', error, {
        eventName,
        eventParams,
        analyticsAvailable: !!analytics
      });
    }
  }

  trackWaitlistSignup(source: string): void {
    this.trackEvent('waitlist_signup', { source });
  }

  trackSurveyCompleted(): void {
    this.trackEvent('survey_completed');
  }

  trackTryEditorClick(source: string = 'landing_page'): void {
    this.trackEvent('try_editor_click', { source });
  }
  trackUpgradePromptAccepted(feature: string, source: string, additionalParams?: { [key: string]: any }): void {
    this.trackEvent('upgrade_prompt_accepted', { feature, source, ...additionalParams });
  }
  
  trackUpgradePromptDeclined(feature: string, source: string, additionalParams?: { [key: string]: any }): void {
    this.trackEvent('upgrade_prompt_declined', { feature, source, ...additionalParams });
  }

  trackUpgradeToProClicked(source: string): void {
    this.trackEvent('upgrade_to_pro_clicked', { source, timestamp: new Date().toISOString() });
  }

  trackUpgradeCtaClicked(source: string): void {
    this.trackEvent('upgrade_cta_clicked', { source, timestamp: new Date().toISOString() });
  }

  trackProAccessRequested(source: string): void {
    this.trackEvent('pro_access_requested', { source });
  }

  trackEditorUsed(): void {
    this.trackEvent('editor_used');
  }

  trackFileUploaded(): void {
    this.trackEvent('file_uploaded');
  }

  trackFileGenerated(): void {
    this.trackEvent('file_generated');
  }
}

