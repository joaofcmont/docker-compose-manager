import { ServiceConfig } from './service-config.model';

export interface Environment {
  name: string;
  profile?: string;
  overrides: { [serviceName: string]: Partial<ServiceConfig> };
}

export interface ProjectConfig {
  baseServices: ServiceConfig[];
  environments: Environment[];
  defaultEnvironment?: string;
}

