import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DockerComposeService } from '../services/docker-compose.service';
import { AnalyticsService } from '../services/analytics.service';
import * as yaml from 'js-yaml';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-compose-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './compose-form.component.html',
  styleUrl: './compose-form.component.scss'

})
export class ComposeFormComponent implements OnInit {
  composeForm = new FormGroup({
    serviceTemplate: new FormControl<string>(''),
    serviceName: new FormControl('', [Validators.required, Validators.pattern(/^[a-zA-Z][a-zA-Z0-9_-]*$/)]),
    dockerImage: new FormControl('', [Validators.required]),
    hostPort: new FormControl('', [Validators.required, Validators.pattern(/^\d+$/), Validators.min(1), Validators.max(65535)]),
    containerPort: new FormControl('', [Validators.required, Validators.pattern(/^\d+$/), Validators.min(1), Validators.max(65535)]),
    environment: new FormControl(''),
    volumes: new FormControl(''),
    healthCheck: new FormGroup({
      enabled: new FormControl(false),
      interval: new FormControl('30s'),
      timeout: new FormControl('10s'),
      retries: new FormControl(3)
    }),
    resources: new FormGroup({
      cpuLimit: new FormControl(0.5),
      memoryLimit: new FormControl(512)
    }),
    deploy: new FormGroup({
      replicas: new FormControl(1)
    }),
    restart: new FormControl('always'),
    depends_on: new FormControl('')
  });

  yamlPreview: string = '';

  constructor(
    private dockerComposeService: DockerComposeService,
    private analyticsService: AnalyticsService
  ) {}

  ngOnInit() {
    this.setupFormSubscriptions();
    this.analyticsService.trackEditorUsed();
  }

  private setupFormSubscriptions(): void {
    this.composeForm.get('serviceTemplate')?.valueChanges.subscribe(template => {
      if (template) {
        this.applyServiceTemplate(template);
      }
    });

    this.composeForm.valueChanges.subscribe(() => {
      this.updateYamlPreview();
    });
  }

  private applyServiceTemplate(templateName: string): void {
    const template = this.dockerComposeService.getServiceTemplate(templateName);
    if (!template) return;

    this.composeForm.patchValue({
      serviceName: template.serviceName,
      dockerImage: template.dockerImage,
      hostPort: template.ports[0].host,
      containerPort: template.ports[0].container,
      environment: template.environment?.join('\n') || '',
      volumes: template.volumes?.join('\n') || '',
      healthCheck: {
        enabled: !!template.healthcheck,
        ...template.healthcheck
      }
    }, { emitEvent: false });
  }

  private updateYamlPreview(): void {
    try {
      const config = this.dockerComposeService.generateDockerComposeConfig(this.composeForm.value);
      this.yamlPreview = yaml.dump(config, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        sortKeys: false
      });
    } catch (error) {
      console.error('Error generating YAML preview:', error);
    }
  }

  generateDockerComposeFile(): void {
    if (this.composeForm.invalid) {
      alert('Please fill in all required fields correctly');
      return;
    }

    const config = this.dockerComposeService.generateDockerComposeConfig(this.composeForm.value);
    this.dockerComposeService.generateAndDownloadFile(config);
    this.analyticsService.trackFileGenerated();
  }

  // Method to handle file selection
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.analyticsService.trackFileUploaded();
      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        try {
          const parsedYaml = yaml.load(content) as any;
          this.populateFormFromYaml(parsedYaml);
          // YAML preview will be updated by populateFormFromYaml via updateYamlPreview()
        } catch (error) {
          console.error('Error parsing YAML file:', error);
          alert('Error parsing YAML file. Please ensure it is a valid Docker Compose file.');
        }
      };
      reader.readAsText(file);
    }
  }

  // Method to populate form from parsed YAML
  private populateFormFromYaml(yamlData: any): void {
    if (!yamlData || !yamlData.services) {
      alert('Invalid Docker Compose file. No services found.');
      return;
    }

    // Get the first service (for now, we support single service editing)
    const serviceNames = Object.keys(yamlData.services);
    if (serviceNames.length === 0) {
      alert('No services found in the Docker Compose file.');
      return;
    }

    const serviceName = serviceNames[0];
    const service = yamlData.services[serviceName];

    // Prepare form values
    const formValues: any = {
      serviceName: serviceName,
      dockerImage: service.image || '',
      restart: service.restart || 'always',
    };

    // Parse ports (format: "host:container" or "host:container/protocol" or object format)
    if (service.ports && service.ports.length > 0) {
      const firstPort = service.ports[0];
      if (typeof firstPort === 'string') {
        // Handle format like "8080:80" or "8080:80/tcp"
        const portPart = firstPort.split('/')[0]; // Remove protocol if present
        const [host, container] = portPart.split(':');
        formValues.hostPort = host || '';
        formValues.containerPort = container || '';
      } else if (typeof firstPort === 'object' && firstPort.target) {
        formValues.containerPort = firstPort.target.toString();
        formValues.hostPort = firstPort.published?.toString() || '';
      }
    }

    // Parse environment variables
    if (service.environment) {
      if (Array.isArray(service.environment)) {
        formValues.environment = service.environment.join('\n');
      } else if (typeof service.environment === 'object') {
        formValues.environment = Object.entries(service.environment)
          .map(([key, value]) => `${key}=${value}`)
          .join('\n');
      }
    }

    // Parse volumes
    if (service.volumes && Array.isArray(service.volumes)) {
      formValues.volumes = service.volumes.join('\n');
    }

    // Parse healthcheck
    if (service.healthcheck) {
      formValues.healthCheck = {
        enabled: true,
        interval: service.healthcheck.interval || '30s',
        timeout: service.healthcheck.timeout || '10s',
        retries: service.healthcheck.retries || 3,
      };
    } else {
      formValues.healthCheck = {
        enabled: false,
        interval: '30s',
        timeout: '10s',
        retries: 3,
      };
    }

    // Parse deploy resources
    if (service.deploy) {
      formValues.deploy = {
        replicas: service.deploy.replicas || 1,
      };

      if (service.deploy.resources && service.deploy.resources.limits) {
        const limits = service.deploy.resources.limits;
        formValues.resources = {
          cpuLimit: limits.cpus ? parseFloat(limits.cpus.toString()) : 0.5,
          memoryLimit: this.parseMemoryLimit(limits.memory),
        };
      } else {
        formValues.resources = {
          cpuLimit: 0.5,
          memoryLimit: 512,
        };
      }
    } else {
      formValues.deploy = {
        replicas: 1,
      };
      formValues.resources = {
        cpuLimit: 0.5,
        memoryLimit: 512,
      };
    }

    // Parse depends_on
    if (service.depends_on) {
      if (Array.isArray(service.depends_on)) {
        formValues.depends_on = service.depends_on.join('\n');
      } else if (typeof service.depends_on === 'object') {
        formValues.depends_on = Object.keys(service.depends_on).join('\n');
      }
    }

    // Update form with parsed values (emitEvent: false to prevent immediate YAML update)
    this.composeForm.patchValue(formValues, { emitEvent: false });
    
    // Manually update YAML preview after a short delay to ensure form is updated
    setTimeout(() => {
      this.updateYamlPreview();
    }, 0);
  }

  toggleHealthCheck() {
    const enabled = this.composeForm.get('healthCheck.enabled')?.value;
    this.composeForm.get('healthCheck.enabled')?.setValue(!enabled);
  }

  // Method to reset the form
  resetForm(): void {
    this.composeForm.reset();
    this.yamlPreview = '';  // Clear the YAML preview
  }

  // Helper method to parse memory limit from various formats (e.g., "512M", "1G", "1024MB")
  private parseMemoryLimit(memory: any): number {
    if (!memory) return 512;
    
    const memoryStr = memory.toString().toUpperCase();
    const numericValue = parseFloat(memoryStr.replace(/[^0-9.]/g, ''));
    
    if (memoryStr.includes('G')) {
      return Math.round(numericValue * 1024); // Convert GB to MB
    } else if (memoryStr.includes('K')) {
      return Math.round(numericValue / 1024); // Convert KB to MB
    } else {
      // Assume MB if no unit or if unit is M/MB
      return Math.round(numericValue);
    }
  }
}
