import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ContactComponent } from './contact/contact.component';
import { PreloadAllModules } from '@angular/router';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'compose-form',
    loadComponent: () => import('./compose-form/compose-form.component').then(m => m.ComposeFormComponent)
  },
  {
    path: 'editor',
    loadComponent: () => import('./compose-form/compose-form.component').then(m => m.ComposeFormComponent)
  },
  {
    path: 'templates',
    loadComponent: () => import('./templates/templates.component').then(m => m.TemplatesComponent)
  },
  {
    path: 'waitlist',
    loadComponent: () => import('./waitlist/waitlist.component').then(m => m.WaitlistComponent)
  },
  {
    path: 'survey',
    loadComponent: () => import('./survey/survey.component').then(m => m.SurveyComponent)
  },
  { path: 'contact', component: ContactComponent },
  {
    path: 'privacy',
    loadComponent: () => import('./privacy/privacy.component').then(m => m.PrivacyComponent)
  },
  {
    path: 'share/:data',
    loadComponent: () => import('./compose-form/compose-form.component').then(m => m.ComposeFormComponent)
  },
  { path: '', redirectTo: '/home', pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {
    scrollPositionRestoration: 'enabled',
    anchorScrolling: 'enabled',
    useHash: true,
    preloadingStrategy: PreloadAllModules 
  })],
  exports: [RouterModule]
})
export class AppRoutingModule {}