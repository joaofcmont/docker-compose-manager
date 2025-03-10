import { CommonModule, ViewportScroller } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';


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
}
  navigateHome() {
    this.router.navigate(['/home']);
  }

}
