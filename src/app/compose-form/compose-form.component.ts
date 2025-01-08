import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DockerComposeService } from '../services/docker-compose.service';
import * as yaml from 'js-yaml';

interface DockerComposeConfig {
  serviceTemplate: string;
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

interface ParsedYaml {
  services: {
    [key: string]: {
      image: string;
      ports: string[];
      environment?: string[];
      volumes?: string[];
    };
  };
}

@Component({
  selector: 'app-compose-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './compose-form.component.html',
  styleUrls: ['./compose-form.component.scss'],
})
export class ComposeFormComponent implements OnInit {
  composeForm: FormGroup;
  selectedFile: File | null = null;
  fileContent: string = '';
  yamlPreview: string = '';

  constructor(private dockerComposeService: DockerComposeService) {
    this.composeForm = new FormGroup({
      serviceTemplate: new FormControl(''),
      serviceName: new FormControl('', [Validators.required]),
      dockerImage: new FormControl('', [Validators.required]),
      hostPort: new FormControl('', [Validators.required, Validators.pattern(/^\d+$/)]),
      containerPort: new FormControl('', [Validators.required, Validators.pattern(/^\d+$/)]),
      environment: new FormControl(''),
      volumes: new FormControl(''),
      healthCheckEnabled: new FormControl(false),
      healthCheckInterval: new FormControl('30s'),
      healthCheckTimeout: new FormControl('10s'),
      healthCheckRetries: new FormControl(3),
      cpuLimit: new FormControl(0),
      memoryLimit: new FormControl(0),
      replicas: new FormControl(1),
      restart: new FormControl('always', [Validators.required]),
      depends_on: new FormControl(''),
    });
  }

  ngOnInit() {
    this.composeForm.get('serviceTemplate')?.valueChanges.subscribe((template) => {
      if (template) {
        const templateConfig = this.getServiceTemplate(template);
        this.composeForm.patchValue(templateConfig, { emitEvent: false });
      }
    });

    this.composeForm.valueChanges.subscribe((values) => {
      this.updateYamlPreview(values);
    });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.readFile(file);
    }
  }

  private readFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.fileContent = e.target.result;
    };
    reader.readAsText(file);
  }

  importFile() {
    if (!this.selectedFile) {
      alert('Please select a file to import.');
      return;
    }

    try {
      const parsedConfig = this.parseYaml(this.fileContent);
      this.populateForm(parsedConfig);
      alert('File imported successfully!');
    } catch (error) {
      alert('Error parsing the file.');
      console.error(error);
    }
  }

  private parseYaml(yamlContent: string): DockerComposeConfig {
    try {
      const parsed = yaml.load(yamlContent) as ParsedYaml;

      if (parsed?.services) {
        const serviceName = Object.keys(parsed.services)[0];
        const service = parsed.services[serviceName];

        return {
          serviceTemplate: '',
          serviceName,
          dockerImage: service.image || '',
          hostPort: service.ports?.[0]?.split(':')[0] || '',
          containerPort: service.ports?.[0]?.split(':')[1] || '',
          environment: service.environment || [],
          volumes: service.volumes || [],
          restart: 'always', // Default value for restart
        };
      }

      throw new Error('Invalid YAML format');
    } catch (error) {
      console.error('Error parsing YAML:', error);
      throw new Error('Invalid YAML format');
    }
  }

  private populateForm(parsedConfig: DockerComposeConfig) {
    this.composeForm.patchValue({
      serviceTemplate: parsedConfig.serviceTemplate,
      serviceName: parsedConfig.serviceName,
      dockerImage: parsedConfig.dockerImage,
      hostPort: parsedConfig.hostPort,
      containerPort: parsedConfig.containerPort,
      environment: parsedConfig.environment.join(', '),
      volumes: parsedConfig.volumes.join(', '),
      healthCheckEnabled: parsedConfig.healthCheck?.enabled || false,
      healthCheckInterval: parsedConfig.healthCheck?.interval || '30s',
      healthCheckTimeout: parsedConfig.healthCheck?.timeout || '10s',
      healthCheckRetries: parsedConfig.healthCheck?.retries || 3,
      cpuLimit: parsedConfig.resources?.cpuLimit || 0,
      memoryLimit: parsedConfig.resources?.memoryLimit || 0,
      replicas: parsedConfig.deploy?.replicas || 1,
      restart: parsedConfig.restart || 'always',
      depends_on: parsedConfig.depends_on?.join(', ') || ''
    });
  }

  generateDockerComposeFile() {
    if (this.composeForm.invalid) {
      alert('Please fill in all required fields correctly');
      return;
    }

    const formValue = this.composeForm.value;
    const config: DockerComposeConfig = {
      serviceTemplate: formValue.serviceTemplate,
      serviceName: formValue.serviceName,
      dockerImage: formValue.dockerImage,
      hostPort: formValue.hostPort,
      containerPort: formValue.containerPort,
      environment: formValue.environment ? formValue.environment.split(',').map((env: string) => env.trim()) : [],
      volumes: formValue.volumes ? formValue.volumes.split(',').map((vol: string) => vol.trim()) : [],
      healthCheck: formValue.healthCheckEnabled ? {
        enabled: true,
        interval: formValue.healthCheckInterval,
        timeout: formValue.healthCheckTimeout,
        retries: formValue.healthCheckRetries,
      } : undefined,
      resources: {
        cpuLimit: formValue.cpuLimit,
        memoryLimit: formValue.memoryLimit,
      },
      deploy: {
        replicas: formValue.replicas,
        resources: {
          limits: {
            cpus: formValue.cpuLimit.toString(),
            memory: `${formValue.memoryLimit}MB`,
          },
        },
      },
      restart: formValue.restart,
      depends_on: formValue.depends_on ? formValue.depends_on.split(',').map((dep: string) => dep.trim()) : undefined,
    };

    this.dockerComposeService.generateAndDownloadFile(config);
    this.resetForm();
  }

  isFormDirty(): boolean {
    return this.composeForm.dirty;
  }

  resetForm() {
    this.composeForm.reset();
    this.yamlPreview = '';
  }

  private updateYamlPreview(values: Partial<DockerComposeConfig>) {
    const {
      serviceTemplate, serviceName, dockerImage, hostPort, containerPort, environment, volumes,
      healthCheck, deploy, restart, depends_on
    } = values;
  
    const envArray = environment
      ? environment.map(env => `      - ${env.trim()}`).join('\n')
      : '';
  
    const volArray = volumes
      ? volumes.map(vol => `      - ${vol.trim()}`).join('\n')
      : '';
  
    const healthCheckYaml = healthCheck?.enabled
      ? `
          healthcheck:
            test: ["CMD", "curl", "-f", "http://localhost:${containerPort || '<container-port>'}"]
            interval: ${healthCheck.interval || '30s'}
            timeout: ${healthCheck.timeout || '10s'}
            retries: ${healthCheck.retries || 3}`
      : '';
  
    const resourcesYaml = deploy?.resources || deploy?.replicas
      ? `
          deploy:
            replicas: ${deploy?.replicas || 1}
            resources:
              limits:
                cpus: '${deploy?.resources?.limits.cpus || '0.5'}'
                memory: ${deploy?.resources?.limits.memory || '512MB'}`
      : '';
  
    const dependsOnYaml = depends_on
      ? `
          depends_on:
            - ${depends_on.join('\n      - ')}`
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
          restart: ${restart || 'always'}
      ${healthCheckYaml}
      ${resourcesYaml}
      ${dependsOnYaml}
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
          volumes: ['./nginx.conf:/etc/nginx/nginx.conf:ro'],
        };
      case 'postgres':
        return {
          serviceName: 'db',
          dockerImage: 'postgres:13',
          hostPort: '5432',
          containerPort: '5432',
          environment: ['POSTGRES_PASSWORD=${DB_PASSWORD:-password}'],
          volumes: ['postgres-data:/var/lib/postgresql/data'],
        };
      case 'redis':
        return {
          serviceName: 'redis',
          dockerImage: 'redis:alpine',
          hostPort: '6379',
          containerPort: '6379',
          volumes: ['redis-data:/data'],
        };
      default:
        return {};
    }
  }
}
