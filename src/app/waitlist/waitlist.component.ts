import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FirestoreService } from '../services/firestore.service';
import { AnalyticsService } from '../services/analytics.service';

@Component({
  selector: 'app-waitlist',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './waitlist.component.html',
  styleUrl: './waitlist.component.scss'
})
export class WaitlistComponent {
  waitlistForm = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    name: new FormControl('', [Validators.required, Validators.minLength(2)]),
    role: new FormControl('', [Validators.required])
  });

  isSubmitting = false;
  submitSuccess = false;
  submitError = '';

  constructor(
    private firestoreService: FirestoreService,
    private analyticsService: AnalyticsService,
    private router: Router
  ) {}

  onSubmit(): void {
    if (this.waitlistForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    this.isSubmitting = true;
    this.submitError = '';

    const { email, name, role } = this.waitlistForm.value;

    this.firestoreService.addToWaitlist(
      email!,
      name!,
      role!,
      'landing_page'
    ).then((docId) => {
      this.submitSuccess = true;
      this.analyticsService.trackWaitlistSignup('landing_page');
      
      // Navigate to survey after a short delay
      setTimeout(() => {
        this.router.navigate(['/survey'], {
          queryParams: { email, name, role, waitlistId: docId }
        });
      }, 1500);
    }).catch((error) => {
      console.error('Error signing up:', error);
      
      // Check for specific error types
      const errorCode = error?.code || '';
      const errorMessage = error?.message || '';
      
      if (errorCode === 'already-exists' || errorMessage.includes('already registered')) {
        this.submitError = 'This email is already registered. Please use a different email address.';
      } else if (errorCode === 'failed-precondition' || errorMessage.includes('does not exist') || 
          errorMessage.includes('not found') || errorCode === 'not-found') {
        this.submitError = 'Issue while signing up. Please try again.';
      } else if (errorMessage.includes('BLOCKED') || errorCode === 'unavailable') {
        this.submitError = 'Unable to connect. Please disable ad blockers or privacy extensions and try again.';
      } else {
        this.submitError = 'Failed to sign up. Please check your connection and try again.';
      }
    }).finally(() => {
      this.isSubmitting = false;
    });
  }

  private markFormGroupTouched(): void {
    Object.keys(this.waitlistForm.controls).forEach(key => {
      const control = this.waitlistForm.get(key);
      control?.markAsTouched();
    });
  }
}

