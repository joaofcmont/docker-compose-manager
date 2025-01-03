import { CommonModule, ViewportScroller } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { inject } from '@vercel/analytics'; 

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit{

  constructor(private router: Router, private viewportScroller: ViewportScroller) {}

  ngOnInit(): void {
    inject();
  
}
  navigateHome() {
    this.router.navigate(['/home']);
  }

}
