import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DockerComposeService } from '../services/docker-compose.service';

interface DockerComposeConfig {
  serviceTemplate: string;
  serviceName: string;
  dockerImage: string;
  hostPort: string;
  containerPort: string;
  environment: string;
  volumes: string;
}


@Component({
  selector: 'app-compose-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './compose-form.component.html',
  styleUrls: ['./compose-form.component.scss']
})
export class ComposeFormComponent implements OnInit {
  composeForm: FormGroup;
  yamlPreview: string = ''; // Holds the live YAML preview

  constructor(private dockerComposeService: DockerComposeService) {
    this.composeForm = new FormGroup({
      serviceTemplate: new FormControl(''),
      serviceName: new FormControl('', [Validators.required]),
      dockerImage: new FormControl('', [Validators.required]),
      hostPort: new FormControl('', [Validators.required, Validators.pattern(/^\d+$/)]),
      containerPort: new FormControl('', [Validators.required, Validators.pattern(/^\d+$/)]),
      environment: new FormControl(''),
      volumes: new FormControl('')
    });
  }
  

  ngOnInit() {
    this.composeForm.get('serviceTemplate')?.valueChanges.subscribe(template => {
      if (template) {
        const templateConfig = this.getServiceTemplate(template);
        this.composeForm.patchValue(templateConfig, { emitEvent: false });
      }
    });
  
    this.composeForm.valueChanges.subscribe(values => {
      this.updateYamlPreview(values);
    });
  }
  

  generateDockerComposeFile() {
    if (this.composeForm.invalid) {
      alert('Please fill in all required fields correctly');
      return;
    }

    const config: DockerComposeConfig = this.composeForm.value as DockerComposeConfig;

    console.log('Config to be sent:', config);

    this.dockerComposeService.generateAndDownloadFile(config);
    this.resetForm();
  }

  isFormDirty(): boolean {
    return this.composeForm.dirty;
  }

  resetForm() {
    this.composeForm.reset();
    this.yamlPreview = ''; // Clear the YAML preview on reset
  }

  // Generate YAML preview dynamically
  private updateYamlPreview(values: Partial<DockerComposeConfig>) {
    const { serviceTemplate, serviceName, dockerImage, hostPort, containerPort, environment, volumes } = values;
  
    const envArray = environment
      ? environment.split(',').map(env => `      - ${env.trim()}`).join('\n')
      : '';
  
    const volArray = volumes
      ? volumes.split(',').map(vol => `      - ${vol.trim()}`).join('\n')
      : '';
  
    this.yamlPreview = `
  version: '3.8'
  services:
    ${serviceName || '<service-name>'}:
      image: ${dockerImage || '<docker-image>'}
      ports:
        - "${hostPort || '<host-port>'}:${containerPort || '<container-port>'}"
      environment:
  ${envArray || '      # Add environment variables here'}
      volumes:
  ${volArray || '      # Add volumes here'}
  `.trim();
  
    if (serviceTemplate) {
      this.yamlPreview = `# Using ${serviceTemplate} template\n` + this.yamlPreview;
    }
  }
  
  private getServiceTemplate(template: string): Partial<DockerComposeConfig> {
    switch (template) {
      case 'nginx':
        return {
          serviceName: 'nginx',
          dockerImage: 'nginx:alpine',
          hostPort: '80',
          containerPort: '80',
          volumes: './nginx.conf:/etc/nginx/nginx.conf:ro'
        };
      case 'postgres':
        return {
          serviceName: 'db',
          dockerImage: 'postgres:13',
          hostPort: '5432',
          containerPort: '5432',
          environment: 'POSTGRES_PASSWORD=${DB_PASSWORD:-password}',
          volumes: 'postgres-data:/var/lib/postgresql/data'
        };
      case 'redis':
        return {
          serviceName: 'redis',
          dockerImage: 'redis:alpine',
          hostPort: '6379',
          containerPort: '6379',
          volumes: 'redis-data:/data'
        };
      default:
        return {};
    }
  }
  
}
