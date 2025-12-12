import { Injectable } from '@angular/core';
import * as yaml from 'js-yaml';
import { ServiceConfig } from '../models/service-config.model';
import { StackTemplate } from '../models/template.model';


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
    },
    mysql: {
      serviceName: 'db',
      dockerImage: 'mysql:8',
      ports: [{ host: '3306', container: '3306' }],
      environment: ['MYSQL_ROOT_PASSWORD=rootpassword', 'MYSQL_DATABASE=mydb'],
      volumes: ['mysql-data:/var/lib/mysql'],
      healthcheck: {
        test: ['CMD', 'mysqladmin', 'ping', '-h', 'localhost'],
        interval: '10s',
        timeout: '5s',
        retries: 5,
      },
    },
    mongo: {
      serviceName: 'db',
      dockerImage: 'mongo:7',
      ports: [{ host: '27017', container: '27017' }],
      environment: ['MONGO_INITDB_ROOT_USERNAME=admin', 'MONGO_INITDB_ROOT_PASSWORD=password'],
      volumes: ['mongo-data:/data/db'],
      healthcheck: {
        test: ['CMD', 'mongosh', '--eval', 'db.adminCommand("ping")'],
        interval: '10s',
        timeout: '5s',
        retries: 5,
      },
    }
  };

  constructor() {}

  // Get a service template by name
  getServiceTemplate(templateName: string) {
    return this.SERVICE_TEMPLATES[templateName as keyof typeof this.SERVICE_TEMPLATES];
  }

  // Get all available stack templates
  getStackTemplates(): StackTemplate[] {
    return Object.values(this.STACK_TEMPLATES);
  }

  // Get a stack template by ID
  getStackTemplate(stackId: string): StackTemplate | undefined {
    return this.STACK_TEMPLATES[stackId];
  }

  private readonly STACK_TEMPLATES: { [key: string]: StackTemplate } = {
    'node-postgres': {
      id: 'node-postgres',
      name: 'Node.js + PostgreSQL',
      description: 'Full-stack Node.js application with Express and PostgreSQL database',
      icon: 'node',
      tags: ['nodejs', 'postgresql', 'fullstack', 'api'],
      services: [
        {
          serviceName: 'app',
          dockerImage: 'node:18-alpine',
          hostPort: '3000',
          containerPort: '3000',
          environment: 'NODE_ENV=production\nDATABASE_URL=postgresql://user:password@db:5432/mydb',
          volumes: './app:/usr/src/app\n/usr/src/app/node_modules',
          healthCheck: {
            enabled: true,
            interval: '30s',
            timeout: '10s',
            retries: 3,
            test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
          },
          resources: {
            cpuLimit: 1.0,
            memoryLimit: 512
          },
          deploy: {
            replicas: 1
          },
          restart: 'always',
          depends_on: ['db'],
          networks: [],
          labels: {},
          notes: 'Node.js Express application'
        },
        {
          serviceName: 'db',
          dockerImage: 'postgres:13',
          hostPort: '5432',
          containerPort: '5432',
          environment: 'POSTGRES_USER=user\nPOSTGRES_PASSWORD=password\nPOSTGRES_DB=mydb',
          volumes: 'postgres-data:/var/lib/postgresql/data',
          healthCheck: {
            enabled: true,
            interval: '10s',
            timeout: '5s',
            retries: 5,
            test: ['CMD', 'pg_isready']
          },
          resources: {
            cpuLimit: 0.5,
            memoryLimit: 512
          },
          deploy: {
            replicas: 1
          },
          restart: 'always',
          depends_on: [],
          networks: [],
          labels: {},
          notes: 'PostgreSQL database'
        }
      ]
    },
    'java-postgres': {
      id: 'java-postgres',
      name: 'Java + PostgreSQL',
      description: 'Spring Boot Java application with PostgreSQL database',
      icon: 'java',
      tags: ['java', 'spring-boot', 'postgresql', 'backend'],
      services: [
        {
          serviceName: 'app',
          dockerImage: 'openjdk:17-jdk-slim',
          hostPort: '8080',
          containerPort: '8080',
          environment: 'SPRING_DATASOURCE_URL=jdbc:postgresql://db:5432/mydb\nSPRING_DATASOURCE_USERNAME=user\nSPRING_DATASOURCE_PASSWORD=password',
          volumes: './app:/app',
          healthCheck: {
            enabled: true,
            interval: '30s',
            timeout: '10s',
            retries: 3,
            test: ['CMD', 'curl', '-f', 'http://localhost:8080/actuator/health']
          },
          resources: {
            cpuLimit: 1.0,
            memoryLimit: 1024
          },
          deploy: {
            replicas: 1
          },
          restart: 'always',
          depends_on: ['db'],
          networks: [],
          labels: {},
          notes: 'Spring Boot Java application'
        },
        {
          serviceName: 'db',
          dockerImage: 'postgres:13',
          hostPort: '5432',
          containerPort: '5432',
          environment: 'POSTGRES_USER=user\nPOSTGRES_PASSWORD=password\nPOSTGRES_DB=mydb',
          volumes: 'postgres-data:/var/lib/postgresql/data',
          healthCheck: {
            enabled: true,
            interval: '10s',
            timeout: '5s',
            retries: 5,
            test: ['CMD', 'pg_isready']
          },
          resources: {
            cpuLimit: 0.5,
            memoryLimit: 512
          },
          deploy: {
            replicas: 1
          },
          restart: 'always',
          depends_on: [],
          networks: [],
          labels: {},
          notes: 'PostgreSQL database'
        }
      ]
    },
    'lamp': {
      id: 'lamp',
      name: 'LAMP Stack',
      description: 'Linux, Apache, MySQL, PHP stack for web applications',
      icon: 'php',
      tags: ['php', 'apache', 'mysql', 'lamp', 'web'],
      services: [
        {
          serviceName: 'web',
          dockerImage: 'php:8.2-apache',
          hostPort: '80',
          containerPort: '80',
          environment: 'PHP_MYSQL_HOST=db\nPHP_MYSQL_DATABASE=mydb\nPHP_MYSQL_USER=user\nPHP_MYSQL_PASSWORD=password',
          volumes: './www:/var/www/html',
          healthCheck: {
            enabled: true,
            interval: '30s',
            timeout: '10s',
            retries: 3,
            test: ['CMD', 'curl', '-f', 'http://localhost:80']
          },
          resources: {
            cpuLimit: 0.5,
            memoryLimit: 512
          },
          deploy: {
            replicas: 1
          },
          restart: 'always',
          depends_on: ['db'],
          networks: [],
          labels: {},
          notes: 'Apache web server with PHP'
        },
        {
          serviceName: 'db',
          dockerImage: 'mysql:8',
          hostPort: '3306',
          containerPort: '3306',
          environment: 'MYSQL_ROOT_PASSWORD=rootpassword\nMYSQL_DATABASE=mydb\nMYSQL_USER=user\nMYSQL_PASSWORD=password',
          volumes: 'mysql-data:/var/lib/mysql',
          healthCheck: {
            enabled: true,
            interval: '10s',
            timeout: '5s',
            retries: 5,
            test: ['CMD', 'mysqladmin', 'ping', '-h', 'localhost']
          },
          resources: {
            cpuLimit: 0.5,
            memoryLimit: 512
          },
          deploy: {
            replicas: 1
          },
          restart: 'always',
          depends_on: [],
          networks: [],
          labels: {},
          notes: 'MySQL database'
        }
      ]
    },
    'mean': {
      id: 'mean',
      name: 'MEAN Stack',
      description: 'MongoDB, Express, Angular, Node.js full-stack application',
      icon: 'mean',
      tags: ['mongodb', 'express', 'angular', 'nodejs', 'mean', 'fullstack'],
      services: [
        {
          serviceName: 'app',
          dockerImage: 'node:18-alpine',
          hostPort: '3000',
          containerPort: '3000',
          environment: 'NODE_ENV=production\nMONGODB_URI=mongodb://db:27017/mydb',
          volumes: './app:/usr/src/app\n/usr/src/app/node_modules',
          healthCheck: {
            enabled: true,
            interval: '30s',
            timeout: '10s',
            retries: 3,
            test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
          },
          resources: {
            cpuLimit: 1.0,
            memoryLimit: 512
          },
          deploy: {
            replicas: 1
          },
          restart: 'always',
          depends_on: ['db'],
          networks: [],
          labels: {},
          notes: 'Node.js Express API server'
        },
        {
          serviceName: 'db',
          dockerImage: 'mongo:7',
          hostPort: '27017',
          containerPort: '27017',
          environment: 'MONGO_INITDB_ROOT_USERNAME=admin\nMONGO_INITDB_ROOT_PASSWORD=password',
          volumes: 'mongo-data:/data/db',
          healthCheck: {
            enabled: true,
            interval: '10s',
            timeout: '5s',
            retries: 3,
            test: ['CMD', 'mongosh', '--eval', 'db.adminCommand("ping")']
          },
          resources: {
            cpuLimit: 0.5,
            memoryLimit: 512
          },
          deploy: {
            replicas: 1
          },
          restart: 'always',
          depends_on: [],
          networks: [],
          labels: {},
          notes: 'MongoDB database'
        }
      ]
    },
    'django-postgres': {
      id: 'django-postgres',
      name: 'Django + PostgreSQL',
      description: 'Python Django web framework with PostgreSQL database',
      icon: 'python',
      tags: ['python', 'django', 'postgresql', 'web'],
      services: [
        {
          serviceName: 'web',
          dockerImage: 'python:3.11-slim',
          hostPort: '8000',
          containerPort: '8000',
          environment: 'DJANGO_SETTINGS_MODULE=myproject.settings\nDATABASE_URL=postgresql://user:password@db:5432/mydb',
          volumes: './app:/app',
          healthCheck: {
            enabled: true,
            interval: '30s',
            timeout: '10s',
            retries: 3,
            test: ['CMD', 'curl', '-f', 'http://localhost:8000/health']
          },
          resources: {
            cpuLimit: 0.5,
            memoryLimit: 512
          },
          deploy: {
            replicas: 1
          },
          restart: 'always',
          depends_on: ['db'],
          networks: [],
          labels: {},
          notes: 'Django web application'
        },
        {
          serviceName: 'db',
          dockerImage: 'postgres:13',
          hostPort: '5432',
          containerPort: '5432',
          environment: 'POSTGRES_USER=user\nPOSTGRES_PASSWORD=password\nPOSTGRES_DB=mydb',
          volumes: 'postgres-data:/var/lib/postgresql/data',
          healthCheck: {
            enabled: true,
            interval: '10s',
            timeout: '5s',
            retries: 5,
            test: ['CMD', 'pg_isready']
          },
          resources: {
            cpuLimit: 0.5,
            memoryLimit: 512
          },
          deploy: {
            replicas: 1
          },
          restart: 'always',
          depends_on: [],
          networks: [],
          labels: {},
          notes: 'PostgreSQL database'
        }
      ]
    }
  };

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
  generateDockerComposeConfigFromServices(services: any[], profile?: string): any {
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

      // Add profile if specified
      if (profile) {
        serviceConfig.profiles = [profile];
      }

      // Add healthcheck
      if (service.healthCheck?.enabled) {
        const interval = service.healthCheck.interval?.trim();
        const timeout = service.healthCheck.timeout?.trim();
        const retries = service.healthCheck.retries;

        if (interval && timeout && retries !== undefined && retries >= 0) {
          const healthcheck: any = {
            interval: interval,
            timeout: timeout,
            retries: Number(retries) || 3,
          };

          // Use custom test if provided, otherwise auto-detect
          if (service.healthCheck.test && Array.isArray(service.healthCheck.test) && service.healthCheck.test.length > 0) {
            const test = service.healthCheck.test.filter((t: string) => t && t.trim());
            if (test.length === 1 && test[0] === 'NONE') {
              healthcheck.test = 'NONE';
            } else if (test.length === 2 && test[0] === 'CMD-SHELL') {
              healthcheck.test = ['CMD-SHELL', test[1]];
            } else if (test.length > 0) {
              healthcheck.test = test;
            } else {
              healthcheck.test = this.getHealthCheckTest(service.dockerImage, service.containerPort);
            }
          } else {
            healthcheck.test = this.getHealthCheckTest(service.dockerImage, service.containerPort);
          }

          // Add start_period if provided
          if (service.healthCheck.startPeriod && service.healthCheck.startPeriod.trim()) {
            healthcheck.start_period = service.healthCheck.startPeriod.trim();
          }

          serviceConfig.healthcheck = healthcheck;
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

      // Add networks
      if (service.networks && Array.isArray(service.networks) && service.networks.length > 0) {
        serviceConfig.networks = service.networks.filter((net: string) => net && net.trim());
      }

      // Add labels
      if (service.labels && typeof service.labels === 'object' && Object.keys(service.labels).length > 0) {
        // Filter out empty keys
        const cleanLabels: { [key: string]: string } = {};
        Object.entries(service.labels).forEach(([key, value]) => {
          if (key && key.trim() && value !== undefined && value !== null) {
            cleanLabels[key.trim()] = String(value).trim();
          }
        });
        if (Object.keys(cleanLabels).length > 0) {
          serviceConfig.labels = cleanLabels;
        }
      }

      servicesConfig[service.serviceName] = serviceConfig;
    });

    // Collect all unique networks for top-level networks section
    const allNetworks = new Set<string>();
    services.forEach(service => {
      if (service.networks && Array.isArray(service.networks)) {
        service.networks.forEach((net: string) => {
          if (net && net.trim()) {
            allNetworks.add(net.trim());
          }
        });
      }
    });

    const config: any = {
      version: '3.8',
      services: servicesConfig,
    };

    // Add top-level networks section if any networks are used
    if (allNetworks.size > 0) {
      config.networks = {};
      allNetworks.forEach(net => {
        config.networks[net] = {};
      });
    }

    return config;
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
