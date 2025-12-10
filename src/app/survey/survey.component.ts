import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FirestoreService } from '../services/firestore.service';
import { AnalyticsService } from '../services/analytics.service';

@Component({
  selector: 'app-survey',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './survey.component.html',
  styleUrl: './survey.component.scss'
})
export class SurveyComponent implements OnInit {
  surveyForm = new FormGroup({
    serviceCount: new FormControl('', [Validators.required]),
    painPoint: new FormControl('', [Validators.required]),
    editFrequency: new FormControl('', [Validators.required]),
    wouldUseWeekly: new FormControl('', [Validators.required]),
    feedback: new FormControl('')
  });

  isSubmitting = false;
  submitSuccess = false;
  submitError = '';
  
  // User info from waitlist
  email = '';
  name = '';
  role = '';
  waitlistId = '';

  constructor(
    private firestoreService: FirestoreService,
    private analyticsService: AnalyticsService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Get user info from query params (passed from waitlist)
    this.route.queryParams.subscribe(params => {
      this.email = params['email'] || '';
      this.name = params['name'] || '';
      this.role = params['role'] || '';
      this.waitlistId = params['waitlistId'] || '';
    });
  }

  onSubmit(): void {
    if (this.surveyForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    this.isSubmitting = true;
    this.submitError = '';

    const surveyData = {
      email: this.email,
      name: this.name,
      role: this.role,
      responses: {
        serviceCount: this.surveyForm.value.serviceCount!,
        painPoint: this.surveyForm.value.painPoint!,
        editFrequency: this.surveyForm.value.editFrequency!,
        wouldUseWeekly: this.surveyForm.value.wouldUseWeekly!,
        feedback: this.surveyForm.value.feedback || undefined
      },
      waitlistId: this.waitlistId || undefined
    };

    this.firestoreService.submitSurvey(surveyData)
      .then(() => {
        this.submitSuccess = true;
        this.analyticsService.trackSurveyCompleted();
      })
      .catch((error) => {
        this.submitError = 'Failed to submit survey. Please try again.';
        console.error('Error submitting survey:', error);
      })
      .finally(() => {
        this.isSubmitting = false;
      });
  }

  private markFormGroupTouched(): void {
    Object.keys(this.surveyForm.controls).forEach(key => {
      const control = this.surveyForm.get(key);
      control?.markAsTouched();
    });
  }

  goToEditor(): void {
    this.router.navigate(['/compose-form']);
  }
}

