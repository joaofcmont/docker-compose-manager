import { Injectable } from '@angular/core';
import { logEvent } from 'firebase/analytics';
import { analytics } from '../../firebase';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  constructor() {}

  trackEvent(eventName: string, eventParams?: { [key: string]: any }): void {
    try {
      logEvent(analytics, eventName, eventParams);
    } catch (error) {
      console.error('Error tracking analytics event:', error);
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

