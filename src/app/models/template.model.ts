import { ServiceConfig } from './service-config.model';

export interface Template {
  id?: string; // Firestore document ID
  name: string;
  description?: string;
  tags?: string[];
  services: ServiceConfig[];
  createdAt?: Date;
  updatedAt?: Date;
  userId?: string; // For future user-specific templates
  isPublic?: boolean; // For future public template sharing
  author?: string; // Template creator name
  usageCount?: number; // Track how many times template is used
}

export interface TemplateMetadata {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  serviceCount: number;
  createdAt?: Date;
  updatedAt?: Date;
  author?: string;
  usageCount?: number;
}

