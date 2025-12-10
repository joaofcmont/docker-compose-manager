import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ContactService } from '../services/contact.service';
import { AnalyticsService } from '../services/analytics.service';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [RouterModule, CommonModule, ReactiveFormsModule],
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.scss'
})
export class ContactComponent {
  contactForm: FormGroup;
  isSubmitting = false;
  submitSuccess = false;
  submitError = '';

  constructor(
    private fb: FormBuilder,
    private contactService: ContactService,
    private analyticsService: AnalyticsService
  ) {
    this.contactForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      message: ['', [Validators.required, Validators.minLength(10)]]
    });
  }

  async onSubmit(): Promise<void> {
    if (this.contactForm.invalid) {
      // Mark all fields as touched to show validation errors
      Object.keys(this.contactForm.controls).forEach(key => {
        this.contactForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.isSubmitting = true;
    this.submitError = '';
    this.submitSuccess = false;

    const { name, email, message } = this.contactForm.value;

    try {
      await this.contactService.sendContactEmail(name, email, message);
      this.submitSuccess = true;
      this.contactForm.reset();
      this.analyticsService.trackEvent('contact_form_submitted', {
        name: name,
        email: email
      });
      
      // Reset success message after 5 seconds
      setTimeout(() => {
        this.submitSuccess = false;
      }, 5000);
    } catch (error: any) {
      console.error('Error submitting contact form:', error);
      this.submitError = error?.message || 'Failed to send message. Please try again or email us directly.';
    } finally {
      this.isSubmitting = false;
    }
  }

  get name() {
    return this.contactForm.get('name');
  }

  get email() {
    return this.contactForm.get('email');
  }

  get message() {
    return this.contactForm.get('message');
  }
}
