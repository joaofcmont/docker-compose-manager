import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DockerComposeService } from '../services/docker-compose.service';
import * as yaml from 'js-yaml';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-compose-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
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

  constructor(private dockerComposeService: DockerComposeService) {}

  ngOnInit() {
    this.setupFormSubscriptions();
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
  }

  // Method to handle file selection
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        try {
          const parsedData = yaml.load(content) as Partial<typeof this.composeForm.value>; // Type assertion here
          this.composeForm.patchValue(parsedData);
          this.yamlPreview = content; // Update YAML preview with the uploaded file content
        } catch (error) {
          alert('Error parsing YAML file');
        }
      };
      reader.readAsText(file);
    }
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
}
