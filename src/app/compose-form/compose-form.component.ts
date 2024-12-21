import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DockerComposeService } from '../services/docker-compose.service';

interface DockerComposeConfig {
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
export class ComposeFormComponent {

  ngOnInit() {
    this.composeForm.valueChanges.subscribe(values => {
      console.log('Form values:', values);
      console.log('Form valid:', this.composeForm.valid);
    });
  }

  composeForm = new FormGroup({
    serviceName: new FormControl('', [Validators.required]),
    dockerImage: new FormControl('', [Validators.required]),
    hostPort: new FormControl('', [Validators.required, Validators.pattern(/^\d+$/)]),
    containerPort: new FormControl('', [Validators.required, Validators.pattern(/^\d+$/)]),
    environment: new FormControl(''),
    volumes: new FormControl('')
  });
  
  constructor(private dockerComposeService: DockerComposeService) {}  

  generateDockerComposeFile() {
  if (this.composeForm.invalid) {
    alert('Please fill in all required fields correctly');
    return;
  }

  const config: DockerComposeConfig = {
    serviceName: this.composeForm.get('serviceName')?.value ?? '',
    dockerImage: this.composeForm.get('dockerImage')?.value ?? '',
    hostPort: this.composeForm.get('hostPort')?.value ?? '',
    containerPort: this.composeForm.get('containerPort')?.value ?? '',
    environment: this.composeForm.get('environment')?.value ?? '',
    volumes: this.composeForm.get('volumes')?.value ?? ''
  };
  
  console.log('Config to be sent:', config);

  this.dockerComposeService.generateAndDownloadFile(config);
  this.resetForm();
}

isFormDirty(): boolean {
  return this.composeForm.dirty;
}
resetForm() {
  this.composeForm.reset();
}

}
