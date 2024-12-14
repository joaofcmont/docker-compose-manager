import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ComposeFormComponent } from './compose-form/compose-form.component';
import { AppComponent } from './app.component';
import { HomeComponent } from './home/home.component';

export const routes: Routes = [
  { path: 'home', component: HomeComponent }, 
  { path: 'compose-form', component: ComposeFormComponent },
  { path: '', redirectTo: '/home', pathMatch: 'full' }, 
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
