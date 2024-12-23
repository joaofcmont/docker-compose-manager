import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { HomeComponent } from "./home/home.component";
import { FormGroup } from '@angular/forms';
import { Analytics } from "@vercel/analytics/react"


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {

  constructor(private router: Router) {}

  navigateHome() {
    this.router.navigate(['/home']);
  }
}
