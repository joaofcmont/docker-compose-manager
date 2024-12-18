import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DockerComposeService {
  constructor() { }

  submitApplication(formData: any) {
    console.log('Received form data:', formData);
    this.generateDockerComposeFile(formData);
  }

  private generateDockerComposeFile(data: any) {
    // This is a simple example. In a real scenario, you'd want to use a proper YAML library
    let yamlContent = 'version: "3"\nservices:\n';
    
    if (data.serviceName && data.image) {
      yamlContent += `  ${data.serviceName}:\n`;
      yamlContent += `    image: ${data.image}\n`;
      
      if (data.ports) {
        yamlContent += '    ports:\n';
        data.ports.split(',').forEach((port: string) => {
          yamlContent += `      - "${port.trim()}"\n`;
        });
      }
      
      if (data.environment) {
        yamlContent += '    environment:\n';
        Object.entries(data.environment).forEach(([key, value]) => {
          yamlContent += `      - ${key}=${value}\n`;
        });
      }
    }

    console.log('Generated Docker Compose YAML:', yamlContent);
    // Here you would typically save this to a file or send it to a backend
  }
}
