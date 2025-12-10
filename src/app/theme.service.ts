import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private darkMode = false;
  private readonly THEME_KEY = 'dark-theme-preference';

  constructor() {
    // Initialize theme from localStorage or system preference
    const savedTheme = localStorage.getItem(this.THEME_KEY);
    if (savedTheme !== null) {
      this.darkMode = savedTheme === 'true';
    } else {
      // Check system preference
      this.darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    this.applyTheme();
  }

  isDarkMode() {
    return this.darkMode;
  }

  setDarkMode(isDarkMode: boolean) {
    this.darkMode = isDarkMode;
    localStorage.setItem(this.THEME_KEY, String(isDarkMode));
    this.applyTheme();
  }

  toggleTheme() {
    this.setDarkMode(!this.darkMode);
  }

  private applyTheme() {
    if (this.darkMode) {
      document.body.classList.add('dark-theme');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.body.classList.remove('dark-theme');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }
}