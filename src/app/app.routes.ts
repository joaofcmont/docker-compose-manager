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
  { path: 'contact', component: ContactComponent },
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