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
  environment: string;
  volumes: string;
}

// Define the structure of the parsed YAML
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
  styleUrls: ['./compose-form.component.scss']
})
export class ComposeFormComponent implements OnInit {
  composeForm: FormGroup;
  selectedFile: File | null = null;  // Holds the selected file
  fileContent: string = '';  // Holds the content of the imported file
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

  // Method triggered when a file is selected
  onFileSelected(event: any) {
    const file = event.target.files[0];  // Get the first selected file
    if (file) {
      this.selectedFile = file;
      this.readFile(file);
    }
  }

  // Method to read the content of the file
  private readFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.fileContent = e.target.result;  // Store the content of the file
      console.log('File content:', this.fileContent);  // Log the file content (for debugging)
    };
    reader.readAsText(file);  // Read the file as text
  }

  // Method to process the file content and import it into the form
  importFile() {
    if (!this.selectedFile) {
      alert('Please select a file to import.');
      return;
    }

    // Parse the YAML content and populate the form with parsed data
    try {
      const parsedConfig = this.parseYaml(this.fileContent);
      this.populateForm(parsedConfig);
      alert('File imported successfully!');
    } catch (error) {
      alert('Error parsing the file.');
      console.error(error);
    }
  }

  // Method to parse YAML content and return a structured object
  private parseYaml(yamlContent: string): DockerComposeConfig {
    try {
      const parsed = yaml.load(yamlContent) as ParsedYaml;  // Parse the YAML content

      // Check if the parsed content has the expected structure
      if (parsed && parsed.services) {
        const serviceName = Object.keys(parsed.services)[0];  // Assuming we have at least one service
        const service = parsed.services[serviceName];

        return {
          serviceTemplate: '',  // You can add logic to detect the template if needed
          serviceName: serviceName,
          dockerImage: service.image || '',
          hostPort: service.ports ? service.ports[0].split(':')[0] : '',
          containerPort: service.ports ? service.ports[0].split(':')[1] : '',
          environment: service.environment ? service.environment.join(', ') : '',
          volumes: service.volumes ? service.volumes.join(', ') : ''
        };
      }

      throw new Error('Invalid YAML format');
    } catch (e) {
      console.error('Error parsing YAML:', e);
      throw new Error('Invalid YAML format');
    }
  }

  // Method to populate the form with the parsed data
  private populateForm(parsedConfig: DockerComposeConfig) {
    // Map the parsed configuration to the form controls
    this.composeForm.patchValue({
      serviceTemplate: parsedConfig.serviceTemplate,
      serviceName: parsedConfig.serviceName,
      dockerImage: parsedConfig.dockerImage,
      hostPort: parsedConfig.hostPort,
      containerPort: parsedConfig.containerPort,
      environment: parsedConfig.environment,
      volumes: parsedConfig.volumes
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
