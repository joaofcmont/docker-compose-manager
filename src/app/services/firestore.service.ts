import { Injectable } from '@angular/core';
import { collection, addDoc, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';

export interface WaitlistEntry {
  email: string;
  name: string;
  role: string;
  timestamp: Timestamp;
  source: string;
  surveyCompleted: boolean;
}

export interface SurveyResponse {
  email: string;
  name: string;
  role: string;
  responses: {
    serviceCount: string;
    painPoint: string;
    editFrequency: string;
    wouldUseWeekly: string;
    feedback?: string;
  };
  timestamp: Timestamp;
  waitlistId?: string;
}

export interface DiagramFeedback {
  isVisual: boolean;
  comment?: string;
  serviceCount: number;
  timestamp: Timestamp;
  userAgent?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FirestoreService {
  constructor() {}

  async checkEmailExists(email: string): Promise<boolean> {
    try {
      const q = query(collection(db, 'waitlist'), where('email', '==', email.toLowerCase().trim()));
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking email:', error);
      // If check fails, allow submission (fail open)
      return false;
    }
  }

  async addToWaitlist(email: string, name: string, role: string, source: string = 'landing_page'): Promise<string> {
    try {
      // Check if email already exists
      const emailExists = await this.checkEmailExists(email);
      if (emailExists) {
        const error: any = new Error('This email is already registered');
        error.code = 'already-exists';
        throw error;
      }

      const waitlistEntry: Omit<WaitlistEntry, 'timestamp'> & { timestamp: any } = {
        email: email.toLowerCase().trim(),
        name,
        role,
        source,
        surveyCompleted: false,
        timestamp: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, 'waitlist'), waitlistEntry);
      return docRef.id;
    } catch (error: any) {
      console.error('Error adding to waitlist:', error);
      // Re-throw with more context for better error handling
      const enhancedError = {
        ...error,
        message: error?.message || 'Network error',
        code: error?.code || 'unknown'
      };
      throw enhancedError;
    }
  }

  async submitSurvey(surveyData: Omit<SurveyResponse, 'timestamp'> & { timestamp?: any }): Promise<string> {
    try {
      const cleanSurveyData: any = {
        email: surveyData.email,
        name: surveyData.name,
        role: surveyData.role,
        responses: {
          serviceCount: surveyData.responses.serviceCount,
          painPoint: surveyData.responses.painPoint,
          editFrequency: surveyData.responses.editFrequency,
          wouldUseWeekly: surveyData.responses.wouldUseWeekly
        },
        timestamp: surveyData.timestamp || Timestamp.now()
      };

      // Only add feedback if it exists and is not empty
      if (surveyData.responses.feedback && surveyData.responses.feedback.trim() !== '') {
        cleanSurveyData.responses.feedback = surveyData.responses.feedback.trim();
      }

      // Only add waitlistId if it exists
      if (surveyData.waitlistId) {
        cleanSurveyData.waitlistId = surveyData.waitlistId;
      }

      const docRef = await addDoc(collection(db, 'survey_responses'), cleanSurveyData);
      return docRef.id;
    } catch (error) {
      console.error('Error submitting survey:', error);
      throw error;
    }
  }

  async submitDiagramFeedback(feedback: Omit<DiagramFeedback, 'timestamp'> & { timestamp?: any }): Promise<string> {
    try {
      const feedbackData: any = {
        isVisual: feedback.isVisual,
        serviceCount: feedback.serviceCount,
        timestamp: feedback.timestamp || Timestamp.now()
      };

      // Only add comment if it exists and is not empty
      if (feedback.comment && feedback.comment.trim() !== '') {
        feedbackData.comment = feedback.comment.trim();
      }

      // Add user agent if provided
      if (feedback.userAgent) {
        feedbackData.userAgent = feedback.userAgent;
      }

      const docRef = await addDoc(collection(db, 'diagram_feedback'), feedbackData);
      return docRef.id;
    } catch (error) {
      console.error('Error submitting diagram feedback:', error);
      throw error;
    }
  }
}

