import { Injectable } from '@angular/core';

interface DockerComposeConfig {
  serviceName: string;
  dockerImage: string;
  hostPort: string;
  containerPort: string;
  environment: string[];
  volumes: string[];
  healthCheck?: {
    enabled: boolean;
    interval: string;
    timeout: string;
    retries: number;
  };
  resources?: {
    cpuLimit: number;
    memoryLimit: number;
  };
  deploy?: {
    replicas: number;
    resources?: {
      limits: {
        cpus: string;
        memory: string;
      };
    };
  };
  restart: string;
  depends_on?: string[];
}

@Injectable({
  providedIn: 'root',
})
export class DockerComposeService {
  generateAndDownloadFile(
    config: DockerComposeConfig,
    filename: string = 'docker-compose.yml'
  ): void {
    this.validateConfig(config);
    console.log('Received config:', config);
    const dockerComposeContent = this.generateDockerComposeContent(config);
    console.log('Generated content:', dockerComposeContent);
    this.downloadFile(dockerComposeContent, filename);
  }

  previewDockerComposeContent(config: DockerComposeConfig): string {
    this.validateConfig(config);
    return this.generateDockerComposeContent(config);
  }

  private generateDockerComposeContent(config: DockerComposeConfig): string {
    const {
      serviceName,
      dockerImage,
      hostPort,
      containerPort,
      environment,
      volumes,
      healthCheck,
      resources,
      deploy,
      restart,
      depends_on,
    } = config;

    let composeContent = `version: '3.8'
services:
  ${serviceName}:
    image: ${dockerImage}
    ports:
      - "${hostPort}:${containerPort}"`;

    // Add environment variables if present
    if (environment && environment.length > 0) {
      composeContent += `\n    ${this.formatEnvironment(environment)}`;
    }

    // Add volumes if present
    if (volumes && volumes.length > 0) {
      composeContent += `\n    ${this.formatVolumes(volumes)}`;
    }

    // Add dependencies if present
    if (depends_on && depends_on.length > 0) {
      composeContent += `\n    depends_on:\n      ${depends_on
        .map((dep) => `- ${dep}`)
        .join('\n      ')}`;
    }

    // Add healthcheck if enabled
    if (healthCheck?.enabled) {
      composeContent += `\n    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:${containerPort}"]
      interval: ${healthCheck.interval}
      timeout: ${healthCheck.timeout}
      retries: ${healthCheck.retries}`;
    }

    // Add deploy and resources configuration
    if (deploy || resources) {
      composeContent += '\n    deploy:';

      if (deploy?.replicas) {
        composeContent += `\n      replicas: ${deploy.replicas}`;
      }

      if (deploy?.resources?.limits) {
        composeContent += `\n      resources:
          limits:
            cpus: '${deploy.resources.limits.cpus}'
            memory: ${deploy.resources.limits.memory}`;
      }

      if (resources) {
        composeContent += `\n      resources:
          limits:
            cpus: '${resources.cpuLimit}'
            memory: ${resources.memoryLimit}M`;
      }
    }

    // Add restart policy if specified
    if (restart && restart !== 'no') {
      composeContent += `\n    restart: ${restart}`;
    }

    return composeContent;
  }

  private validateConfig(config: DockerComposeConfig): void {
    if (!config.serviceName || !config.dockerImage || !config.hostPort || !config.containerPort) {
      throw new Error('Missing required fields in Docker Compose configuration');
    }

    if (config.healthCheck?.enabled) {
      if (!config.healthCheck.interval || !config.healthCheck.timeout || !config.healthCheck.retries) {
        throw new Error('Missing required health check fields');
      }
    }

    if (!config.restart) {
      throw new Error('Restart policy is required');
    }

    if (config.resources) {
      if (config.resources.cpuLimit <= 0 || config.resources.memoryLimit <= 0) {
        throw new Error('Invalid resource limits');
      }
    }

    if (config.deploy?.replicas) {
      if (config.deploy.replicas < 1) {
        throw new Error('Number of replicas must be at least 1');
      }
    }
  }

  private formatEnvironment(environment: string[]): string {
    if (!environment || environment.length === 0) return '';
    return `environment:
      ${environment.map((env) => `- ${env}`).join('\n      ')}`;
  }

  private formatVolumes(volumes: string[]): string {
    if (!volumes || volumes.length === 0) return '';
    return `volumes:
      ${volumes.map((volume) => `- ${volume}`).join('\n      ')}`;
  }

  private downloadFile(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/yaml' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
}
