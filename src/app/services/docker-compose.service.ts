import { Injectable } from '@angular/core';
import * as yaml from 'js-yaml';


interface ServiceTemplate {
  serviceName: string;
  dockerImage: string;
  ports: { host: string; container: string }[];
  volumes: string[];
  healthcheck: {
    test: string[];
    interval: string;
    timeout: string;
    retries: number;
  };
  environment?: string[];  // Make `environment` optional
}

@Injectable({
  providedIn: 'root',
})
export class DockerComposeService {

  private readonly SERVICE_TEMPLATES: { [key: string]: ServiceTemplate } = {
    nginx: {
      serviceName: 'nginx',
      dockerImage: 'nginx:alpine',
      ports: [{ host: '80', container: '80' }],
      volumes: ['./nginx.conf:/etc/nginx/nginx.conf:ro'],
      healthcheck: {
        test: ['CMD', 'curl', '-f', 'http://localhost:80'],
        interval: '30s',
        timeout: '10s',
        retries: 3,
      },
    },
    postgres: {
      serviceName: 'db',
      dockerImage: 'postgres:13',
      ports: [{ host: '5432', container: '5432' }],
      environment: ['POSTGRES_PASSWORD=${DB_PASSWORD:-password}'],
      volumes: ['postgres-data:/var/lib/postgresql/data'],
      healthcheck: {
        test: ['CMD', 'pg_isready'],
        interval: '10s',
        timeout: '5s',
        retries: 5,
      },
    },
    redis: {
      serviceName: 'redis',
      dockerImage: 'redis:alpine',
      ports: [{ host: '6379', container: '6379' }],
      volumes: ['redis-data:/data'],
      healthcheck: {
        test: ['CMD', 'redis-cli', 'ping'],
        interval: '10s',
        timeout: '5s',
        retries: 3,
      },
    }
  };

  constructor() {}

  // Get a service template by name
  getServiceTemplate(templateName: string) {
    return this.SERVICE_TEMPLATES[templateName as keyof typeof this.SERVICE_TEMPLATES];
  }

  // Generate and download the Docker Compose file
  generateAndDownloadFile(config: any): void {
    const yamlContent = yaml.dump(config, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
    });

    const blob = new Blob([yamlContent], { type: 'application/x-yaml' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'docker-compose.yml';
    link.click();
  }

  // Create the Docker Compose configuration from multiple services
  generateDockerComposeConfigFromServices(services: any[]): any {
    const servicesConfig: any = {};

    services.forEach(service => {
      if (!service.serviceName || !service.dockerImage) {
        return; // Skip invalid services
      }

      const serviceConfig: any = {
        image: service.dockerImage,
        ports: service.hostPort && service.containerPort 
          ? [`${service.hostPort}:${service.containerPort}`]
          : [],
        environment: this.parseListInput(service.environment || ''),
        volumes: this.parseListInput(service.volumes || ''),
        restart: service.restart || 'always',
      };

      // Add healthcheck
      if (service.healthCheck?.enabled) {
        const interval = service.healthCheck.interval?.trim();
        const timeout = service.healthCheck.timeout?.trim();
        const retries = service.healthCheck.retries;

        if (interval && timeout && retries !== undefined && retries >= 0) {
          serviceConfig.healthcheck = {
            test: this.getHealthCheckTest(service.dockerImage, service.containerPort),
            interval: interval,
            timeout: timeout,
            retries: Number(retries) || 3,
          };
        }
      }

      // Add deploy resources
      if (service.deploy?.replicas > 1 || service.resources?.cpuLimit > 0 || service.resources?.memoryLimit > 0) {
        serviceConfig.deploy = {
          replicas: service.deploy?.replicas || 1,
          resources: {
            limits: {
              cpus: service.resources?.cpuLimit?.toString() || '0.5',
              memory: `${service.resources?.memoryLimit || 512}MB`,
            },
          },
        };
      }

      // Add depends_on
      if (service.depends_on && Array.isArray(service.depends_on) && service.depends_on.length > 0) {
        serviceConfig.depends_on = service.depends_on.filter((dep: string) => dep && dep.trim());
      }

      servicesConfig[service.serviceName] = serviceConfig;
    });

    return {
      version: '3.8',
      services: servicesConfig,
    };
  }

  // Create the Docker Compose configuration based on form values (legacy single-service method)
  generateDockerComposeConfig(formValues: any) {
    const healthCheck = formValues.healthCheck;
    const resources = formValues.resources;
    const deploy = formValues.deploy;

    // Validate required fields
    if (!formValues.serviceName || !formValues.dockerImage) {
      throw new Error('Service name and Docker image are required');
    }

    if (!formValues.hostPort || !formValues.containerPort) {
      throw new Error('Both host port and container port are required');
    }

    const serviceConfig: any = {
      image: formValues.dockerImage,
      ports: [`${formValues.hostPort}:${formValues.containerPort}`],
      environment: this.parseListInput(formValues.environment || ''), // Handle missing environment
      volumes: this.parseListInput(formValues.volumes || ''),
      restart: formValues.restart || 'always',
    };

    // Validate and add healthcheck with proper error handling
    if (healthCheck?.enabled) {
      // Validate healthcheck fields
      const interval = healthCheck.interval?.trim();
      const timeout = healthCheck.timeout?.trim();
      const retries = healthCheck.retries;

      if (!interval || !timeout) {
        throw new Error('Health check interval and timeout are required when health check is enabled');
      }

      if (retries === undefined || retries === null || retries < 0) {
        throw new Error('Health check retries must be a non-negative number');
      }

      // Get container port safely
      const containerPort = formValues.containerPort || '80';
      const dockerImage = formValues.dockerImage || '';

      serviceConfig.healthcheck = {
        test: this.getHealthCheckTest(dockerImage, containerPort),
        interval: interval,
        timeout: timeout,
        retries: Number(retries) || 3,
      };
    }

    if (deploy?.replicas > 1 || resources?.cpuLimit > 0 || resources?.memoryLimit > 0) {
      serviceConfig.deploy = {
        replicas: deploy?.replicas,
        resources: {
          limits: {
            cpus: resources?.cpuLimit?.toString(),
            memory: `${resources?.memoryLimit}MB`,
          },
        },
      };
    }

    if (formValues.depends_on) {
      serviceConfig.depends_on = this.parseListInput(formValues.depends_on);
    }

    return {
      version: '3.8',
      services: {
        [formValues.serviceName]: serviceConfig,
      },
    };
  }

  // Helper method to parse list input (environment variables, volumes, etc.)
  private parseListInput(input: string): string[] {
    return input
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  // Helper method to determine the health check test based on the image
  private getHealthCheckTest(dockerImage: string, containerPort: string): string[] {
    // Ensure we have valid inputs
    const image = (dockerImage || '').trim();
    const port = (containerPort || '80').toString().trim();

    // Default to HTTP check if no image provided
    if (!image) {
      return ['CMD', 'curl', '-f', `http://localhost:${port}`];
    }

    const imageLower = image.toLowerCase();

    // Database-specific health checks
    if (imageLower.includes('postgres')) {
      return ['CMD', 'pg_isready'];
    } else if (imageLower.includes('redis')) {
      return ['CMD', 'redis-cli', 'ping'];
    } else if (imageLower.includes('mongo')) {
      return ['CMD', 'mongosh', '--eval', 'db.adminCommand("ping")'];
    } else if (imageLower.includes('mysql')) {
      return ['CMD', 'mysqladmin', 'ping', '-h', 'localhost'];
    } else {
      // Default HTTP health check
      return ['CMD', 'curl', '-f', `http://localhost:${port}`];
    }
  }
}
