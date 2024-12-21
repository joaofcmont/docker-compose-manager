import { Injectable } from '@angular/core';

interface DockerComposeConfig {
  serviceName: string;
  dockerImage: string;
  hostPort: string;
  containerPort: string;
  environment: string;
  volumes: string;
}

@Injectable({
  providedIn: 'root'
})
export class DockerComposeService {

  generateAndDownloadFile(config: DockerComposeConfig, filename: string = 'docker-compose.yml'): void {
    this.validateConfig(config);
    console.log('Received config:', config);
    const dockerComposeContent = this.generateDockerComposeContent(config);
    console.log('Generated content:', dockerComposeContent);
    this.downloadFile(dockerComposeContent, filename);
    }

    previewDockerComposeContent(config: DockerComposeConfig): string {
      return this.generateDockerComposeContent(config);
    }

  private generateDockerComposeContent(config: DockerComposeConfig): string {
    const { serviceName, dockerImage, hostPort, containerPort, environment, volumes } = config;

    return `version: '3'
services:
  ${serviceName}:
    image: ${dockerImage}
    ports:
      - "${hostPort}:${containerPort}"
    ${this.formatEnvironment(environment)}
    ${this.formatVolumes(volumes)}`;
  }
  
  private validateConfig(config: DockerComposeConfig): void {
    if (!config.serviceName || !config.dockerImage || !config.hostPort || !config.containerPort) {
      throw new Error('Missing required fields in Docker Compose configuration');
    }
  }

  private formatEnvironment(environment: string): string {
    if (!environment.trim()) return '';
    const envVars = environment.split('\n').filter(line => line.trim() !== '');
    if (envVars.length === 0) return '';
    return `environment:
      ${envVars.join('\n      ')}`;
  }

  private formatVolumes(volumes: string): string {
    if (!volumes.trim()) return '';
    const volumeMappings = volumes.split('\n').filter(line => line.trim() !== '');
    if (volumeMappings.length === 0) return '';
    return `volumes:
      ${volumeMappings.join('\n      ')}`;
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
