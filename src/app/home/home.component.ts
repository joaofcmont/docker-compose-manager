import { CommonModule, ViewportScroller } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnDestroy {
  private routerSubscription: Subscription;
  isYearly = false;
  isComposeFormPage = false;

  constructor(private router: Router, private viewportScroller: ViewportScroller) {
    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.isComposeFormPage = this.router.url.includes('compose-form');
    });
  }

  onButtonClick(): void {
    this.router.navigate(['/compose-form']);
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
  }
  
  scrollToSection(section: string, event: Event): void {
    event.preventDefault();
    this.viewportScroller.scrollToAnchor(section);
  }

}