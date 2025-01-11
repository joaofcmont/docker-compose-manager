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

  // Create the Docker Compose configuration based on form values
  generateDockerComposeConfig(formValues: any) {
    const healthCheck = formValues.healthCheck;
    const resources = formValues.resources;
    const deploy = formValues.deploy;

    const serviceConfig: any = {
      image: formValues.dockerImage,
      ports: [`${formValues.hostPort}:${formValues.containerPort}`],
      environment: this.parseListInput(formValues.environment || ''), // Handle missing environment
      volumes: this.parseListInput(formValues.volumes || ''),
      restart: formValues.restart,
    };

    if (healthCheck?.enabled) {
      serviceConfig.healthcheck = {
        test: this.getHealthCheckTest(formValues.containerPort),
        interval: healthCheck.interval,
        timeout: healthCheck.timeout,
        retries: healthCheck.retries,
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
  private getHealthCheckTest(port: string): string[] {
    const dockerImage = port.toLowerCase();

    if (dockerImage.includes('postgres')) {
      return ['CMD', 'pg_isready'];
    } else if (dockerImage.includes('redis')) {
      return ['CMD', 'redis-cli', 'ping'];
    } else if (dockerImage.includes('mongo')) {
      return ['CMD', 'mongosh', '--eval', 'db.adminCommand("ping")'];
    } else {
      return ['CMD', 'curl', '-f', `http://localhost:${port}`];
    }
  }
}
