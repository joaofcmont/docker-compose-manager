import { Injectable } from '@angular/core';
import { Template, TemplateMetadata } from '../models/template.model';
import { ServiceConfig } from '../models/service-config.model';
import { FirestoreService } from './firestore.service';
import { collection, getDocs, doc, getDoc, deleteDoc, setDoc, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { Timestamp } from 'firebase/firestore';

@Injectable({
  providedIn: 'root'
})
export class TemplateService {
  private readonly LOCAL_STORAGE_KEY = 'docker-compose-templates';
  private readonly MAX_LOCAL_TEMPLATES = 50;

  constructor(private firestoreService: FirestoreService) {}

  // Save template to localStorage
  saveTemplateLocally(template: Template): string {
    const templates = this.getLocalTemplates();
    
    // Generate ID if not provided
    if (!template.id) {
      template.id = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Update or add template
    const existingIndex = templates.findIndex(t => t.id === template.id);
    if (existingIndex >= 0) {
      templates[existingIndex] = { ...template, updatedAt: new Date() };
    } else {
      // Limit number of local templates
      if (templates.length >= this.MAX_LOCAL_TEMPLATES) {
        // Remove oldest template
        templates.sort((a, b) => {
          const aDate = a.updatedAt || a.createdAt || new Date(0);
          const bDate = b.updatedAt || b.createdAt || new Date(0);
          return aDate.getTime() - bDate.getTime();
        });
        templates.shift();
      }
      templates.push({ ...template, createdAt: new Date(), updatedAt: new Date() });
    }

    try {
      localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(templates));
      return template.id;
    } catch (error) {
      console.error('Error saving template to localStorage:', error);
      throw new Error('Failed to save template. Local storage may be full.');
    }
  }

  // Get all local templates
  getLocalTemplates(): Template[] {
    try {
      const stored = localStorage.getItem(this.LOCAL_STORAGE_KEY);
      if (!stored) return [];
      
      const templates = JSON.parse(stored);
      // Convert date strings back to Date objects
      return templates.map((t: any) => ({
        ...t,
        createdAt: t.createdAt ? new Date(t.createdAt) : undefined,
        updatedAt: t.updatedAt ? new Date(t.updatedAt) : undefined
      }));
    } catch (error) {
      console.error('Error reading templates from localStorage:', error);
      return [];
    }
  }

  // Get template metadata (without full service configs)
  getLocalTemplateMetadata(): TemplateMetadata[] {
    const templates = this.getLocalTemplates();
    return templates.map(t => ({
      id: t.id!,
      name: t.name,
      description: t.description,
      tags: t.tags,
      serviceCount: t.services.length,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      author: t.author,
      usageCount: t.usageCount
    }));
  }

  // Get a specific local template by ID
  getLocalTemplate(id: string): Template | null {
    const templates = this.getLocalTemplates();
    return templates.find(t => t.id === id) || null;
  }

  // Delete local template
  deleteLocalTemplate(id: string): boolean {
    const templates = this.getLocalTemplates();
    const filtered = templates.filter(t => t.id !== id);
    
    if (filtered.length === templates.length) {
      return false; // Template not found
    }

    try {
      localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(filtered));
      return true;
    } catch (error) {
      console.error('Error deleting template from localStorage:', error);
      return false;
    }
  }

  // Save template to Firestore
  async saveTemplateToFirestore(template: Template): Promise<string> {
    try {
      const templateData: any = {
        name: template.name,
        description: template.description || '',
        tags: template.tags || [],
        services: template.services,
        createdAt: template.createdAt ? Timestamp.fromDate(template.createdAt) : Timestamp.now(),
        updatedAt: Timestamp.now(),
        isPublic: template.isPublic || false,
        author: template.author || '',
        usageCount: template.usageCount || 0
      };

      if (template.id && template.id.startsWith('firestore-')) {
        // Update existing template
        const docId = template.id.replace('firestore-', '');
        const docRef = doc(db, 'templates', docId);
        await setDoc(docRef, templateData, { merge: true });
        return template.id;
      } else {
        // Create new template
        const docRef = doc(collection(db, 'templates'));
        await setDoc(docRef, templateData);
        return `firestore-${docRef.id}`;
      }
    } catch (error) {
      console.error('Error saving template to Firestore:', error);
      throw new Error('Failed to save template to cloud. Please try again.');
    }
  }

  // Get templates from Firestore
  async getFirestoreTemplates(limitCount: number = 50): Promise<Template[]> {
    try {
      const templatesRef = collection(db, 'templates');
      const q = query(
        templatesRef,
        where('isPublic', '==', true),
        orderBy('usageCount', 'desc'),
        limit(limitCount)
      );
      
      const querySnapshot = await getDocs(q);
      const templates: Template[] = [];

      querySnapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        templates.push({
          id: `firestore-${docSnapshot.id}`,
          name: data['name'],
          description: data['description'],
          tags: data['tags'] || [],
          services: data['services'] || [],
          createdAt: data['createdAt']?.toDate(),
          updatedAt: data['updatedAt']?.toDate(),
          isPublic: data['isPublic'],
          author: data['author'],
          usageCount: data['usageCount'] || 0
        });
      });

      return templates;
    } catch (error) {
      console.error('Error fetching templates from Firestore:', error);
      return [];
    }
  }

  // Get a specific Firestore template by ID
  async getFirestoreTemplate(id: string): Promise<Template | null> {
    try {
      const docId = id.replace('firestore-', '');
      const docRef = doc(db, 'templates', docId);
      const docSnapshot = await getDoc(docRef);

      if (!docSnapshot.exists()) {
        return null;
      }

      const data = docSnapshot.data();
      return {
        id: `firestore-${docSnapshot.id}`,
        name: data['name'],
        description: data['description'],
        tags: data['tags'] || [],
        services: data['services'] || [],
        createdAt: data['createdAt']?.toDate(),
        updatedAt: data['updatedAt']?.toDate(),
        isPublic: data['isPublic'],
        author: data['author'],
        usageCount: data['usageCount'] || 0
      };
    } catch (error) {
      console.error('Error fetching template from Firestore:', error);
      return null;
    }
  }

  // Delete template from Firestore
  async deleteFirestoreTemplate(id: string): Promise<boolean> {
    try {
      const docId = id.replace('firestore-', '');
      const docRef = doc(db, 'templates', docId);
      await deleteDoc(docRef);
      return true;
    } catch (error) {
      console.error('Error deleting template from Firestore:', error);
      return false;
    }
  }

  // Increment usage count for a template
  async incrementTemplateUsage(id: string): Promise<void> {
    if (id.startsWith('firestore-')) {
      try {
        const docId = id.replace('firestore-', '');
        const docRef = doc(db, 'templates', docId);
        const docSnapshot = await getDoc(docRef);
        
        if (docSnapshot.exists()) {
          const currentCount = docSnapshot.data()['usageCount'] || 0;
          await setDoc(docRef, { usageCount: currentCount + 1 }, { merge: true });
        }
      } catch (error) {
        console.error('Error incrementing template usage:', error);
        // Non-critical error, don't throw
      }
    }
  }

  // Get all templates (local + Firestore metadata)
  async getAllTemplateMetadata(): Promise<TemplateMetadata[]> {
    const localMetadata = this.getLocalTemplateMetadata();
    const firestoreTemplates = await this.getFirestoreTemplates(20); // Limit Firestore templates
    
    const firestoreMetadata: TemplateMetadata[] = firestoreTemplates.map(t => ({
      id: t.id!,
      name: t.name,
      description: t.description,
      tags: t.tags,
      serviceCount: t.services.length,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      author: t.author,
      usageCount: t.usageCount
    }));

    // Combine and sort by updated date (most recent first)
    const allMetadata = [...localMetadata, ...firestoreMetadata];
    allMetadata.sort((a, b) => {
      const aDate = a.updatedAt || a.createdAt || new Date(0);
      const bDate = b.updatedAt || b.createdAt || new Date(0);
      return bDate.getTime() - aDate.getTime();
    });

    return allMetadata;
  }

  // Load template (from local or Firestore)
  async loadTemplate(id: string): Promise<Template | null> {
    if (id.startsWith('local-')) {
      return this.getLocalTemplate(id);
    } else if (id.startsWith('firestore-')) {
      const template = await this.getFirestoreTemplate(id);
      if (template) {
        // Increment usage count
        await this.incrementTemplateUsage(id);
      }
      return template;
    }
    return null;
  }

  // Delete template (from local or Firestore)
  async deleteTemplate(id: string): Promise<boolean> {
    if (id.startsWith('local-')) {
      return this.deleteLocalTemplate(id);
    } else if (id.startsWith('firestore-')) {
      return await this.deleteFirestoreTemplate(id);
    }
    return false;
  }
}

