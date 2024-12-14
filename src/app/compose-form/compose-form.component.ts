import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
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


  applyForm = new FormGroup({
    firstName: new FormControl(''),
    lastName: new FormControl(''),
    email: new FormControl('')
  });

  constructor(private dockerComposeService: DockerComposeService) {}  

  submitApplication() {
    console.log(this.applyForm.value);
    this.dockerComposeService.submitApplication(
      this.applyForm.value.firstName ?? '',
      this.applyForm.value.lastName ?? '',
      this.applyForm.value.email ?? ''
    );
  }
}
