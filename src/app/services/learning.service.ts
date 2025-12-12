import { Injectable } from '@angular/core';
import { ServiceConfig } from '../models/service-config.model';

export interface LearningTip {
  id: string;
  title: string;
  message: string;
  category: 'best-practice' | 'warning' | 'info' | 'tip';
  field?: string; // Field this tip relates to
  link?: string; // Optional link to documentation
}

export interface ConfigSuggestion {
  type: 'warning' | 'error' | 'suggestion' | 'optimization';
  severity: 'low' | 'medium' | 'high';
  title: string;
  message: string;
  field?: string;
  fix?: string; // Suggested fix
}

@Injectable({
  providedIn: 'root'
})
export class LearningService {

  constructor() { }

  // Get tips for a specific field
  getFieldTips(fieldName: string): LearningTip[] {
    const tips: { [key: string]: LearningTip[] } = {
      'serviceName': [
        {
          id: 'service-name-format',
          title: 'Service Naming',
          message: 'Use lowercase letters, numbers, hyphens, and underscores. Start with a letter. Avoid special characters.',
          category: 'best-practice',
          field: 'serviceName',
          link: 'https://docs.docker.com/compose/compose-file/#service-configuration-reference'
        }
      ],
      'dockerImage': [
        {
          id: 'image-tag',
          title: 'Image Tags',
          message: 'Always specify a tag (e.g., nginx:1.25 instead of just nginx). Using "latest" can lead to unexpected updates.',
          category: 'warning',
          field: 'dockerImage',
          link: 'https://docs.docker.com/compose/compose-file/#image'
        },
        {
          id: 'image-best-practice',
          title: 'Best Practice',
          message: 'Use official images from Docker Hub when possible. They are maintained and secure.',
          category: 'tip',
          field: 'dockerImage'
        }
      ],
      'hostPort': [
        {
          id: 'port-conflicts',
          title: 'Port Conflicts',
          message: 'Ensure this port is not already in use by another service or application on your host machine.',
          category: 'warning',
          field: 'hostPort'
        },
        {
          id: 'port-range',
          title: 'Port Range',
          message: 'Ports 1-1023 are privileged ports (require root). Use ports 1024-65535 for non-root containers.',
          category: 'info',
          field: 'hostPort'
        }
      ],
      'containerPort': [
        {
          id: 'container-port',
          title: 'Container Port',
          message: 'This is the port your application listens on inside the container. It should match your application configuration.',
          category: 'info',
          field: 'containerPort'
        }
      ],
      'environment': [
        {
          id: 'env-secrets',
          title: 'Security Warning',
          message: 'Never commit secrets in environment variables. Use Docker secrets or environment files (.env) for sensitive data.',
          category: 'warning',
          field: 'environment',
          link: 'https://docs.docker.com/compose/environment-variables/'
        },
        {
          id: 'env-format',
          title: 'Format',
          message: 'One variable per line: KEY=value. No spaces around the equals sign.',
          category: 'info',
          field: 'environment'
        }
      ],
      'volumes': [
        {
          id: 'volume-persistence',
          title: 'Data Persistence',
          message: 'Named volumes persist data between container restarts. Bind mounts link to host directories.',
          category: 'info',
          field: 'volumes',
          link: 'https://docs.docker.com/compose/compose-file/#volumes'
        },
        {
          id: 'volume-format',
          title: 'Format',
          message: 'Format: ./local/path:/container/path for bind mounts, or volume-name:/container/path for named volumes.',
          category: 'info',
          field: 'volumes'
        }
      ],
      'healthCheck': [
        {
          id: 'healthcheck-importance',
          title: 'Why Health Checks?',
          message: 'Health checks help Docker know when your service is ready and healthy. Essential for production deployments.',
          category: 'best-practice',
          field: 'healthCheck',
          link: 'https://docs.docker.com/compose/compose-file/#healthcheck'
        },
        {
          id: 'healthcheck-intervals',
          title: 'Timing',
          message: 'Interval: how often to check. Timeout: max wait time. Start period: grace time before first check.',
          category: 'info',
          field: 'healthCheck'
        }
      ],
      'cpuLimit': [
        {
          id: 'cpu-explanation',
          title: 'CPU Limits',
          message: '0.5 = half a CPU core, 1.0 = 1 full core, 2.5 = 2.5 cores. This is NOT a percentage of your total CPU.',
          category: 'info',
          field: 'cpuLimit',
          link: 'https://docs.docker.com/compose/compose-file/#deploy'
        }
      ],
      'memoryLimit': [
        {
          id: 'memory-explanation',
          title: 'Memory Limits',
          message: 'Specified in megabytes (MB). 1024 MB = 1 GB. Set limits to prevent services from consuming all available memory.',
          category: 'info',
          field: 'memoryLimit'
        }
      ],
      'restart': [
        {
          id: 'restart-policies',
          title: 'Restart Policies',
          message: 'always: always restart. on-failure: restart only on failure. unless-stopped: restart unless manually stopped. no: never restart.',
          category: 'info',
          field: 'restart',
          link: 'https://docs.docker.com/compose/compose-file/#restart'
        }
      ],
      'networks': [
        {
          id: 'networks-communication',
          title: 'Service Communication',
          message: 'Services on the same network can communicate using service names as hostnames. Default network is created automatically.',
          category: 'info',
          field: 'networks',
          link: 'https://docs.docker.com/compose/networking/'
        }
      ],
      'labels': [
        {
          id: 'labels-metadata',
          title: 'Labels',
          message: 'Labels add metadata to services. Common uses: Traefik routing, monitoring, organization.',
          category: 'info',
          field: 'labels',
          link: 'https://docs.docker.com/compose/compose-file/#labels'
        }
      ],
      'depends_on': [
        {
          id: 'depends-on',
          title: 'Service Dependencies',
          message: 'Defines startup order. Services listed here will start before this service. Does NOT wait for them to be healthy.',
          category: 'info',
          field: 'depends_on',
          link: 'https://docs.docker.com/compose/compose-file/#depends_on'
        }
      ]
    };

    return tips[fieldName] || [];
  }

  // Analyze configuration and provide suggestions
  analyzeConfig(services: ServiceConfig[]): ConfigSuggestion[] {
    const suggestions: ConfigSuggestion[] = [];

    services.forEach((service, index) => {
      // Check for missing health checks
      if (!service.healthCheck?.enabled && services.length > 1) {
        suggestions.push({
          type: 'suggestion',
          severity: 'medium',
          title: 'Add Health Check',
          message: `Service "${service.serviceName}" doesn't have a health check. Health checks are recommended for production.`,
          field: `services[${index}].healthCheck`,
          fix: 'Enable health check in the form'
        });
      }

      // Check for latest tag
      if (service.dockerImage && service.dockerImage.includes(':latest')) {
        suggestions.push({
          type: 'warning',
          severity: 'high',
          title: 'Using "latest" Tag',
          message: `Service "${service.serviceName}" uses the "latest" tag. Pin to a specific version for stability.`,
          field: `services[${index}].dockerImage`,
          fix: `Change "${service.dockerImage}" to use a specific version tag`
        });
      }

      // Check for missing image tag
      if (service.dockerImage && !service.dockerImage.includes(':')) {
        suggestions.push({
          type: 'warning',
          severity: 'medium',
          title: 'Missing Image Tag',
          message: `Service "${service.serviceName}" image doesn't specify a tag. Docker will default to "latest".`,
          field: `services[${index}].dockerImage`,
          fix: `Add a tag: "${service.dockerImage}:1.0" or similar`
        });
      }

      // Check for resource limits
      if (!service.resources?.cpuLimit && !service.resources?.memoryLimit) {
        suggestions.push({
          type: 'suggestion',
          severity: 'low',
          title: 'Consider Resource Limits',
          message: `Service "${service.serviceName}" has no CPU or memory limits. Setting limits prevents resource exhaustion.`,
          field: `services[${index}].resources`,
          fix: 'Set CPU and memory limits in Resources & Deployment section'
        });
      }

      // Check for restart policy
      if (service.restart === 'no') {
        suggestions.push({
          type: 'warning',
          severity: 'medium',
          title: 'Restart Policy',
          message: `Service "${service.serviceName}" has restart policy "no". Consider "always" or "on-failure" for production.`,
          field: `services[${index}].restart`,
          fix: 'Change restart policy to "always" or "on-failure"'
        });
      }

      // Check for exposed ports without host port
      if (service.containerPort && !service.hostPort) {
        suggestions.push({
          type: 'error',
          severity: 'high',
          title: 'Missing Host Port',
          message: `Service "${service.serviceName}" has a container port but no host port. The service won't be accessible from outside.`,
          field: `services[${index}].hostPort`,
          fix: 'Add a host port mapping'
        });
      }

      // Check for duplicate service names
      const duplicateNames = services.filter(s => s.serviceName === service.serviceName);
      if (duplicateNames.length > 1) {
        suggestions.push({
          type: 'error',
          severity: 'high',
          title: 'Duplicate Service Name',
          message: `Service name "${service.serviceName}" is used ${duplicateNames.length} times. Service names must be unique.`,
          field: `services[${index}].serviceName`,
          fix: 'Rename one of the duplicate services'
        });
      }
    });

    // Check for circular dependencies
    const cycles = this.detectCircularDependencies(services);
    if (cycles.length > 0) {
      cycles.forEach(cycle => {
        suggestions.push({
          type: 'error',
          severity: 'high',
          title: 'Circular Dependency',
          message: `Circular dependency detected: ${cycle.join(' → ')}. This will prevent services from starting.`,
          field: 'depends_on',
          fix: 'Remove one of the dependencies to break the cycle'
        });
      });
    }

    // Check for services without images
    services.forEach((service, index) => {
      if (!service.dockerImage || !service.dockerImage.trim()) {
        suggestions.push({
          type: 'error',
          severity: 'high',
          title: 'Missing Docker Image',
          message: `Service "${service.serviceName}" has no Docker image specified.`,
          field: `services[${index}].dockerImage`,
          fix: 'Specify a Docker image for this service'
        });
      }
    });

    return suggestions.sort((a, b) => {
      const severityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  // Detect circular dependencies
  private detectCircularDependencies(services: ServiceConfig[]): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (serviceName: string, path: string[]): void => {
      visited.add(serviceName);
      recStack.add(serviceName);

      const service = services.find(s => s.serviceName === serviceName);
      if (service?.depends_on) {
        for (const dep of service.depends_on) {
          if (!visited.has(dep)) {
            dfs(dep, [...path, dep]);
          } else if (recStack.has(dep)) {
            // Found a cycle
            const cycleStart = path.indexOf(dep);
            if (cycleStart >= 0) {
              cycles.push([...path.slice(cycleStart), dep]);
            }
          }
        }
      }

      recStack.delete(serviceName);
    };

    services.forEach(service => {
      if (!visited.has(service.serviceName)) {
        dfs(service.serviceName, [service.serviceName]);
      }
    });

    return cycles;
  }

  // Get quick reference examples
  getQuickReferences(): { category: string; examples: { title: string; yaml: string; description: string }[] }[] {
    return [
      {
        category: 'Common Patterns',
        examples: [
          {
            title: 'Web App with Database',
            description: 'A typical web application with a database backend',
            yaml: `services:
  web:
    image: nginx:1.25
    ports:
      - "8080:80"
    depends_on:
      - db
    environment:
      - DB_HOST=db
      - DB_NAME=myapp
  
  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=myapp
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:`
          },
          {
            title: 'Multi-Service API',
            description: 'API with Redis cache and database',
            yaml: `services:
  api:
    image: node:18
    ports:
      - "3000:3000"
    depends_on:
      - redis
      - postgres
    environment:
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgres://user:pass@postgres:5432/db
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  
  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=db
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:`
          }
        ]
      },
      {
        category: 'Health Checks',
        examples: [
          {
            title: 'HTTP Health Check',
            description: 'Check if a web service is responding',
            yaml: `healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:80/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s`
          },
          {
            title: 'Database Health Check',
            description: 'Check if PostgreSQL is ready',
            yaml: `healthcheck:
  test: ["CMD-SHELL", "pg_isready -U postgres"]
  interval: 10s
  timeout: 5s
  retries: 5`
          }
        ]
      },
      {
        category: 'Resource Limits',
        examples: [
          {
            title: 'CPU and Memory Limits',
            description: 'Limit resources for a service',
            yaml: `deploy:
  resources:
    limits:
      cpus: '1.0'
      memory: 512M
    reservations:
      cpus: '0.5'
      memory: 256M`
          }
        ]
      }
    ];
  }

  // Get best practices guide
  getBestPractices(): { category: string; practices: { title: string; description: string; link?: string }[] }[] {
    return [
      {
        category: 'Security',
        practices: [
          {
            title: 'Never commit secrets',
            description: 'Use environment files (.env) or Docker secrets for sensitive data like passwords and API keys.',
            link: 'https://docs.docker.com/compose/environment-variables/'
          },
          {
            title: 'Pin image versions',
            description: 'Always specify exact version tags instead of "latest" to ensure reproducible deployments.',
          },
          {
            title: 'Use non-root users',
            description: 'Run containers as non-root users when possible. Many official images already do this.',
            link: 'https://docs.docker.com/engine/security/userns-remap/'
          }
        ]
      },
      {
        category: 'Performance',
        practices: [
          {
            title: 'Set resource limits',
            description: 'Define CPU and memory limits to prevent one service from consuming all resources.',
          },
          {
            title: 'Use health checks',
            description: 'Health checks help Docker know when services are ready and detect failures early.',
            link: 'https://docs.docker.com/compose/compose-file/#healthcheck'
          },
          {
            title: 'Optimize image sizes',
            description: 'Use alpine-based images when possible. They are smaller and faster to pull.',
          }
        ]
      },
      {
        category: 'Reliability',
        practices: [
          {
            title: 'Set restart policies',
            description: 'Use "always" or "on-failure" restart policies for production services.',
            link: 'https://docs.docker.com/compose/compose-file/#restart'
          },
          {
            title: 'Use named volumes',
            description: 'Use named volumes for data persistence instead of bind mounts when possible.',
            link: 'https://docs.docker.com/compose/compose-file/#volumes'
          },
          {
            title: 'Define dependencies',
            description: 'Use depends_on to ensure services start in the correct order.',
            link: 'https://docs.docker.com/compose/compose-file/#depends_on'
          }
        ]
      }
    ];
  }
}

