import { Injectable } from '@angular/core';
import emailjs from '@emailjs/browser';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';

export interface ContactSubmission {
  name: string;
  email: string;
  message: string;
  timestamp: Timestamp;
}

@Injectable({
  providedIn: 'root'
})
export class ContactService {
  // EmailJS Configuration
  // 3. Go to Email Templates and create a new template with these variables:
  //    - {{from_name}} - sender's name
  //    - {{from_email}} - sender's email
  //    - {{message}} - the message content
  //    - {{to_email}} - your email address (or remove if hardcoded in template)
  // 4. Go to Account > API Keys and copy your Public Key
  // 5. Replace the values below with your Service ID, Template ID, and Public Key
  // 6. Update the to_email in the sendContactEmail method to your actual email
  //
  private readonly EMAILJS_SERVICE_ID = 'service_q7u918e';
  private readonly EMAILJS_TEMPLATE_ID = 'template_pckhmhb';
  private readonly EMAILJS_PUBLIC_KEY = 'ZSxReCM34H3HqyNPs';

  constructor() {
    // Initialize EmailJS with public key
    emailjs.init(this.EMAILJS_PUBLIC_KEY);
  }

  async sendContactEmail(name: string, email: string, message: string): Promise<void> {
    try {
      // Template parameters - these must match EXACTLY with your EmailJS template variables
      const templateParams = {
        from_name: name.trim(),
        from_email: email.trim(),
        message: message.trim(),
        to_email: 'monteirojoao31@gmail.com', // Your email address
      };

      console.log('Sending email with EmailJS:', {
        serviceId: this.EMAILJS_SERVICE_ID,
        templateId: this.EMAILJS_TEMPLATE_ID,
        params: templateParams
      });

      // Send email via EmailJS
      const response = await emailjs.send(
        this.EMAILJS_SERVICE_ID,
        this.EMAILJS_TEMPLATE_ID,
        templateParams
      );

      console.log('EmailJS response:', response);

      // Also store in Firestore for backup/analytics
      await this.saveToFirestore(name, email, message);
    } catch (error: any) {
      console.error('Error sending contact email:', error);
      console.error('Full error object:', JSON.stringify(error, null, 2));
      
      // Provide more detailed error information
      let errorMessage = 'Failed to send email. ';
      
      if (error?.status === 400) {
        errorMessage += 'Invalid request. Please verify that your EmailJS template uses these exact variable names: {{from_name}}, {{from_email}}, {{message}}, {{to_email}}';
      } else if (error?.text) {
        errorMessage += error.text;
      } else if (error?.message) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Please check your EmailJS configuration (Service ID, Template ID, and Public Key).';
      }
      
      throw new Error(errorMessage);
    }
  }

  private async saveToFirestore(name: string, email: string, message: string): Promise<void> {
    try {
      const submission: Omit<ContactSubmission, 'timestamp'> & { timestamp: any } = {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        message: message.trim(),
        timestamp: Timestamp.now()
      };

      await addDoc(collection(db, 'contact_submissions'), submission);
    } catch (error) {
      console.error('Error saving to Firestore:', error);
    }
  }
}

