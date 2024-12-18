import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DockerComposeService } from '../services/docker-compose.service';


@Component({
  selector: 'app-compose-form',
  standalone: true,
  imports: [CommonModule,
    ReactiveFormsModule],
  templateUrl: './compose-form.component.html',
  styleUrls: ['./compose-form.component.scss']
})

export class ComposeFormComponent {

  composeForm = new FormGroup({
    serviceName: new FormControl(),
    dockerImage: new FormControl(),
    hostPort: new FormControl(),
    containerPort: new FormControl(),
    environment: new FormControl(''),
    volumes: new FormControl('')
  });

  constructor(private dockerComposeService: DockerComposeService) {}  

  
  submitApplication() {
    if (this.composeForm.valid) {
      console.log(this.composeForm.value);
      this.dockerComposeService.submitApplication(this.composeForm.value);
    }
  }
/*
  submitApplication() {
    if (this.applyForm.valid) {
      const formValues = this.applyForm.value;

      let composeContent = `
version: "3.8"

services:
  ${formValues.serviceName}:
    image: ${formValues.dockerImage}
    ports:
      - "${formValues.hostPort}:${formValues.containerPort}"
`;

      if (formValues.environment) {
        const envVars = formValues.environment.split(',');
        composeContent += `    environment:\n`;
        envVars.forEach(env => {
          composeContent += `      - ${env.trim()}\n`;
        });
      }

      if (formValues.volumes) {
        const volumes = formValues.volumes.split(',');
        composeContent += `    volumes:\n`;
        volumes.forEach(volume => {
          composeContent += `      - ${volume.trim()}\n`;
        });
      }

      // Trigger file download
      const blob = new Blob([composeContent], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'docker-compose.yml';
      a.click();
    }
  }*/
}

