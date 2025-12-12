import { Component, OnInit, AfterViewInit, inject, HostListener } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { DockerComposeService } from '../services/docker-compose.service';
import { AnalyticsService } from '../services/analytics.service';
import { FirestoreService } from '../services/firestore.service';
import { GraphService } from '../services/graph.service';
import { LearningService, LearningTip, ConfigSuggestion } from '../services/learning.service';
import { TemplateService } from '../services/template.service';
import { Template } from '../models/template.model';
import { SEOService } from '../services/seo.service';
import { ServiceConfig } from '../models/service-config.model';
import { ComposeGraph } from '../models/compose-graph.model';
import { Environment, ProjectConfig } from '../models/environment.model';
import { SvgIconComponent } from '../shared/svg-icon.component';
import * as yaml from 'js-yaml';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-compose-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, FormsModule, SvgIconComponent],
  templateUrl: './compose-form.component.html',
  styleUrl: './compose-form.component.scss'

})
export class ComposeFormComponent implements OnInit, AfterViewInit {
  // Inject services using inject() function
  private dockerComposeService = inject(DockerComposeService);
  private analyticsService = inject(AnalyticsService);
  private firestoreService = inject(FirestoreService);
  private graphService = inject(GraphService);
  private learningService = inject(LearningService);
  private templateService = inject(TemplateService);
  private route = inject(ActivatedRoute);
  private seoService = inject(SEOService);

  // Expose Object to template
  Object = Object;

  services: ServiceConfig[] = [];
  selectedServiceIndex: number = 0;
  activeTab: 'form' | 'diagram' | 'yaml' | 'commands' = 'form';
  composeGraph: ComposeGraph = { nodes: [], edges: [] };

  // Environment management
  environments: Environment[] = [];
  currentEnvironment: string = 'base';
  showEnvironmentModal: boolean = false;
  showEnvironmentDiff: boolean = false;
  diffEnvironment1: string = '';
  diffEnvironment2: string = '';
  newEnvironmentName: string = '';
  newEnvironmentProfile: string = '';
  
  // Sharing
  shareableLink: string = '';
  showShareModal: boolean = false;

  composeForm = new FormGroup({
    serviceTemplate: new FormControl<string>(''),
    serviceName: new FormControl('', [
      Validators.required, 
      Validators.pattern(/^[a-zA-Z][a-zA-Z0-9_-]*$/),
      this.serviceNameUniquenessValidator.bind(this)
    ]),
    dockerImage: new FormControl('', [Validators.required]),
    hostPort: new FormControl('', [Validators.required, Validators.pattern(/^\d+$/), Validators.min(1), Validators.max(65535)]),
    containerPort: new FormControl('', [Validators.required, Validators.pattern(/^\d+$/), Validators.min(1), Validators.max(65535)]),
    environment: new FormControl(''),
    volumes: new FormControl(''),
    healthCheck: new FormGroup({
      enabled: new FormControl(false),
      interval: new FormControl('30s'),
      timeout: new FormControl('10s'),
      retries: new FormControl(3),
      startPeriod: new FormControl(''),
      test: new FormControl<string[]>([])
    }),
    resources: new FormGroup({
      cpuLimit: new FormControl(0.5),
      memoryLimit: new FormControl(512)
    }),
    deploy: new FormGroup({
      replicas: new FormControl(1)
    }),
    restart: new FormControl('always'),
    depends_on: new FormControl<string[]>([]),
    networks: new FormControl<string[]>([]),
    labels: new FormControl<{ [key: string]: string }>({}),
    notes: new FormControl('')
  });

  // Get available services for dependencies (excluding current service)
  getAvailableServicesForDependencies(): ServiceConfig[] {
    return this.services.filter((_, index) => index !== this.selectedServiceIndex && this.services[index].serviceName.trim());
  }

  // Get all unique network names from all services
  getAllNetworks(): string[] {
    const networkSet = new Set<string>();
    this.services.forEach(service => {
      if (service.networks && Array.isArray(service.networks)) {
        service.networks.forEach(net => {
          if (net && net.trim()) {
            networkSet.add(net.trim());
          }
        });
      }
    });
    return Array.from(networkSet).sort();
  }

  // Toggle network checkbox
  toggleNetwork(networkName: string): void {
    const currentNetworks = this.composeForm.get('networks')?.value || [];
    const index = currentNetworks.indexOf(networkName);
    
    if (index > -1) {
      // Remove network
      currentNetworks.splice(index, 1);
    } else {
      // Add network
      currentNetworks.push(networkName);
    }
    
    this.composeForm.get('networks')?.setValue([...currentNetworks]);
  }

  // Check if a network is selected
  isNetworkSelected(networkName: string): boolean {
    const networks = this.composeForm.get('networks')?.value || [];
    return networks.includes(networkName);
  }

  // Add new network
  addNewNetwork(): void {
    const networkName = prompt('Enter network name:');
    if (networkName && networkName.trim()) {
      const trimmedName = networkName.trim();
      // Validate network name
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(trimmedName)) {
        alert('Network name must start with alphanumeric character and contain only alphanumeric, underscore, period, or hyphen characters');
        return;
      }
      
      const currentNetworks = this.composeForm.get('networks')?.value || [];
      if (!currentNetworks.includes(trimmedName)) {
        currentNetworks.push(trimmedName);
        this.composeForm.get('networks')?.setValue([...currentNetworks]);
      }
    }
  }

  // Get labels as array of key-value pairs for display
  getLabelsArray(): Array<{ key: string; value: string }> {
    const labels = this.composeForm.get('labels')?.value || {};
    return Object.entries(labels).map(([key, value]) => ({
      key,
      value: value as string
    }));
  }

  // Add new label
  addNewLabel(): void {
    const labels = this.composeForm.get('labels')?.value || {};
    const newLabels = { ...labels, '': '' };
    this.composeForm.get('labels')?.setValue(newLabels);
  }

  // Remove label
  removeLabel(key: string): void {
    const labels = this.composeForm.get('labels')?.value || {};
    const newLabels = { ...labels };
    delete newLabels[key];
    this.composeForm.get('labels')?.setValue(newLabels);
  }

  // Update label key
  updateLabelKey(oldKey: string, newKey: string): void {
    const labels = this.composeForm.get('labels')?.value || {};
    if (oldKey === newKey) return;
    
    // Validate key
    if (newKey && !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(newKey)) {
      alert('Label key must start with alphanumeric character and contain only alphanumeric, underscore, period, or hyphen characters');
      return;
    }

    const newLabels = { ...labels };
    if (oldKey in newLabels) {
      const value = newLabels[oldKey];
      delete newLabels[oldKey];
      if (newKey) {
        newLabels[newKey] = value;
      }
    }
    this.composeForm.get('labels')?.setValue(newLabels);
  }

  // Update label value
  updateLabelValue(key: string, value: string): void {
    const labels = this.composeForm.get('labels')?.value || {};
    const newLabels = { ...labels };
    if (value) {
      newLabels[key] = value;
    } else {
      delete newLabels[key];
    }
    this.composeForm.get('labels')?.setValue(newLabels);
  }

  // Get common label presets
  getCommonLabelPresets(): Array<{ key: string; value: string; description: string }> {
    return [
      { key: 'com.docker.compose.project', value: 'myproject', description: 'Project name' },
      { key: 'com.docker.compose.service', value: this.composeForm.get('serviceName')?.value || 'myservice', description: 'Service name' },
      { key: 'traefik.enable', value: 'true', description: 'Enable Traefik' },
      { key: 'traefik.http.routers.myservice.rule', value: 'Host(`example.com`)', description: 'Traefik router rule' }
    ];
  }

  // Apply label preset
  applyLabelPreset(preset: { key: string; value: string }): void {
    const labels = this.composeForm.get('labels')?.value || {};
    const newLabels = { ...labels, [preset.key]: preset.value };
    this.composeForm.get('labels')?.setValue(newLabels);
  }

  // Check if label key is valid
  isLabelKeyValid(key: string): boolean {
    if (!key) return false;
    return /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(key);
  }

  // Health check test command management
  applyHealthCheckTestPreset(preset: string): void {
    const testControl = this.composeForm.get('healthCheck.test') as FormControl<string[]>;
    
    if (preset === '') {
      // Auto-detect - leave empty, service will handle it
      testControl.setValue([]);
    } else if (preset === 'nginx') {
      testControl.setValue(['CMD-SHELL', 'curl -f http://localhost/ || exit 1']);
    } else if (preset === 'postgres') {
      testControl.setValue(['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER:-postgres} || exit 1']);
    } else if (preset === 'mysql') {
      testControl.setValue(['CMD-SHELL', 'mysqladmin ping -h localhost || exit 1']);
    } else if (preset === 'redis') {
      testControl.setValue(['CMD-SHELL', 'redis-cli ping || exit 1']);
    } else if (preset === 'mongo') {
      testControl.setValue(['CMD-SHELL', 'mongosh --eval "db.adminCommand(\'ping\')" || exit 1']);
    } else if (preset === 'node') {
      testControl.setValue(['CMD-SHELL', 'curl -f http://localhost:${PORT:-3000}/health || exit 1']);
    } else if (preset === 'http') {
      testControl.setValue(['CMD-SHELL', 'curl -f http://localhost:${PORT:-80}/health || exit 1']);
    } else if (preset === 'CMD-SHELL') {
      testControl.setValue(['CMD-SHELL', '']);
    } else if (preset === 'CMD') {
      testControl.setValue(['']);
    } else if (preset === 'NONE') {
      testControl.setValue(['NONE']);
    }
  }

  updateTestCommand(index: number, value: string): void {
    const test = this.composeForm.get('healthCheck.test')?.value || [];
    const newTest = [...test];
    newTest[index] = value;
    this.composeForm.get('healthCheck.test')?.setValue(newTest);
  }

  removeTestCommand(index: number): void {
    const test = this.composeForm.get('healthCheck.test')?.value || [];
    const newTest = test.filter((_: any, i: number) => i !== index);
    this.composeForm.get('healthCheck.test')?.setValue(newTest);
  }

  addTestCommand(): void {
    const testControl = this.composeForm.get('healthCheck.test') as FormControl<string[]>;
    const test = testControl.value || [];
    testControl.setValue([...test, '']);
  }

  getHealthCheckTestArray(): string[] {
    const test = this.composeForm.get('healthCheck.test')?.value;
    return Array.isArray(test) ? test : [];
  }

  // Toggle dependency checkbox
  toggleDependency(serviceName: string): void {
    const currentDeps = this.composeForm.get('depends_on')?.value || [];
    const index = currentDeps.indexOf(serviceName);
    
    if (index > -1) {
      // Remove dependency
      currentDeps.splice(index, 1);
    } else {
      // Add dependency
      currentDeps.push(serviceName);
    }
    
    this.composeForm.get('depends_on')?.setValue([...currentDeps]);
    
    // Check for cycles
    this.checkForCycles();
  }

  // Check if a service is in dependencies
  isServiceInDependencies(serviceName: string): boolean {
    const deps = this.composeForm.get('depends_on')?.value || [];
    return deps.includes(serviceName);
  }

  // Check for circular dependencies
  checkForCycles(): void {
    this.saveCurrentServiceToArray();
    const cycles: string[] = [];
    
    // Simple cycle detection: if A depends on B and B depends on A
    this.services.forEach((service, i) => {
      if (service.depends_on && service.depends_on.length > 0) {
        service.depends_on.forEach(dep => {
          const depIndex = this.services.findIndex(s => s.serviceName === dep);
          if (depIndex >= 0 && this.services[depIndex].depends_on?.includes(service.serviceName)) {
            cycles.push(`${service.serviceName} ↔ ${dep}`);
          }
        });
      }
    });

    if (cycles.length > 0) {
      const uniqueCycles = [...new Set(cycles)];
      console.warn('Circular dependencies detected:', uniqueCycles);
      // Could show a warning to user here
    }
  }

  yamlPreview: string = '';
  isImporting: boolean = false;
  isGenerating: boolean = false;
  hasAdvancedFeatures: boolean = false;
  advancedFeaturesNote: string = '';
  showFeedbackComment: boolean = false;
  feedbackComment: string = '';
  feedbackSubmitted: boolean = false;
  hasSeenMultiServiceHint: boolean = false;
  yamlEditMode: boolean = false;
  yamlEditContent: string = '';
  yamlEditError: string = '';
  isSyncingYaml: boolean = false;
  
  // Learning tool features
  showLearningPanel: boolean = false;
  showSuggestionsPopup: boolean = false;
  configSuggestions: ConfigSuggestion[] = [];
  activeFieldTips: LearningTip[] = [];
  activeFieldName: string = '';

  // Template features
  showSaveTemplateModal: boolean = false;
  showSaveSuccessPopup: boolean = false;
  savedTemplateName: string = '';
  templateName: string = '';
  templateDescription: string = '';
  templateTags: string = '';
  isSavingTemplate: boolean = false;

  // Custom drag and drop state
  isDraggingTemplate: boolean = false;
  draggedTemplateName: string = '';
  dragGhostElement: HTMLElement | null = null;
  dragStartX: number = 0;
  dragStartY: number = 0;
  isOverDiagram: boolean = false;

  // Generation success notification
  showGenerateSuccessPopup: boolean = false;

  // Onboarding
  showOnboardingModal: boolean = false;
  hasSeenOnboarding: boolean = false;

  // Service search/filter
  serviceSearchQuery: string = '';
  
  // Resource calculator
  totalCpu: number = 0;
  totalMemory: number = 0;

  // Undo/Redo functionality
  private historyStack: ServiceConfig[][] = [];
  private historyIndex: number = -1;
  private maxHistorySize: number = 50;
  private isUndoRedoOperation: boolean = false;
  
  // Service reordering
  draggedServiceIndex: number = -1;

  // Form organization
  expandedSections: { basic: boolean; configuration: boolean; healthcheck: boolean; resources: boolean } = {
    basic: true,
    configuration: true,
    healthcheck: false,
    resources: false
  };

  // Wizard mode
  wizardMode: boolean = false;
  wizardStep: number = 1;
  showWizardHelp: boolean = false;
  wizardSteps: string[] = ['basic', 'configuration', 'healthcheck', 'resources', 'review'];
  wizardStepNames: { [key: string]: string } = {
    'basic': 'Basic Configuration',
    'configuration': 'Environment & Volumes',
    'healthcheck': 'Health Check',
    'resources': 'Resources & Deployment',
    'review': 'Review & Generate'
  };
  wizardStepDescriptions: { [key: string]: string } = {
    'basic': 'Start by giving your service a name, choosing a Docker image, and setting up port mappings.',
    'configuration': 'Configure environment variables and volume mounts for your service.',
    'healthcheck': 'Set up health checks to monitor your service\'s status (optional).',
    'resources': 'Configure resource limits, restart policies, dependencies, and networking.',
    'review': 'Review your configuration and generate your Docker Compose file.'
  };
  wizardStepHelp: { [key: string]: { title: string; tips: string[]; examples?: string } } = {
    'basic': {
      title: 'Basic Configuration Tips',
      tips: [
        'Service names should be lowercase and contain only letters, numbers, hyphens, and underscores.',
        'Use official Docker images from Docker Hub (e.g., nginx:latest, postgres:15).',
        'Port mappings connect your host machine to the container (host:container format).',
        'Common ports: 80 (HTTP), 443 (HTTPS), 3306 (MySQL), 5432 (PostgreSQL), 6379 (Redis).'
      ],
      examples: 'Service: web-server, Image: nginx:latest, Ports: 8080:80'
    },
    'configuration': {
      title: 'Environment & Volumes Tips',
      tips: [
        'Environment variables are key-value pairs that configure your application.',
        'Use one variable per line in the format KEY=value.',
        'Volumes map directories from your host to the container.',
        'Use relative paths (./data) or named volumes (my-volume:/app/data).',
        'Environment variables are useful for database credentials, API keys, and configuration.'
      ],
      examples: 'ENV: NODE_ENV=production\nVOLUMES: ./app:/usr/src/app'
    },
    'healthcheck': {
      title: 'Health Check Tips',
      tips: [
        'Health checks help Docker monitor if your service is running correctly.',
        'Interval: How often to check (e.g., 30s, 1m).',
        'Timeout: Maximum time to wait for a response (e.g., 10s).',
        'Retries: Number of failures before marking unhealthy (typically 3).',
        'Start period: Time to wait before starting checks (useful for slow-starting services).',
        'Test command: Leave empty for auto-detection, or specify custom command.'
      ],
      examples: 'Interval: 30s, Timeout: 10s, Retries: 3'
    },
    'resources': {
      title: 'Resources & Deployment Tips',
      tips: [
        'CPU limit: 0.5 = half a core, 1.0 = one full core, 2.5 = two and a half cores.',
        'Memory limit: Specify in MB (e.g., 512 = 512MB, 1024 = 1GB).',
        'Restart policy: "always" restarts on failure, "unless-stopped" keeps running until manually stopped.',
        'Dependencies: Services listed here will start before this service.',
        'Networks: Connect services to custom networks for isolation.',
        'Labels: Add metadata to your services (useful for orchestration tools).'
      ],
      examples: 'CPU: 1.0, Memory: 512MB, Restart: always'
    },
    'review': {
      title: 'Review & Generate',
      tips: [
        'Review all your settings before generating the Docker Compose file.',
        'You can go back to any step to make changes.',
        'The generated file is ready to use with docker-compose up.',
        'Save your configuration as a template for future use.'
      ]
    }
  };

  // Progress tracking
  get formProgress(): number {
    if (this.services.length === 0) return 0;
    const currentService = this.services[this.selectedServiceIndex];
    if (!currentService) return 0;

    let completed = 0;
    let total = 6; // Total required/important fields

    if (currentService.serviceName) completed++;
    if (currentService.dockerImage) completed++;
    if (currentService.hostPort) completed++;
    if (currentService.containerPort) completed++;
    if (currentService.restart) completed++;
    if (currentService.healthCheck?.enabled === false || (currentService.healthCheck?.enabled && currentService.healthCheck?.test && currentService.healthCheck.test.length > 0)) completed++;

    return Math.round((completed / total) * 100);
  }


  ngOnInit() {
    // Check if loading from share URL
    this.route.params.subscribe(params => {
      if (params['data']) {
        try {
          const shareData = JSON.parse(atob(params['data']));
          this.loadFromShareData(shareData);
          // Don't show onboarding when loading from share
          this.hasSeenOnboarding = true;
          return;
        } catch (error) {
          console.error('Error parsing share data:', error);
        }
      }
    });
    
    // Check if user has seen onboarding FIRST (before loading template)
    const seenOnboarding = localStorage.getItem('hasSeenOnboarding');
    this.hasSeenOnboarding = seenOnboarding === 'true';
    
    // Check if we need to load a template from the templates page
    const loadTemplateData = sessionStorage.getItem('loadTemplate');
    if (loadTemplateData) {
      try {
        const templateData = JSON.parse(loadTemplateData);
        this.services = templateData.services;
        if (this.services.length > 0) {
          this.selectedServiceIndex = 0;
          this.loadServiceIntoForm(0);
          this.updateYamlPreview();
          this.updateGraph();
          this.analyzeConfig();
          this.calculateResourceUsage();
          // Initialize history with loaded template
          setTimeout(() => {
            this.saveToHistory();
          }, 100);
          
          // Track analytics
          if (templateData.isStackTemplate) {
            this.analyticsService.trackEvent('stack_template_loaded_in_editor', {
              stack_id: templateData.id,
              service_count: this.services.length
            });
          } else {
            this.analyticsService.trackEvent('template_loaded_in_editor', {
              template_id: templateData.id,
              service_count: this.services.length
            });
          }
        }
        sessionStorage.removeItem('loadTemplate');
        // Don't show onboarding if loading a template (user already knows what they're doing)
        return;
      } catch (error) {
        console.error('Error loading template from session:', error);
        sessionStorage.removeItem('loadTemplate');
      }
    }

    // Show onboarding for first-time users (only if not loading a template)
    if (!this.hasSeenOnboarding) {
      // Use a small delay to ensure the page is fully rendered
      setTimeout(() => {
        this.showOnboardingModal = true;
      }, 300);
    }

    // Initialize with one empty service
    this.addNewService();
    this.setupFormSubscriptions();
    this.updateGraph();
    this.analyticsService.trackEditorUsed();
    
    // Check if user has seen the multi-service hint
    const seenHint = localStorage.getItem('hasSeenMultiServiceHint');
    this.hasSeenMultiServiceHint = seenHint === 'true';
    
    // Analyze config for suggestions
    this.analyzeConfig();
    
    // Initialize resource calculator
    this.calculateResourceUsage();
    
    // Initialize history with initial state (after a small delay to ensure services are set)
    setTimeout(() => {
      this.saveToHistory();
    }, 100);
    
    // Initialize environments (dev, staging, prod)
    this.initializeEnvironments();
    
    // Update SEO for editor page
    this.seoService.updateSEO({
      title: 'Docker Compose Editor - Visual Builder | Docker Compose Manager',
      description: 'Create and edit Docker Compose files visually. Build multi-container applications with our intuitive editor. Export to YAML, JSON, or Docker Run commands.',
      keywords: 'docker compose editor, docker compose builder, visual docker editor, yaml generator, docker compose creator',
      url: 'https://docker-compose-manager-d829b.web.app/editor'
    });
  }

  ngAfterViewInit(): void {
    // Set up native drag handlers for template items after view init
    setTimeout(() => {
      this.setupTemplateDragHandlers();
    }, 100);
  }

  private setupTemplateDragHandlers(): void {
    const templateItems = document.querySelectorAll('.template-item');
    templateItems.forEach((item) => {
      // Ensure draggable is set
      (item as HTMLElement).setAttribute('draggable', 'true');
    });
  }

  closeOnboardingModal(): void {
    this.showOnboardingModal = false;
    this.hasSeenOnboarding = true;
    localStorage.setItem('hasSeenOnboarding', 'true');
  }

  startFromTemplate(): void {
    this.closeOnboardingModal();
    // Expand template selector
    this.expandedSections.basic = true;
    // Focus on template selector
    setTimeout(() => {
      const templateSelect = document.getElementById('serviceTemplate');
      if (templateSelect) {
        templateSelect.focus();
      }
    }, 100);
  }

  startFromScratch(): void {
    this.closeOnboardingModal();
    // Focus on service name
    setTimeout(() => {
      const serviceNameInput = document.getElementById('serviceName');
      if (serviceNameInput) {
        serviceNameInput.focus();
      }
    }, 100);
  }

  toggleSection(section: 'basic' | 'configuration' | 'healthcheck' | 'resources'): void {
    if (this.wizardMode) {
      // In wizard mode, only allow expanding the current step
      return;
    }
    this.expandedSections[section] = !this.expandedSections[section];
  }

  // Wizard mode methods
  toggleWizardMode(): void {
    this.wizardMode = !this.wizardMode;
    if (this.wizardMode) {
      // Initialize wizard: expand only the first step
      this.wizardStep = 1;
      this.expandedSections = {
        basic: true,
        configuration: false,
        healthcheck: false,
        resources: false
      };
      this.saveWizardProgressToStorage();
      this.setupWizardAutoSave();
      this.analyticsService.trackEvent('wizard_mode_enabled', {});
    } else {
      // Exit wizard: expand all sections
      this.expandedSections = {
        basic: true,
        configuration: true,
        healthcheck: true,
        resources: true
      };
      this.clearWizardProgress();
      this.analyticsService.trackEvent('wizard_mode_disabled', {});
    }
  }

  getCurrentWizardStep(): string {
    return this.wizardSteps[this.wizardStep - 1] || 'basic';
  }

  getWizardProgress(): number {
    return Math.round((this.wizardStep / this.wizardSteps.length) * 100);
  }

  canGoToNextStep(): boolean {
    const currentStep = this.getCurrentWizardStep();
    
    // Validate current step before allowing next
    if (currentStep === 'basic') {
      const serviceName = this.composeForm.get('serviceName');
      const dockerImage = this.composeForm.get('dockerImage');
      const hostPort = this.composeForm.get('hostPort');
      const containerPort = this.composeForm.get('containerPort');
      
      return !!(serviceName?.valid && dockerImage?.valid && hostPort?.valid && containerPort?.valid);
    }
    
    if (currentStep === 'healthcheck') {
      const healthCheck = this.composeForm.get('healthCheck');
      if (healthCheck?.get('enabled')?.value) {
        const interval = healthCheck.get('interval');
        const timeout = healthCheck.get('timeout');
        const retries = healthCheck.get('retries');
        return !!(interval?.valid && timeout?.valid && retries?.valid);
      }
      return true; // Health check is optional
    }
    
    // Other steps don't have required fields
    return true;
  }

  getWizardStepValidationErrors(): string[] {
    const errors: string[] = [];
    const currentStep = this.getCurrentWizardStep();
    
    if (currentStep === 'basic') {
      if (this.composeForm.get('serviceName')?.invalid) {
        errors.push('Service name is required and must be valid');
      }
      if (this.composeForm.get('dockerImage')?.invalid) {
        errors.push('Docker image is required');
      }
      if (this.composeForm.get('hostPort')?.invalid) {
        errors.push('Host port is required and must be between 1 and 65535');
      }
      if (this.composeForm.get('containerPort')?.invalid) {
        errors.push('Container port is required and must be between 1 and 65535');
      }
    }
    
    if (currentStep === 'healthcheck') {
      const healthCheck = this.composeForm.get('healthCheck');
      if (healthCheck?.get('enabled')?.value) {
        if (healthCheck.get('interval')?.invalid) {
          errors.push('Health check interval is required (e.g., 30s, 1m)');
        }
        if (healthCheck.get('timeout')?.invalid) {
          errors.push('Health check timeout is required (e.g., 10s, 5m)');
        }
        if (healthCheck.get('retries')?.invalid) {
          errors.push('Health check retries must be a number');
        }
      }
    }
    
    return errors;
  }

  getFieldError(fieldPath: string): string {
    const control = this.composeForm.get(fieldPath);
    if (!control || !control.errors) return '';
    
    // Check if control is touched or if it's a nested control, check parent
    const isTouched = control.touched || (fieldPath.includes('.') && this.composeForm.touched);
    if (!isTouched) return '';
    
    if (control.errors['required']) {
      return 'This field is required';
    }
    if (control.errors['portRange']) {
      return control.errors['portRange'].message || 'Port must be between 1 and 65535';
    }
    if (control.errors['cpuFormat']) {
      return control.errors['cpuFormat'].message || 'Invalid CPU format';
    }
    if (control.errors['memoryFormat']) {
      return control.errors['memoryFormat'].message || 'Invalid memory format';
    }
    if (control.errors['pattern']) {
      if (fieldPath.includes('Port')) {
        return 'Port must be a number';
      }
      return 'Invalid format';
    }
    if (control.errors['min']) {
      return `Value must be at least ${control.errors['min'].min}`;
    }
    if (control.errors['max']) {
      return `Value must be at most ${control.errors['max'].max}`;
    }
    
    return 'Invalid value';
  }

  nextWizardStep(): void {
    if (!this.canGoToNextStep()) {
      // Mark fields as touched to show validation errors
      this.markCurrentStepFieldsAsTouched();
      return;
    }

    if (this.wizardStep < this.wizardSteps.length) {
      // Collapse current step
      const currentStep = this.getCurrentWizardStep();
      if (currentStep !== 'review') {
        this.expandedSections[currentStep as keyof typeof this.expandedSections] = false;
      }

      // Move to next step
      this.wizardStep++;
      const nextStep = this.getCurrentWizardStep();
      
      // Save progress
      this.saveWizardProgressToStorage();
      
      // Expand next step
      if (nextStep !== 'review') {
        this.expandedSections[nextStep as keyof typeof this.expandedSections] = true;
        
        // Scroll to the next section - wait for Angular to update the DOM
        setTimeout(() => {
          // Find section by step index (most reliable method)
          const allSections = Array.from(document.querySelectorAll('.form-section'));
          const stepIndex = this.wizardSteps.indexOf(nextStep);
          
          if (stepIndex >= 0 && stepIndex < allSections.length) {
            const section = allSections[stepIndex];
            if (section) {
              // Add some offset to account for fixed headers
              const yOffset = -80;
              const y = section.getBoundingClientRect().top + window.pageYOffset + yOffset;
              window.scrollTo({ top: y, behavior: 'smooth' });
            }
          }
        }, 200);
      }
      
      this.analyticsService.trackEvent('wizard_step_next', { step: this.wizardStep });
    }
  }

  previousWizardStep(): void {
    if (this.wizardStep > 1) {
      // Collapse current step
      const currentStep = this.getCurrentWizardStep();
      if (currentStep !== 'review') {
        this.expandedSections[currentStep as keyof typeof this.expandedSections] = false;
      }

      // Move to previous step
      this.wizardStep--;
      const prevStep = this.getCurrentWizardStep();
      
      // Expand previous step
      this.expandedSections[prevStep as keyof typeof this.expandedSections] = true;
      
      // Save progress
      this.saveWizardProgressToStorage();
      
      // Scroll to the previous section - wait for Angular to update the DOM
      setTimeout(() => {
        // Find section by step index (most reliable method)
        const allSections = Array.from(document.querySelectorAll('.form-section'));
        const stepIndex = this.wizardSteps.indexOf(prevStep);
        
        if (stepIndex >= 0 && stepIndex < allSections.length) {
          const section = allSections[stepIndex];
          if (section) {
            // Add some offset to account for fixed headers
            const yOffset = -80;
            const y = section.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
          }
        }
      }, 200);
      
      this.analyticsService.trackEvent('wizard_step_previous', { step: this.wizardStep });
    }
  }

  skipWizardStep(): void {
    if (this.wizardStep < this.wizardSteps.length) {
      const currentStep = this.getCurrentWizardStep();
      this.expandedSections[currentStep as keyof typeof this.expandedSections] = false;
      this.wizardStep++;
      const nextStep = this.getCurrentWizardStep();
      if (nextStep !== 'review') {
        this.expandedSections[nextStep as keyof typeof this.expandedSections] = true;
      }
      this.analyticsService.trackEvent('wizard_step_skipped', { step: this.wizardStep - 1 });
    }
  }

  goToWizardStep(stepNumber: number): void {
    if (stepNumber >= 1 && stepNumber <= this.wizardSteps.length) {
      // Collapse all steps
      Object.keys(this.expandedSections).forEach(key => {
        this.expandedSections[key as keyof typeof this.expandedSections] = false;
      });
      
      this.wizardStep = stepNumber;
      const step = this.getCurrentWizardStep();
      
      // Expand target step
      if (step !== 'review') {
        this.expandedSections[step as keyof typeof this.expandedSections] = true;
      }
      
      // Scroll to the target section - wait for Angular to update the DOM
      setTimeout(() => {
        if (step === 'review') {
          const reviewSection = document.querySelector('.wizard-review-step');
          if (reviewSection) {
            const yOffset = -80;
            const y = reviewSection.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
          }
        } else {
          // Find section by step index (most reliable method)
          const allSections = Array.from(document.querySelectorAll('.form-section'));
          const stepIndex = this.wizardSteps.indexOf(step);
          
          if (stepIndex >= 0 && stepIndex < allSections.length) {
            const section = allSections[stepIndex];
            if (section) {
              // Add some offset to account for fixed headers
              const yOffset = -80;
              const y = section.getBoundingClientRect().top + window.pageYOffset + yOffset;
              window.scrollTo({ top: y, behavior: 'smooth' });
            }
          }
        }
      }, 200);
    }
  }

  private markCurrentStepFieldsAsTouched(): void {
    const currentStep = this.getCurrentWizardStep();
    
    if (currentStep === 'basic') {
      this.composeForm.get('serviceName')?.markAsTouched();
      this.composeForm.get('dockerImage')?.markAsTouched();
      this.composeForm.get('hostPort')?.markAsTouched();
      this.composeForm.get('containerPort')?.markAsTouched();
    } else if (currentStep === 'healthcheck') {
      const healthCheck = this.composeForm.get('healthCheck');
      if (healthCheck?.get('enabled')?.value) {
        healthCheck.get('interval')?.markAsTouched();
        healthCheck.get('timeout')?.markAsTouched();
        healthCheck.get('retries')?.markAsTouched();
      }
    }
  }

  // Auto-save wizard progress
  saveWizardProgressToStorage(): void {
    if (!this.wizardMode) return;
    
    try {
      const progress = {
        wizardStep: this.wizardStep,
        services: this.services,
        selectedServiceIndex: this.selectedServiceIndex,
        formData: this.composeForm.value,
        timestamp: Date.now()
      };
      localStorage.setItem('wizardProgress', JSON.stringify(progress));
    } catch (error) {
      console.error('Error saving wizard progress:', error);
    }
  }

  restoreWizardProgress(): void {
    try {
      const savedProgress = localStorage.getItem('wizardProgress');
      if (savedProgress) {
        const progress = JSON.parse(savedProgress);
        // Only restore if progress is less than 24 hours old
        const hoursSinceSave = (Date.now() - progress.timestamp) / (1000 * 60 * 60);
        if (hoursSinceSave < 24 && progress.services && progress.services.length > 0) {
          // Show restore notification first
          const shouldRestore = confirm('We found your previous wizard progress. Would you like to continue where you left off?');
          if (shouldRestore) {
            this.services = progress.services;
            this.selectedServiceIndex = progress.selectedServiceIndex || 0;
            this.wizardStep = progress.wizardStep || 1;
            this.wizardMode = true;
            
            // Restore expanded sections based on current step
            const currentStep = this.getCurrentWizardStep();
            this.expandedSections = {
              basic: currentStep === 'basic',
              configuration: currentStep === 'configuration',
              healthcheck: currentStep === 'healthcheck',
              resources: currentStep === 'resources'
            };
            
            if (this.services.length > 0 && this.selectedServiceIndex < this.services.length) {
              this.loadServiceIntoForm(this.selectedServiceIndex);
              this.updateYamlPreview();
              this.updateGraph();
              this.analyzeConfig();
            }
          } else {
            // User chose not to restore, clear the saved progress
            this.clearWizardProgress();
          }
        } else {
          // Progress is too old, clear it
          this.clearWizardProgress();
        }
      }
    } catch (error) {
      console.error('Error restoring wizard progress:', error);
      this.clearWizardProgress();
    }
  }

  clearWizardProgress(): void {
    localStorage.removeItem('wizardProgress');
  }

  setupWizardAutoSave(): void {
    // Auto-save every 30 seconds when in wizard mode
    if (this.wizardMode) {
      setInterval(() => {
        if (this.wizardMode) {
          this.saveWizardProgressToStorage();
        }
      }, 30000);
    }
  }

  isWizardStepActive(stepName: string): boolean {
    return this.getCurrentWizardStep() === stepName;
  }

  isWizardStepCompleted(stepName: string): boolean {
    const stepIndex = this.wizardSteps.indexOf(stepName);
    return stepIndex >= 0 && stepIndex < this.wizardStep - 1;
  }

  applyExample(field: string, example: string): void {
    const control = this.composeForm.get(field);
    if (control) {
      control.setValue(example);
      control.markAsTouched();
    }
  }

  dismissMultiServiceHint(): void {
    this.hasSeenMultiServiceHint = true;
    localStorage.setItem('hasSeenMultiServiceHint', 'true');
  }

  // Learning tool methods
  getFieldTips(fieldName: string): LearningTip[] {
    return this.learningService.getFieldTips(fieldName);
  }

  showTipsForField(fieldName: string): void {
    this.activeFieldName = fieldName;
    this.activeFieldTips = this.getFieldTips(fieldName);
    if (this.activeFieldTips.length > 0) {
      this.showLearningPanel = true;
    }
  }

  analyzeConfig(): void {
    this.configSuggestions = this.learningService.analyzeConfig(this.services);
  }

  getConfigSuggestions(): ConfigSuggestion[] {
    return this.configSuggestions;
  }

  getQuickReferences() {
    return this.learningService.getQuickReferences();
  }

  getBestPractices() {
    return this.learningService.getBestPractices();
  }

  toggleLearningPanel(): void {
    this.showLearningPanel = !this.showLearningPanel;
    if (!this.showLearningPanel) {
      this.activeFieldTips = [];
      this.activeFieldName = '';
    }
  }

  openLearningCenter(): void {
    this.showLearningPanel = true;
    this.activeFieldTips = [];
    this.activeFieldName = '';
  }

  openSuggestionsPopup(): void {
    this.showSuggestionsPopup = true;
  }

  closeSuggestionsPopup(): void {
    this.showSuggestionsPopup = false;
  }

  // YAML Edit Mode
  enableYamlEditMode(): void {
    this.yamlEditMode = true;
    this.yamlEditContent = this.yamlPreview || '';
    this.yamlEditError = '';
  }

  onYamlEdit(): void {
    // Clear error when user starts editing
    this.yamlEditError = '';
  }

  syncYamlToForm(): void {
    if (!this.yamlEditContent || !this.yamlEditContent.trim()) {
      this.yamlEditError = 'YAML content is empty';
      return;
    }

    this.isSyncingYaml = true;
    this.yamlEditError = '';

    try {
      const parsedYaml = yaml.load(this.yamlEditContent) as any;
      
      if (!parsedYaml || typeof parsedYaml !== 'object') {
        throw new Error('Invalid YAML structure');
      }

      // Populate form from parsed YAML
      this.populateFormFromYaml(parsedYaml);
      
      // Update preview with formatted YAML
      this.updateYamlPreview();
      this.yamlEditContent = this.yamlPreview;
      
      // Switch back to preview mode
      this.yamlEditMode = false;
      
      this.analyticsService.trackEvent('yaml_synced', {
        service_count: this.services.length
      });
    } catch (error: any) {
      this.yamlEditError = error.message || 'Failed to parse YAML. Please check the syntax.';
      console.error('YAML sync error:', error);
    } finally {
      this.isSyncingYaml = false;
    }
  }

  // Initialize a new service with default values
  private createDefaultService(): ServiceConfig {
    return {
      serviceName: '',
      dockerImage: '',
      hostPort: '',
      containerPort: '',
      environment: '',
      volumes: '',
      healthCheck: {
        enabled: false,
        interval: '30s',
        timeout: '10s',
        retries: 3
      },
      resources: {
        cpuLimit: 0.5,
        memoryLimit: 512
      },
      deploy: {
        replicas: 1
      },
      restart: 'always',
      depends_on: [],
      networks: [],
      labels: {},
      notes: ''
    };
  }

  // Add a new service to the services array
  addNewService(): void {
    this.saveCurrentServiceToArray(); // Save current service before adding new
    this.saveToHistory(); // Save state before adding
    const newService = this.createDefaultService();
    newService.serviceName = `service-${this.services.length + 1}`;
    this.services.push(newService);
    this.selectedServiceIndex = this.services.length - 1;
    this.loadServiceIntoForm(this.selectedServiceIndex);
    this.updateGraph();
    this.analyzeConfig();
    this.calculateResourceUsage();
  }

  // Duplicate the currently selected service
  duplicateService(): void {
    if (this.selectedServiceIndex < 0 || this.selectedServiceIndex >= this.services.length) {
      return;
    }
    this.saveCurrentServiceToArray(); // Save current service before duplicating
    const serviceToDuplicate = JSON.parse(JSON.stringify(this.services[this.selectedServiceIndex]));
    serviceToDuplicate.serviceName = `${serviceToDuplicate.serviceName}-copy`;
    this.services.push(serviceToDuplicate);
    this.selectedServiceIndex = this.services.length - 1;
    this.loadServiceIntoForm(this.selectedServiceIndex);
    this.updateGraph();
    this.analyzeConfig();
  }

  // Delete a service
  deleteService(index: number): void {
    this.saveCurrentServiceToArray(); // Save current service before deleting
    this.saveToHistory(); // Save state before deleting
    if (this.services.length <= 1) {
      alert('You must have at least one service');
      return;
    }
    this.services.splice(index, 1);
    // Adjust selected index if needed
    if (this.selectedServiceIndex >= this.services.length) {
      this.selectedServiceIndex = this.services.length - 1;
    }
    if (this.selectedServiceIndex < 0) {
      this.selectedServiceIndex = 0;
    }
    this.loadServiceIntoForm(this.selectedServiceIndex);
    this.updateYamlPreview();
    this.updateGraph();
    this.analyzeConfig();
    this.calculateResourceUsage();
  }

  // Select a service to edit
  selectService(index: number): void {
    // Save current form data to the selected service
    this.saveCurrentServiceToArray();
    this.selectedServiceIndex = index;
    this.loadServiceIntoForm(index);
    this.updateGraph();
  }

  // Load service data into the form
  private loadServiceIntoForm(index: number): void {
    if (index < 0 || index >= this.services.length) {
      return;
    }
    const service = this.services[index];
    this.composeForm.patchValue({
      serviceName: service.serviceName,
      dockerImage: service.dockerImage,
      hostPort: service.hostPort,
      containerPort: service.containerPort,
      environment: service.environment,
      volumes: service.volumes,
      healthCheck: service.healthCheck,
      resources: service.resources,
      deploy: service.deploy,
      restart: service.restart,
      depends_on: service.depends_on || [],
      networks: service.networks || [],
      labels: service.labels || {},
      notes: service.notes || ''
    }, { emitEvent: false });
    this.updateYamlPreview();
    this.updateGraph();
  }

  // Save current form data to the services array
  // Save state to history (for undo/redo)
  private saveToHistory(): void {
    if (this.isUndoRedoOperation) {
      return; // Don't save history during undo/redo operations
    }

    // Deep clone current services state
    const currentState = JSON.parse(JSON.stringify(this.services));
    
    // Remove any future history if we're not at the end
    if (this.historyIndex < this.historyStack.length - 1) {
      this.historyStack = this.historyStack.slice(0, this.historyIndex + 1);
    }
    
    // Add new state to history
    this.historyStack.push(currentState);
    this.historyIndex++;
    
    // Limit history size
    if (this.historyStack.length > this.maxHistorySize) {
      this.historyStack.shift();
      this.historyIndex--;
    }
  }

  // Undo last change
  undo(): void {
    if (this.historyIndex > 0) {
      this.isUndoRedoOperation = true;
      this.historyIndex--;
      const previousState = JSON.parse(JSON.stringify(this.historyStack[this.historyIndex]));
      this.services = previousState;
      
      // Update UI
      if (this.selectedServiceIndex >= this.services.length) {
        this.selectedServiceIndex = Math.max(0, this.services.length - 1);
      }
      if (this.services.length > 0) {
        this.loadServiceIntoForm(this.selectedServiceIndex);
      }
      this.updateYamlPreview();
      this.updateGraph();
      this.analyzeConfig();
      this.calculateResourceUsage();
      
      this.isUndoRedoOperation = false;
      this.analyticsService.trackEvent('undo_action', {});
    }
  }

  // Redo last undone change
  redo(): void {
    if (this.historyIndex < this.historyStack.length - 1) {
      this.isUndoRedoOperation = true;
      this.historyIndex++;
      const nextState = JSON.parse(JSON.stringify(this.historyStack[this.historyIndex]));
      this.services = nextState;
      
      // Update UI
      if (this.selectedServiceIndex >= this.services.length) {
        this.selectedServiceIndex = Math.max(0, this.services.length - 1);
      }
      if (this.services.length > 0) {
        this.loadServiceIntoForm(this.selectedServiceIndex);
      }
      this.updateYamlPreview();
      this.updateGraph();
      this.analyzeConfig();
      this.calculateResourceUsage();
      
      this.isUndoRedoOperation = false;
      this.analyticsService.trackEvent('redo_action', {});
    }
  }

  // Check if undo is available
  canUndo(): boolean {
    return this.historyIndex > 0;
  }

  // Check if redo is available
  canRedo(): boolean {
    return this.historyIndex < this.historyStack.length - 1;
  }

  // Service reordering with drag and drop
  onServiceDragStart(event: DragEvent, index: number): void {
    this.draggedServiceIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', index.toString());
    }
  }

  onServiceDragOver(event: DragEvent, index: number): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onServiceDrop(event: DragEvent, targetIndex: number): void {
    event.preventDefault();
    
    if (this.draggedServiceIndex === -1 || this.draggedServiceIndex === targetIndex) {
      this.draggedServiceIndex = -1;
      return;
    }

    this.saveCurrentServiceToArray();
    this.saveToHistory(); // Save state before reordering

    // Move service to new position
    const serviceToMove = this.services[this.draggedServiceIndex];
    this.services.splice(this.draggedServiceIndex, 1);
    this.services.splice(targetIndex, 0, serviceToMove);

    // Update selected index
    if (this.selectedServiceIndex === this.draggedServiceIndex) {
      this.selectedServiceIndex = targetIndex;
    } else if (this.selectedServiceIndex === targetIndex) {
      this.selectedServiceIndex = this.draggedServiceIndex;
    } else if (this.draggedServiceIndex < this.selectedServiceIndex && targetIndex >= this.selectedServiceIndex) {
      this.selectedServiceIndex--;
    } else if (this.draggedServiceIndex > this.selectedServiceIndex && targetIndex <= this.selectedServiceIndex) {
      this.selectedServiceIndex++;
    }

    this.draggedServiceIndex = -1;
    this.updateGraph();
    this.updateYamlPreview();
    this.analyticsService.trackEvent('service_reordered', {});
  }

  onServiceDragEnd(): void {
    this.draggedServiceIndex = -1;
  }

  private saveCurrentServiceToArray(): void {
    if (this.selectedServiceIndex < 0 || this.selectedServiceIndex >= this.services.length) {
      return;
    }
    const formValue = this.composeForm.value;
    this.services[this.selectedServiceIndex] = {
      serviceName: formValue.serviceName || '',
      dockerImage: formValue.dockerImage || '',
      hostPort: formValue.hostPort || '',
      containerPort: formValue.containerPort || '',
      environment: formValue.environment || '',
      volumes: formValue.volumes || '',
      healthCheck: {
        enabled: formValue.healthCheck?.enabled || false,
        interval: formValue.healthCheck?.interval || '30s',
        timeout: formValue.healthCheck?.timeout || '10s',
        retries: formValue.healthCheck?.retries || 3
      },
      resources: {
        cpuLimit: formValue.resources?.cpuLimit || 0.5,
        memoryLimit: formValue.resources?.memoryLimit || 512
      },
      deploy: {
        replicas: formValue.deploy?.replicas || 1
      },
      restart: formValue.restart || 'always',
      depends_on: Array.isArray(formValue.depends_on) ? formValue.depends_on : [],
      networks: Array.isArray(formValue.networks) ? formValue.networks : [],
      labels: formValue.labels && typeof formValue.labels === 'object' ? formValue.labels : {},
      notes: formValue.notes || ''
    };
  }

  private setupFormSubscriptions(): void {
    this.composeForm.get('serviceTemplate')?.valueChanges.subscribe(template => {
      if (template) {
        this.applyServiceTemplate(template);
      }
    });

      this.composeForm.valueChanges.subscribe(() => {
        // Save current service when form changes
        this.saveCurrentServiceToArray();
        
        // Save environment override if not in base environment
        if (this.currentEnvironment !== 'base' && this.selectedServiceIndex >= 0 && this.selectedServiceIndex < this.services.length) {
          const service = this.services[this.selectedServiceIndex];
          if (service && service.serviceName) {
            this.saveEnvironmentOverride(service.serviceName);
          }
        }
        
        this.updateYamlPreview();
        // Only update graph if we're on the diagram tab to avoid unnecessary re-renders
        if (this.activeTab === 'diagram') {
          this.updateGraph();
        }
        // Analyze config for suggestions
        this.analyzeConfig();
        // Update resource calculator
        this.calculateResourceUsage();
        // Auto-save wizard progress when form changes
        if (this.wizardMode) {
          this.saveWizardProgressToStorage();
        }
      });
  }

  // Update graph from services
  updateGraph(): void {
    // Preserve existing node positions when updating
    const existingPositions = new Map<string, { x: number; y: number }>();
    this.composeGraph.nodes.forEach(node => {
      if (node.position) {
        existingPositions.set(node.id, node.position);
      }
    });

    // Create new graph
    const newGraph = this.graphService.composeToGraph(this.services);

    // Restore positions for existing nodes, calculate new ones for new nodes
    newGraph.nodes.forEach(node => {
      if (existingPositions.has(node.id)) {
        node.position = existingPositions.get(node.id)!;
      } else if (!node.position) {
        // Calculate position for new node
        const index = newGraph.nodes.indexOf(node);
        node.position = this.graphService.calculateNodePosition(index, newGraph.nodes.length);
      }
    });

    // Update graph reference
    this.composeGraph = newGraph;
  }

  // Switch tabs
  setActiveTab(tab: 'form' | 'diagram' | 'yaml' | 'commands'): void {
    // Save current service before switching
    if (this.activeTab === 'form') {
      this.saveCurrentServiceToArray();
    }
    this.activeTab = tab;
    if (tab === 'diagram') {
      // Use setTimeout to ensure DOM is ready
      setTimeout(() => {
        this.updateGraph();
      }, 0);
    }
  }

  // Handle node click in diagram
  onNodeClick(serviceName: string): void {
    const index = this.services.findIndex(s => s.serviceName === serviceName);
    if (index >= 0) {
      this.selectService(index);
      this.setActiveTab('form');
    }
  }

  // Get node position for rendering (returns center of node)
  getNodePosition(serviceName: string): { x: number; y: number } | null {
    const node = this.composeGraph.nodes.find(n => n.id === serviceName);
    if (!node?.position) return null;
    // Return center of node (node is 120x80, so center is at x+60, y+40)
    return {
      x: node.position.x + 60,
      y: node.position.y + 40
    };
  }

  // Track by functions for better performance
  trackByNode(index: number, node: any): string {
    return node.id;
  }

  trackByEdge(index: number, edge: any): string {
    return `${edge.from}-${edge.to}`;
  }

  // Custom drag and drop handlers using mouse events
  onTemplateMouseDown(event: MouseEvent, templateName: string): void {
    // Only start drag on left mouse button
    if (event.button !== 0) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    this.isDraggingTemplate = true;
    this.draggedTemplateName = templateName;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    
    // Create drag ghost element
    this.createDragGhost(event, templateName);
    
    // Add global event listeners
    document.addEventListener('mousemove', this.onTemplateMouseMove);
    document.addEventListener('mouseup', this.onTemplateMouseUp);
    
    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
  }

  onTemplateMouseMove = (event: MouseEvent): void => {
    if (!this.isDraggingTemplate) return;
    
    // Update ghost position
    if (this.dragGhostElement) {
      this.dragGhostElement.style.left = (event.clientX + 10) + 'px';
      this.dragGhostElement.style.top = (event.clientY + 10) + 'px';
    }
    
    // Check if over diagram area
    const diagramView = document.querySelector('.diagram-view') as HTMLElement;
    if (diagramView) {
      const rect = diagramView.getBoundingClientRect();
      const isOver = event.clientX >= rect.left && 
                     event.clientX <= rect.right && 
                     event.clientY >= rect.top && 
                     event.clientY <= rect.bottom;
      
      if (isOver !== this.isOverDiagram) {
        this.isOverDiagram = isOver;
        if (isOver) {
          diagramView.classList.add('drag-over');
        } else {
          diagramView.classList.remove('drag-over');
        }
      }
    }
  }

  onTemplateMouseUp = (event: MouseEvent): void => {
    if (!this.isDraggingTemplate) return;
    
    // Check if dropped over diagram
    if (this.isOverDiagram && this.draggedTemplateName) {
      const diagramView = document.querySelector('.diagram-view') as HTMLElement;
      if (diagramView) {
        // Create a fake DragEvent for compatibility with existing createServiceFromTemplate
        const fakeEvent = {
          clientX: event.clientX,
          clientY: event.clientY,
          target: diagramView,
          currentTarget: diagramView
        } as any;
        
        this.createServiceFromTemplate(this.draggedTemplateName, fakeEvent);
      }
    }
    
    // Clean up
    this.cleanupDrag();
  }

  private createDragGhost(event: MouseEvent, templateName: string): void {
    const template = this.getAvailableTemplates().find(t => t.name === templateName);
    if (!template) return;
    
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.style.position = 'fixed';
    ghost.style.left = (event.clientX + 10) + 'px';
    ghost.style.top = (event.clientY + 10) + 'px';
    ghost.style.padding = '8px 12px';
    ghost.style.background = '#fff';
    ghost.style.border = '2px solid #007BFF';
    ghost.style.borderRadius = '6px';
    ghost.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '10000';
    ghost.style.display = 'flex';
    ghost.style.alignItems = 'center';
    ghost.style.gap = '8px';
    ghost.style.fontSize = '14px';
    ghost.style.whiteSpace = 'nowrap';
    ghost.style.opacity = '0.9';
    
    // Add icon (simplified - you might want to use your SVG icon component)
    const icon = document.createElement('span');
    icon.textContent = '📦';
    ghost.appendChild(icon);
    
    const text = document.createElement('span');
    text.textContent = template.displayName;
    ghost.appendChild(text);
    
    document.body.appendChild(ghost);
    this.dragGhostElement = ghost;
  }

  private cleanupDrag(): void {
    this.isDraggingTemplate = false;
    this.isOverDiagram = false;
    this.draggedTemplateName = '';
    
    // Remove event listeners
    document.removeEventListener('mousemove', this.onTemplateMouseMove);
    document.removeEventListener('mouseup', this.onTemplateMouseUp);
    
    // Remove ghost element
    if (this.dragGhostElement && this.dragGhostElement.parentNode) {
      this.dragGhostElement.parentNode.removeChild(this.dragGhostElement);
      this.dragGhostElement = null;
    }
    
    // Restore body styles
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    
    // Remove drag-over styling
    const diagramView = document.querySelector('.diagram-view') as HTMLElement;
    if (diagramView) {
      diagramView.classList.remove('drag-over');
    }
  }

  onDiagramDragOver(event: DragEvent): void {
    // Keep for compatibility, but not used with custom drag
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  onDiagramDragEnter(event: DragEvent): void {
    // Keep for compatibility, but not used with custom drag
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  onDiagramDragLeave(event: DragEvent): void {
    // Keep for compatibility, but not used with custom drag
    event.preventDefault();
  }

  onDiagramDrop(event: DragEvent): void {
    // Keep for compatibility, but not used with custom drag
    event.preventDefault();
  }

  // Create service from template at drop position
  private createServiceFromTemplate(templateName: string, event: DragEvent | MouseEvent | any): void {
    const template = this.dockerComposeService.getServiceTemplate(templateName);
    if (!template) {
      return;
    }

    // Get drop coordinates relative to diagram view container or SVG
    let diagramView = (event.target as HTMLElement)?.closest('.diagram-view') as HTMLElement;
    if (!diagramView) {
      // Try to find it from the SVG element
      const svgElement = (event.target as Element)?.closest('svg');
      if (svgElement) {
        diagramView = svgElement.closest('.diagram-view') as HTMLElement;
      }
    }
    // If still not found, try to get it directly
    if (!diagramView) {
      diagramView = document.querySelector('.diagram-view') as HTMLElement;
    }
    if (!diagramView) return;

    // If dropping on SVG, convert to SVG coordinates
    const svg = diagramView.querySelector('svg') as SVGSVGElement | null;
    let x: number;
    let y: number;
    
    if (svg) {
      const svgPoint = svg.createSVGPoint();
      svgPoint.x = event.clientX;
      svgPoint.y = event.clientY;
      const ctm = svg.getScreenCTM();
      if (ctm) {
        const svgCoords = svgPoint.matrixTransform(ctm.inverse());
        x = svgCoords.x;
        y = svgCoords.y;
      } else {
        // Fallback: calculate relative to SVG viewBox
        const svgRect = svg.getBoundingClientRect();
        x = ((event.clientX - svgRect.left) / svgRect.width) * 1000;
        y = ((event.clientY - svgRect.top) / svgRect.height) * 700;
      }
    } else {
      // Fallback: use container coordinates
      const rect = diagramView.getBoundingClientRect();
      x = event.clientX - rect.left + diagramView.scrollLeft;
      y = event.clientY - rect.top + diagramView.scrollTop;
    }

    // Create new service from template
    const newService: ServiceConfig = {
      serviceName: template.serviceName,
      dockerImage: template.dockerImage,
      hostPort: template.ports[0]?.host || '',
      containerPort: template.ports[0]?.container || '',
      environment: template.environment?.join('\n') || '',
      volumes: template.volumes?.join('\n') || '',
      healthCheck: {
        enabled: !!template.healthcheck,
        interval: template.healthcheck?.interval || '30s',
        timeout: template.healthcheck?.timeout || '10s',
        retries: template.healthcheck?.retries || 3
      },
      resources: {
        cpuLimit: 0.5,
        memoryLimit: 512
      },
      deploy: {
        replicas: 1
      },
      restart: 'always',
      depends_on: [],
      networks: [],
      labels: {}
    };

    // Ensure unique service name
    let serviceName = newService.serviceName;
    let counter = 1;
    while (this.services.some(s => s.serviceName === serviceName)) {
      serviceName = `${newService.serviceName}-${counter}`;
      counter++;
    }
    newService.serviceName = serviceName;

    this.services.push(newService);
    this.selectedServiceIndex = this.services.length - 1;
    
    // Update graph first
    this.updateGraph();
    
    // Update the node position to drop location (after graph is created)
    setTimeout(() => {
      const node = this.composeGraph.nodes.find(n => n.id === serviceName);
      if (node) {
        // Adjust for node center (node is 120x80, so center is at 60,40)
        node.position = { 
          x: Math.max(60, Math.min(x - 60, 800)), 
          y: Math.max(40, Math.min(y - 40, 600)) 
        };
      }
    }, 0);
    
    this.loadServiceIntoForm(this.selectedServiceIndex);
  }

  // Get available templates for drag and drop and quick start
  getAvailableTemplates(): { name: string; displayName: string; icon: string }[] {
    return [
      { name: 'nginx', displayName: 'Nginx', icon: 'nginx' },
      { name: 'postgres', displayName: 'PostgreSQL', icon: 'postgres' },
      { name: 'redis', displayName: 'Redis', icon: 'redis' },
      { name: 'mysql', displayName: 'MySQL', icon: 'mysql' },
      { name: 'mongo', displayName: 'MongoDB', icon: 'mongo' },
    ];
  }

  getTemplateDisplayName(templateName: string): string {
    const template = this.getAvailableTemplates().find(t => t.name === templateName);
    return template ? template.displayName : templateName;
  }

  getTemplateIcon(templateName: string): string {
    const template = this.getAvailableTemplates().find(t => t.name === templateName);
    return template ? template.icon : templateName;
  }

  selectTemplate(templateName: string): void {
    // Clear existing services if starting fresh
    if (this.services.length === 0 || (this.services.length === 1 && !this.services[0].serviceName && !this.services[0].dockerImage)) {
      this.services = [];
    }
    
    // Apply template
    this.composeForm.patchValue({ serviceTemplate: templateName });
    this.applyServiceTemplate(templateName);
    
    // Expand basic section to show the filled form
    this.expandedSections['basic'] = true;
    
    // Track template selection
    this.analyticsService.trackEvent('template_selected', { template_name: templateName });
  }


  private applyServiceTemplate(templateName: string): void {
    const template = this.dockerComposeService.getServiceTemplate(templateName);
    if (!template) return;

    this.composeForm.patchValue({
      serviceName: template.serviceName,
      dockerImage: template.dockerImage,
      hostPort: template.ports[0].host,
      containerPort: template.ports[0].container,
      environment: template.environment?.join('\n') || '',
      volumes: template.volumes?.join('\n') || '',
      healthCheck: {
        enabled: !!template.healthcheck,
        ...template.healthcheck
      }
    }, { emitEvent: false });
  }

  private updateYamlPreview(): void {
    try {
      // Save current service before generating
      this.saveCurrentServiceToArray();
      
      // Get services for current environment
      const servicesToUse = this.getCurrentEnvironmentServices();
      const config = this.dockerComposeService.generateDockerComposeConfigFromServices(
        servicesToUse,
        this.currentEnvironment !== 'base' ? this.environments.find(e => e.name === this.currentEnvironment)?.profile : undefined
      );
      
      this.yamlPreview = yaml.dump(config, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        sortKeys: false
      });
    } catch (error) {
      console.error('Error generating YAML preview:', error);
    }
  }

  generateDockerComposeFile(): void {
    // Save current service before generating
    this.saveCurrentServiceToArray();

    // Validate all services
    const errors = this.validateAllServices();
    if (errors.length > 0) {
      alert('Please fix the following errors:\n\n' + errors.join('\n'));
      return;
    }

    if (this.composeForm.invalid) {
      // Show specific validation errors
      const formErrors = this.getFormErrors();
      if (formErrors.length > 0) {
        alert('Please fix the following errors:\n\n' + formErrors.join('\n'));
      } else {
      alert('Please fill in all required fields correctly');
      }
      return;
    }

    this.isGenerating = true;
    try {
      // Get services for current environment
      const servicesToUse = this.getCurrentEnvironmentServices();
      const profile = this.currentEnvironment !== 'base' 
        ? this.environments.find(e => e.name === this.currentEnvironment)?.profile 
        : undefined;
      
      const config = this.dockerComposeService.generateDockerComposeConfigFromServices(servicesToUse, profile);
      this.dockerComposeService.generateAndDownloadFile(config);
      this.analyticsService.trackFileGenerated();
      
      // Show success notification
      this.showGenerateSuccessPopup = true;
      setTimeout(() => {
        this.showGenerateSuccessPopup = false;
      }, 3000);
    } catch (error: any) {
      // Show graceful error message instead of crashing
      const errorMessage = error?.message || 'An error occurred while generating the Docker Compose file. Please check your configuration.';
      alert(`Error: ${errorMessage}`);
      console.error('Error generating Docker Compose file:', error);
    } finally {
      this.isGenerating = false;
    }
  }

  closeGenerateSuccessPopup(): void {
    this.showGenerateSuccessPopup = false;
  }

  // Copy YAML to clipboard
  async copyYamlToClipboard(): Promise<void> {
    try {
      if (!this.yamlPreview) {
        this.updateYamlPreview();
      }
      
      await navigator.clipboard.writeText(this.yamlPreview);
      
      // Show temporary success feedback
      const button = document.querySelector('.btn-copy-yaml') as HTMLElement;
      if (button) {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        button.style.opacity = '0.7';
        setTimeout(() => {
          button.textContent = originalText;
          button.style.opacity = '1';
        }, 2000);
      }
      
      this.analyticsService.trackEvent('yaml_copied', {});
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback: select text for manual copy
      const yamlElement = document.querySelector('.yaml-preview-content pre code');
      if (yamlElement) {
        const range = document.createRange();
        range.selectNode(yamlElement);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
        alert('YAML selected. Press Ctrl+C (or Cmd+C) to copy.');
      }
    }
  }

  // Export as Docker Run commands
  exportAsDockerRunCommands(): void {
    try {
      this.saveCurrentServiceToArray();
      
      let commands = '# Docker Run Commands\n';
      commands += '# Generated from Docker Compose configuration\n\n';
      
      this.services.forEach((service, index) => {
        if (!service.serviceName || !service.dockerImage) {
          return; // Skip invalid services
        }
        
        commands += `# Service: ${service.serviceName}\n`;
        if (service.notes) {
          commands += `# ${service.notes.split('\n').join('\n# ')}\n`;
        }
        commands += `docker run -d \\\n`;
        commands += `  --name ${service.serviceName} \\\n`;
        
        // Port mapping
        if (service.hostPort && service.containerPort) {
          commands += `  -p ${service.hostPort}:${service.containerPort} \\\n`;
        }
        
        // Environment variables
        if (service.environment) {
          const envVars = service.environment.split('\n').filter(v => v.trim());
          envVars.forEach(env => {
            commands += `  -e "${env.trim()}" \\\n`;
          });
        }
        
        // Volumes
        if (service.volumes) {
          const volumes = service.volumes.split('\n').filter(v => v.trim());
          volumes.forEach(vol => {
            commands += `  -v "${vol.trim()}" \\\n`;
          });
        }
        
        // Restart policy
        if (service.restart && service.restart !== 'no') {
          commands += `  --restart=${service.restart} \\\n`;
        }
        
        // Resource limits
        if (service.resources) {
          if (service.resources.cpuLimit) {
            commands += `  --cpus="${service.resources.cpuLimit}" \\\n`;
          }
          if (service.resources.memoryLimit) {
            commands += `  --memory="${service.resources.memoryLimit}m" \\\n`;
          }
        }
        
        // Labels
        if (service.labels && Object.keys(service.labels).length > 0) {
          Object.entries(service.labels).forEach(([key, value]) => {
            commands += `  --label "${key}=${value}" \\\n`;
          });
        }
        
        // Remove trailing backslash and add image
        commands = commands.trim().replace(/\\$/, '');
        commands += ` \\\n  ${service.dockerImage}\n\n`;
      });
      
      // Create and download file
      const blob = new Blob([commands], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `docker-run-commands-${new Date().toISOString().split('T')[0]}.sh`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      this.analyticsService.trackEvent('docker_run_exported', {
        service_count: this.services.length
      });
    } catch (error) {
      console.error('Error exporting Docker Run commands:', error);
      alert('Failed to export Docker Run commands. Please try again.');
    }
  }

  // Export configuration as JSON
  exportConfigAsJson(): void {
    try {
      this.saveCurrentServiceToArray();
      
      const config = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        services: this.services,
        metadata: {
          serviceCount: this.services.length,
          serviceNames: this.services.map(s => s.serviceName).filter(Boolean)
        }
      };
      
      const jsonString = JSON.stringify(config, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `docker-compose-config-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      this.analyticsService.trackEvent('config_exported', {
        service_count: this.services.length
      });
    } catch (error) {
      console.error('Error exporting configuration:', error);
      alert('Failed to export configuration. Please try again.');
    }
  }


  // Validate all services in the array
  private validateAllServices(): string[] {
    const errors: string[] = [];
    this.saveCurrentServiceToArray();

    // Check for duplicate service names
    const serviceNames = this.services.map(s => s.serviceName.trim().toLowerCase());
    const duplicates = serviceNames.filter((name, index) => serviceNames.indexOf(name) !== index);
    if (duplicates.length > 0) {
      errors.push(`Duplicate service names found: ${[...new Set(duplicates)].join(', ')}`);
    }

    // Validate each service
    this.services.forEach((service, index) => {
      if (!service.serviceName || !service.serviceName.trim()) {
        errors.push(`Service ${index + 1}: Service name is required`);
      }
      if (!service.dockerImage || !service.dockerImage.trim()) {
        errors.push(`Service ${index + 1} (${service.serviceName || 'unnamed'}): Docker image is required`);
      }
      if (!service.hostPort || !service.containerPort) {
        errors.push(`Service ${index + 1} (${service.serviceName || 'unnamed'}): Both host and container ports are required`);
      }
    });

    return errors;
  }

  // Helper method to get form validation errors
  private getFormErrors(): string[] {
    const errors: string[] = [];
    const form = this.composeForm;

    if (form.get('serviceName')?.hasError('required')) {
      errors.push('Service name is required');
    }
    if (form.get('serviceName')?.hasError('pattern')) {
      errors.push('Service name must start with a letter and contain only letters, numbers, underscores, or hyphens');
    }
    if (form.get('dockerImage')?.hasError('required')) {
      errors.push('Docker image is required');
    }
    if (form.get('hostPort')?.hasError('required')) {
      errors.push('Host port is required');
    }
    if (form.get('hostPort')?.hasError('min') || form.get('hostPort')?.hasError('max')) {
      errors.push('Host port must be between 1 and 65535');
    }
    if (form.get('containerPort')?.hasError('required')) {
      errors.push('Container port is required');
    }
    if (form.get('containerPort')?.hasError('min') || form.get('containerPort')?.hasError('max')) {
      errors.push('Container port must be between 1 and 65535');
    }

    // Check healthcheck validation
    const healthCheck = form.get('healthCheck');
    if (healthCheck?.get('enabled')?.value) {
      if (!healthCheck.get('interval')?.value?.trim()) {
        errors.push('Health check interval is required when health check is enabled');
      }
      if (!healthCheck.get('timeout')?.value?.trim()) {
        errors.push('Health check timeout is required when health check is enabled');
      }
      const retries = healthCheck.get('retries')?.value;
      if (retries === null || retries === undefined || retries < 0) {
        errors.push('Health check retries must be a non-negative number');
      }
    }

    return errors;
  }

  // Get better error message with suggestions
  getErrorMessage(fieldName: string): { message: string; suggestion?: string } | null {
    const control = this.composeForm.get(fieldName);
    if (!control || !control.errors || !control.touched) {
      return null;
    }

    const errors = control.errors;
    const value = control.value;

    if (errors['required']) {
      return {
        message: `This field is required`,
        suggestion: this.getRequiredFieldSuggestion(fieldName)
      };
    }

    if (errors['pattern']) {
      return {
        message: this.getPatternErrorMessage(fieldName, value),
        suggestion: this.getPatternSuggestion(fieldName)
      };
    }

    if (errors['duplicateServiceName']) {
      return {
        message: `A service with this name already exists`,
        suggestion: `Try adding a number or suffix, like "${value}-2" or "${value}-db"`
      };
    }

    // Check for port conflicts (real-time validation)
    if (fieldName === 'hostPort' && this.hasPortConflict()) {
      const conflictingServices = this.getConflictingServiceNames();
      return {
        message: `Port ${value} is already used by ${conflictingServices.length} other service${conflictingServices.length > 1 ? 's' : ''}`,
        suggestion: `Conflicting services: ${conflictingServices.join(', ')}. Choose a different port.`
      };
    }

    if (errors['min'] || errors['max']) {
      return {
        message: this.getRangeErrorMessage(fieldName, errors),
        suggestion: this.getRangeSuggestion(fieldName)
      };
    }

    return null;
  }

  private getRequiredFieldSuggestion(fieldName: string): string {
    const suggestions: { [key: string]: string } = {
      'serviceName': 'Give your service a name like "web-server" or "database"',
      'dockerImage': 'Enter a Docker image like "nginx:latest" or "postgres:15"',
      'hostPort': 'Enter a port number like 8080 or 3000',
      'containerPort': 'Enter the port your application uses, like 80 or 5432'
    };
    return suggestions[fieldName] || 'Please fill in this field';
  }

  private getPatternErrorMessage(fieldName: string, value: string): string {
    if (fieldName === 'serviceName') {
      if (value && /^\d/.test(value)) {
        return `Service names must start with a letter, not a number`;
      }
      if (value && /[^a-zA-Z0-9_-]/.test(value)) {
        return `Service names can only contain letters, numbers, hyphens, and underscores`;
      }
      return `Invalid service name format`;
    }
    return `Invalid format`;
  }

  private getPatternSuggestion(fieldName: string): string {
    if (fieldName === 'serviceName') {
      return `Use names like "web-server", "api", or "database". Start with a letter.`;
    }
    return '';
  }

  private getRangeErrorMessage(fieldName: string, errors: any): string {
    if (errors['min']) {
      return `Port number must be at least ${errors['min'].min}`;
    }
    if (errors['max']) {
      return `Port number cannot exceed ${errors['max'].max}`;
    }
    return `Port must be between 1 and 65535`;
  }

  private getRangeSuggestion(fieldName: string): string {
    if (fieldName === 'hostPort') {
      return `Common ports: 3000, 8080, 8000. Avoid ports below 1024 (they require admin access).`;
    }
    if (fieldName === 'containerPort') {
      return `Common ports: 80 (HTTP), 443 (HTTPS), 5432 (PostgreSQL), 3306 (MySQL), 6379 (Redis)`;
    }
    return '';
  }

  getTemplateDescription(templateName: string): string {
    const descriptions: { [key: string]: string } = {
      'nginx': 'Web server and reverse proxy. Perfect for serving static files or as a front-end proxy.',
      'postgres': 'Powerful open-source relational database. Great for applications that need SQL.',
      'redis': 'In-memory data store. Perfect for caching, sessions, and real-time features.',
      'mysql': 'Popular relational database. Widely used for web applications.',
      'mongo': 'NoSQL document database. Great for flexible, schema-less data storage.'
    };
    return descriptions[templateName] || 'Pre-configured service template';
  }

  // Get error message for health check fields
  getHealthCheckErrorMessage(fieldName: string): { message: string; suggestion?: string } | null {
    const healthCheck = this.composeForm.get('healthCheck');
    if (!healthCheck?.get('enabled')?.value) {
      return null; // Don't show errors if health check is disabled
    }

    const control = healthCheck.get(fieldName);
    if (!control || !control.errors || !control.touched) {
      return null;
    }

    const errors = control.errors;
    const value = control.value;

    if (errors['required']) {
      const suggestions: { [key: string]: string } = {
        'interval': 'Set how often to check (e.g., "30s" for every 30 seconds, "1m" for every minute)',
        'timeout': 'Set maximum wait time (e.g., "10s" for 10 seconds, "5m" for 5 minutes)',
        'retries': 'Set how many failures before marking unhealthy (e.g., 3)',
        'start_period': 'Set wait time before first check (e.g., "40s" for 40 seconds)'
      };
      return {
        message: `This field is required when health check is enabled`,
        suggestion: suggestions[fieldName] || 'Please fill in this field'
      };
    }

    if (errors['min']) {
      return {
        message: `Value must be at least ${errors['min'].min}`,
        suggestion: 'Enter a non-negative number'
      };
    }

    return null;
  }

  // Unified method to handle file selection (YAML or JSON)
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) {
      return;
    }

    this.isImporting = true;
    const reader = new FileReader();
    
    reader.onload = () => {
      const content = reader.result as string;
      const fileName = file.name.toLowerCase();
      const isJson = fileName.endsWith('.json');
      const isYaml = fileName.endsWith('.yaml') || fileName.endsWith('.yml');

      try {
        if (isJson) {
          this.importFromJson(content);
        } else if (isYaml) {
          this.importFromYaml(content);
        } else {
          throw new Error('Unsupported file type. Please use .yaml, .yml, or .json files.');
        }
      } catch (error: any) {
        console.error('Error importing file:', error);
        alert(`Error importing file: ${error.message || 'Invalid file format'}`);
      } finally {
        this.isImporting = false;
        // Reset file input
        event.target.value = '';
      }
    };

    reader.onerror = () => {
      this.isImporting = false;
      alert('Error reading file. Please try again.');
      event.target.value = '';
    };

    reader.readAsText(file);
  }

  // Import from YAML content
  private importFromYaml(content: string): void {
    this.analyticsService.trackFileUploaded();
    const parsedYaml = yaml.load(content) as any;
    
    if (!parsedYaml || !parsedYaml.services) {
      throw new Error('Invalid Docker Compose file. No services found.');
    }

    // Check if we have existing services
    this.saveCurrentServiceToArray();
    const hasExistingServices = this.services.length > 0 && 
                                this.services.some(s => s.serviceName && s.serviceName.trim());

    if (hasExistingServices) {
      const shouldMerge = confirm(
        `You have ${this.services.length} existing service(s). Do you want to merge the imported services with your existing ones?\n\n` +
        `Click OK to merge (imported services will be added to existing ones).\n` +
        `Click Cancel to replace all services with the imported ones.`
      );
      
      if (shouldMerge) {
        this.mergeServicesFromYaml(parsedYaml);
      } else {
        this.populateFormFromYaml(parsedYaml);
      }
    } else {
      this.populateFormFromYaml(parsedYaml);
    }
    
    this.checkAdvancedFeatures(parsedYaml);
  }

  // Import from JSON content
  private importFromJson(content: string): void {
    const config = JSON.parse(content);
    
    // Validate the imported config structure
    if (!config.services || !Array.isArray(config.services)) {
      throw new Error('Invalid configuration format. Expected a "services" array.');
    }

    if (config.services.length === 0) {
      throw new Error('No services found in the configuration file.');
    }

    // Check if we have existing services
    this.saveCurrentServiceToArray();
    const hasExistingServices = this.services.length > 0 && 
                                this.services.some(s => s.serviceName && s.serviceName.trim());
    let shouldMerge = false;

    if (hasExistingServices) {
      shouldMerge = confirm(
        `You have ${this.services.length} existing service(s). Do you want to merge the imported services with your existing ones?\n\n` +
        `Click OK to merge (imported services will be added to existing ones).\n` +
        `Click Cancel to replace all services with the imported ones.`
      );
      
      if (!shouldMerge) {
        // Replace all services
        this.services = [];
      }
    }

    // Parse imported services
    const importedServices = config.services.map((service: any, index: number) => {
      // Ensure serviceName exists (use index as fallback for unnamed services)
      const serviceName = service.serviceName?.trim() || `service-${index + 1}`;
      
      return {
        serviceName: serviceName,
        dockerImage: service.dockerImage || '',
        hostPort: service.hostPort || '',
        containerPort: service.containerPort || '',
        environment: service.environment || '',
        volumes: service.volumes || '',
        healthCheck: service.healthCheck ? {
          enabled: service.healthCheck.enabled ?? false,
          interval: service.healthCheck.interval || '30s',
          timeout: service.healthCheck.timeout || '10s',
          retries: service.healthCheck.retries ?? 3,
          startPeriod: service.healthCheck.startPeriod || '',
          test: service.healthCheck.test || []
        } : {
          enabled: false,
          interval: '30s',
          timeout: '10s',
          retries: 3,
          startPeriod: '',
          test: []
        },
        resources: service.resources ? {
          cpuLimit: service.resources.cpuLimit ?? 0.5,
          memoryLimit: service.resources.memoryLimit ?? 512
        } : {
          cpuLimit: 0.5,
          memoryLimit: 512
        },
        deploy: service.deploy ? {
          replicas: service.deploy.replicas ?? 1
        } : {
          replicas: 1
        },
        restart: service.restart || 'always',
        depends_on: Array.isArray(service.depends_on) ? service.depends_on : [],
        networks: Array.isArray(service.networks) ? service.networks : [],
        labels: service.labels && typeof service.labels === 'object' ? service.labels : {}
      };
    });

    // Merge imported services with existing ones (make names unique)
    importedServices.forEach((importedService: ServiceConfig) => {
      let serviceName = importedService.serviceName;
      let counter = 1;
      
      // Make service name unique if it conflicts
      while (this.services.some(s => s.serviceName === serviceName)) {
        serviceName = `${importedService.serviceName}-${counter}`;
        counter++;
      }
      
      importedService.serviceName = serviceName;
      this.services.push(importedService);
    });

    // Select first service and load into form
    if (this.services.length > 0) {
      this.selectedServiceIndex = this.services.length - 1; // Select the last imported service
      this.loadServiceIntoForm(this.selectedServiceIndex);
      this.updateYamlPreview();
      this.updateGraph();
      this.analyzeConfig();
      this.calculateResourceUsage();
      
      this.analyticsService.trackEvent('config_imported', {
        service_count: importedServices.length,
        format: 'json',
        merged: hasExistingServices
      });
    }
  }

  // Check for advanced features not yet supported in the form
  private checkAdvancedFeatures(yamlData: any): void {
    const unsupportedFeatures: string[] = [];
    
    if (!yamlData.services) {
      return;
    }

    Object.values(yamlData.services).forEach((service: any) => {
      if (service.networks && Object.keys(service.networks).length > 0) {
        unsupportedFeatures.push('networks');
      }
      if (service.labels && Object.keys(service.labels).length > 0) {
        unsupportedFeatures.push('labels');
      }
      if (service.build) {
        unsupportedFeatures.push('build');
      }
      if (service.command && Array.isArray(service.command) && service.command.length > 0) {
        unsupportedFeatures.push('command');
      }
      if (service.entrypoint) {
        unsupportedFeatures.push('entrypoint');
      }
    });

    if (yamlData.networks && Object.keys(yamlData.networks).length > 0) {
      unsupportedFeatures.push('top-level networks');
    }
    if (yamlData.volumes && Object.keys(yamlData.volumes).length > 0) {
      unsupportedFeatures.push('top-level volumes');
    }

    this.hasAdvancedFeatures = unsupportedFeatures.length > 0;
    if (this.hasAdvancedFeatures) {
      const uniqueFeatures = [...new Set(unsupportedFeatures)];
      this.advancedFeaturesNote = `Note: Some advanced options (${uniqueFeatures.join(', ')}) aren't visualized yet but are preserved in the YAML when you generate the file.`;
    }
  }

  // Method to populate form from parsed YAML (replaces all services)
  private populateFormFromYaml(yamlData: any): void {
    if (!yamlData || !yamlData.services) {
      alert('Invalid Docker Compose file. No services found.');
      return;
    }

    // Load all services from YAML
    const serviceNames = Object.keys(yamlData.services);
    if (serviceNames.length === 0) {
      alert('No services found in the Docker Compose file.');
      return;
    }

    // Clear existing services and load all from YAML
    this.services = [];
    serviceNames.forEach(serviceName => {
      const service = yamlData.services[serviceName];
      const serviceConfig = this.parseServiceFromYaml(serviceName, service);
      this.services.push(serviceConfig);
    });

    // Select first service
    this.selectedServiceIndex = 0;
    this.loadServiceIntoForm(0);
    this.updateGraph();
    this.updateYamlPreview();
    this.analyzeConfig();
    this.calculateResourceUsage();
  }

  // Method to merge services from YAML (adds to existing services)
  private mergeServicesFromYaml(yamlData: any): void {
    if (!yamlData || !yamlData.services) {
      return;
    }

    const serviceNames = Object.keys(yamlData.services);
    if (serviceNames.length === 0) {
      return;
    }

    // Save current service before merging
    this.saveCurrentServiceToArray();

    // Add imported services, making names unique
    serviceNames.forEach(serviceName => {
      const service = yamlData.services[serviceName];
      const serviceConfig = this.parseServiceFromYaml(serviceName, service);
      
      // Make service name unique if it conflicts
      let uniqueName = serviceConfig.serviceName;
      let counter = 1;
      while (this.services.some(s => s.serviceName === uniqueName)) {
        uniqueName = `${serviceConfig.serviceName}-${counter}`;
        counter++;
      }
      serviceConfig.serviceName = uniqueName;
      
      this.services.push(serviceConfig);
    });

    // Select the last imported service
    this.selectedServiceIndex = this.services.length - 1;
    this.loadServiceIntoForm(this.selectedServiceIndex);
    this.updateGraph();
    this.updateYamlPreview();
    this.analyzeConfig();
    this.calculateResourceUsage();
  }

  // Parse a single service from YAML format to ServiceConfig
  private parseServiceFromYaml(serviceName: string, service: any): ServiceConfig {

    const serviceConfig: ServiceConfig = {
      serviceName: serviceName,
      dockerImage: service.image || '',
      hostPort: '',
      containerPort: '',
      environment: '',
      volumes: '',
      healthCheck: {
        enabled: false,
        interval: '30s',
        timeout: '10s',
        retries: 3
      },
      resources: {
        cpuLimit: 0.5,
        memoryLimit: 512
      },
      deploy: {
        replicas: 1
      },
      restart: service.restart || 'always',
      depends_on: [],
      networks: [],
      labels: {},
      notes: ''
    };

    // Parse ports (format: "host:container" or "host:container/protocol" or object format)
    if (service.ports && service.ports.length > 0) {
      const firstPort = service.ports[0];
      if (typeof firstPort === 'string') {
        // Handle format like "8080:80" or "8080:80/tcp"
        const portPart = firstPort.split('/')[0]; // Remove protocol if present
        const [host, container] = portPart.split(':');
        serviceConfig.hostPort = host || '';
        serviceConfig.containerPort = container || '';
      } else if (typeof firstPort === 'object' && firstPort.target) {
        serviceConfig.containerPort = firstPort.target.toString();
        serviceConfig.hostPort = firstPort.published?.toString() || '';
      }
    }

    // Parse environment variables
    if (service.environment) {
      if (Array.isArray(service.environment)) {
        serviceConfig.environment = service.environment.join('\n');
      } else if (typeof service.environment === 'object') {
        serviceConfig.environment = Object.entries(service.environment)
          .map(([key, value]) => `${key}=${value}`)
          .join('\n');
      }
    }

    // Parse volumes
    if (service.volumes && Array.isArray(service.volumes)) {
      serviceConfig.volumes = service.volumes.join('\n');
    }

    // Parse healthcheck
    if (service.healthcheck) {
      serviceConfig.healthCheck = {
        enabled: true,
        interval: service.healthcheck.interval || '30s',
        timeout: service.healthcheck.timeout || '10s',
        retries: service.healthcheck.retries || 3,
      };
    }

    // Parse networks (already initialized to [])
    if (service.networks) {
      if (Array.isArray(service.networks)) {
        serviceConfig.networks = service.networks;
      } else if (typeof service.networks === 'object') {
        serviceConfig.networks = Object.keys(service.networks);
      }
    }

    // Parse deploy resources
    if (service.deploy) {
      serviceConfig.deploy = {
        replicas: service.deploy.replicas || 1,
      };

      if (service.deploy.resources && service.deploy.resources.limits) {
        const limits = service.deploy.resources.limits;
        serviceConfig.resources = {
          cpuLimit: limits.cpus ? parseFloat(limits.cpus.toString()) : 0.5,
          memoryLimit: this.parseMemoryLimit(limits.memory),
        };
      }
    }

    // Parse depends_on
    if (service.depends_on) {
      if (Array.isArray(service.depends_on)) {
        serviceConfig.depends_on = service.depends_on;
      } else if (typeof service.depends_on === 'object') {
        serviceConfig.depends_on = Object.keys(service.depends_on);
      }
    }

    // Parse networks
    if (service.networks) {
      if (Array.isArray(service.networks)) {
        // Array format: networks: [network1, network2]
        serviceConfig.networks = service.networks;
      } else if (typeof service.networks === 'object') {
        // Object format: networks: { network1: {}, network2: { aliases: [...] } }
        serviceConfig.networks = Object.keys(service.networks);
      }
    }

    // Parse labels
    if (service.labels) {
      if (Array.isArray(service.labels)) {
        // Array format: labels: ["key=value", "key2=value2"]
        const labelsObj: { [key: string]: string } = {};
        service.labels.forEach((label: string) => {
          const [key, ...valueParts] = label.split('=');
          if (key && valueParts.length > 0) {
            labelsObj[key.trim()] = valueParts.join('=').trim();
          }
        });
        serviceConfig.labels = labelsObj;
      } else if (typeof service.labels === 'object') {
        // Object format: labels: { key: value, key2: value2 }
        serviceConfig.labels = service.labels;
      }
    }

    // Notes are not in YAML, so leave as empty string
    serviceConfig.notes = '';

    return serviceConfig;
  }

  toggleHealthCheck() {
    const enabled = this.composeForm.get('healthCheck.enabled')?.value;
    this.composeForm.get('healthCheck.enabled')?.setValue(!enabled);
  }

  // Method to reset the form
  resetForm(): void {
    this.services = [];
    this.addNewService();
    this.composeForm.reset();
    this.yamlPreview = '';  // Clear the YAML preview
  }

  // Get service icon based on docker image
  getServiceIcon(service: ServiceConfig): string {
    // Return icon name for use in template
    const image = (service.dockerImage || '').toLowerCase();
    if (image.includes('nginx')) return 'nginx';
    if (image.includes('postgres')) return 'postgres';
    if (image.includes('redis')) return 'redis';
    if (image.includes('mysql')) return 'mysql';
    if (image.includes('mongo')) return 'mongo';
    return 'default';
  }

  // Helper method to parse memory limit from various formats (e.g., "512M", "1G", "1024MB")
  private parseMemoryLimit(memory: any): number {
    if (!memory) return 512;
    
    const memoryStr = memory.toString().toUpperCase();
    const numericValue = parseFloat(memoryStr.replace(/[^0-9.]/g, ''));
    
    if (memoryStr.includes('G')) {
      return Math.round(numericValue * 1024); // Convert GB to MB
    } else if (memoryStr.includes('K')) {
      return Math.round(numericValue / 1024); // Convert KB to MB
    } else {
      // Assume MB if no unit or if unit is M/MB
      return Math.round(numericValue);
    }
  }

  // Apply resource presets
  applyResourcePreset(preset: 'low' | 'medium' | 'high'): void {
    const presets = {
      low: { cpu: 0.5, memory: 512 },
      medium: { cpu: 1.0, memory: 1024 },
      high: { cpu: 2.0, memory: 2048 }
    };

    const presetValues = presets[preset];
    this.composeForm.patchValue({
      resources: {
        cpuLimit: presetValues.cpu,
        memoryLimit: presetValues.memory
      }
    });
  }

  // Custom validator for service name uniqueness
  serviceNameUniquenessValidator(control: FormControl): { [key: string]: any } | null {
    if (!control.value) {
      return null;
    }

    const serviceName = control.value.trim().toLowerCase();
    const duplicateIndex = this.services.findIndex(
      (service, index) => 
        index !== this.selectedServiceIndex && 
        service.serviceName.trim().toLowerCase() === serviceName
    );

    if (duplicateIndex >= 0) {
      return { duplicateServiceName: true };
    }

    return null;
  }

  // Check for port conflicts
  getPortConflicts(): { port: string; services: string[] }[] {
    const portMap = new Map<string, string[]>();
    
    this.services.forEach((service, index) => {
      if (service.hostPort && service.hostPort.trim()) {
        const port = service.hostPort.trim();
        if (!portMap.has(port)) {
          portMap.set(port, []);
        }
        portMap.get(port)!.push(service.serviceName || `Service ${index + 1}`);
      }
    });

    // Return only ports with conflicts (used by multiple services)
    const conflicts: { port: string; services: string[] }[] = [];
    portMap.forEach((services, port) => {
      if (services.length > 1) {
        conflicts.push({ port, services });
      }
    });

    return conflicts;
  }

  // Check if current service's port conflicts with others
  hasPortConflict(): boolean {
    const currentPort = this.composeForm.get('hostPort')?.value;
    if (!currentPort || !currentPort.trim()) {
      return false;
    }

    const port = currentPort.trim();
    const conflictingServices = this.services.filter(
      (service, index) => 
        index !== this.selectedServiceIndex && 
        service.hostPort && 
        service.hostPort.trim() === port
    );

    return conflictingServices.length > 0;
  }

  // Get conflicting service names for current port
  getConflictingServiceNames(): string[] {
    const currentPort = this.composeForm.get('hostPort')?.value;
    if (!currentPort || !currentPort.trim()) {
      return [];
    }

    const port = currentPort.trim();
    return this.services
      .filter((service, index) => 
        index !== this.selectedServiceIndex && 
        service.hostPort && 
        service.hostPort.trim() === port
      )
      .map(service => service.serviceName || 'Unnamed Service');
  }

  // Feedback handling
  submitFeedback(isVisual: boolean): void {
    this.showFeedbackComment = true;
    
    // Track in analytics
    this.analyticsService.trackEvent('diagram_feedback', {
      is_visual: isVisual,
      service_count: this.services.length
    });

    // Store in Firestore (without comment yet)
    this.firestoreService.submitDiagramFeedback({
      isVisual: isVisual,
      serviceCount: this.services.length,
      userAgent: navigator.userAgent
    }).catch(error => {
      console.error('Error storing feedback in Firestore:', error);
    });
  }

  async submitFeedbackComment(): Promise<void> {
    if (!this.feedbackComment.trim()) {
      return;
    }

    try {
      // Track feedback in analytics
      this.analyticsService.trackEvent('diagram_feedback_comment', {
        comment_length: this.feedbackComment.length,
        service_count: this.services.length
      });

      // Store in Firestore with comment
      await this.firestoreService.submitDiagramFeedback({
        isVisual: true, // Assume yes if they're leaving a comment
        comment: this.feedbackComment,
        serviceCount: this.services.length,
        userAgent: navigator.userAgent
      });

      this.feedbackSubmitted = true;
      this.feedbackComment = '';
      this.showFeedbackComment = false;

      setTimeout(() => {
        this.feedbackSubmitted = false;
      }, 3000);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      // Still show success to user even if storage fails
      this.feedbackSubmitted = true;
      this.feedbackComment = '';
      this.showFeedbackComment = false;
    }
  }

  // Template methods - Quick save with auto-generated name
  async quickSaveTemplate(): Promise<void> {
    if (this.services.length === 0) {
      alert('Cannot save an empty template. Please add at least one service.');
      return;
    }

    this.isSavingTemplate = true;
    try {
      // Save current service state
      this.saveCurrentServiceToArray();

      // Auto-generate template name
      let templateName = 'My Docker Compose Stack';
      if (this.services.length > 0) {
        const serviceNames = this.services
          .map(s => s.serviceName)
          .filter(Boolean)
          .slice(0, 3) // Limit to first 3 services
          .join('-');
        
        if (serviceNames) {
          templateName = serviceNames;
        }
      }

      // Check if name already exists and add number if needed
      const existingTemplates = this.templateService.getLocalTemplateMetadata();
      let finalName = templateName;
      let counter = 1;
      while (existingTemplates.some(t => t.name === finalName)) {
        finalName = `${templateName} (${counter})`;
        counter++;
      }

      const template: Template = {
        name: finalName,
        services: JSON.parse(JSON.stringify(this.services)) // Deep copy
      };

      // Save to localStorage
      const templateId = this.templateService.saveTemplateLocally(template);

      this.analyticsService.trackEvent('template_saved', {
        template_name: template.name,
        service_count: template.services.length
      });

      // Show success popup
      this.savedTemplateName = template.name;
      this.showSaveSuccessPopup = true;

      // Auto-hide after 3 seconds
      setTimeout(() => {
        this.showSaveSuccessPopup = false;
      }, 3000);
    } catch (error: any) {
      console.error('Error saving template:', error);
      alert(`Failed to save template: ${error.message || 'Unknown error'}`);
    } finally {
      this.isSavingTemplate = false;
    }
  }

  closeSaveSuccessPopup(): void {
    this.showSaveSuccessPopup = false;
  }

  openSaveTemplateModal(): void {
    // Pre-fill with a default name based on services
    if (this.services.length > 0) {
      const serviceNames = this.services.map(s => s.serviceName).filter(Boolean).join('-');
      this.templateName = serviceNames || 'My Docker Compose Stack';
    } else {
      this.templateName = 'My Docker Compose Stack';
    }
    this.templateDescription = '';
    this.templateTags = '';
    this.showSaveTemplateModal = true;
  }

  closeSaveTemplateModal(): void {
    this.showSaveTemplateModal = false;
    this.templateName = '';
    this.templateDescription = '';
    this.templateTags = '';
  }

  async saveTemplate(): Promise<void> {
    if (!this.templateName.trim()) {
      alert('Please enter a template name');
      return;
    }

    if (this.services.length === 0) {
      alert('Cannot save an empty template. Please add at least one service.');
      return;
    }

    this.isSavingTemplate = true;
    try {
      // Save current service state
      this.saveCurrentServiceToArray();

      const template: Template = {
        name: this.templateName.trim(),
        description: this.templateDescription.trim() || undefined,
        tags: this.templateTags.split(',').map(t => t.trim()).filter(Boolean),
        services: JSON.parse(JSON.stringify(this.services)) // Deep copy
      };

      // Save to localStorage (always)
      const templateId = this.templateService.saveTemplateLocally(template);
      
      // Optionally save to Firestore (for future cloud sync)
      // await this.templateService.saveTemplateToFirestore(template);

      this.analyticsService.trackEvent('template_saved', {
        template_name: template.name,
        service_count: template.services.length
      });

      // Show success popup
      this.savedTemplateName = template.name;
      this.closeSaveTemplateModal();
      this.showSaveSuccessPopup = true;

      // Auto-hide after 3 seconds
      setTimeout(() => {
        this.showSaveSuccessPopup = false;
      }, 3000);
    } catch (error: any) {
      console.error('Error saving template:', error);
      alert(`Failed to save template: ${error.message || 'Unknown error'}`);
    } finally {
      this.isSavingTemplate = false;
    }
  }

  // ========== ENVIRONMENT MANAGEMENT ==========
  
  initializeEnvironments(): void {
    // Check if environments already exist in localStorage
    const savedEnvironments = localStorage.getItem('dockerComposeEnvironments');
    if (savedEnvironments) {
      try {
        this.environments = JSON.parse(savedEnvironments);
        // Ensure base environment exists
        if (!this.environments.find(e => e.name === 'base')) {
          this.environments.unshift({ name: 'base', overrides: {} });
        }
      } catch (error) {
        console.error('Error loading environments:', error);
        this.createDefaultEnvironments();
      }
    } else {
      this.createDefaultEnvironments();
    }
    
    // Check if user has seen environment onboarding
    const seenEnvHint = localStorage.getItem('hasSeenEnvironmentHint');
    if (!seenEnvHint && this.services.length > 0) {
      // Show hint after a delay
      setTimeout(() => {
        if (confirm('Would you like to set up dev and prod environments? This allows you to manage different configurations for development and production.')) {
          this.showEnvironmentModal = true;
        }
        localStorage.setItem('hasSeenEnvironmentHint', 'true');
      }, 2000);
    }
  }

  createDefaultEnvironments(): void {
    this.environments = [
      { name: 'base', overrides: {} },
      { name: 'dev', profile: 'dev', overrides: {} },
      { name: 'prod', profile: 'prod', overrides: {} }
    ];
    this.saveEnvironments();
  }

  saveEnvironments(): void {
    localStorage.setItem('dockerComposeEnvironments', JSON.stringify(this.environments));
  }

  switchEnvironment(envName: string): void {
    if (envName === 'base') {
      this.currentEnvironment = 'base';
      // Reload base services
      this.updateYamlPreview();
      return;
    }

    const env = this.environments.find(e => e.name === envName);
    if (!env) {
      return;
    }

    this.currentEnvironment = envName;
    this.applyEnvironmentOverrides(env);
    this.updateYamlPreview();
    this.analyticsService.trackEvent('environment_switched', { environment: envName });
  }

  applyEnvironmentOverrides(env: Environment): void {
    // Apply overrides to services
    this.services.forEach((service, index) => {
      const override = env.overrides[service.serviceName];
      if (override) {
        // Merge override with base service
        this.services[index] = { ...service, ...override };
      }
    });

    // Reload current service into form
    if (this.selectedServiceIndex >= 0 && this.selectedServiceIndex < this.services.length) {
      this.loadServiceIntoForm(this.selectedServiceIndex);
    }
  }

  getCurrentEnvironmentServices(): ServiceConfig[] {
    if (this.currentEnvironment === 'base') {
      return this.services;
    }

    const env = this.environments.find(e => e.name === this.currentEnvironment);
    if (!env) {
      return this.services;
    }

    // Apply overrides
    return this.services.map(service => {
      const override = env.overrides[service.serviceName];
      return override ? { ...service, ...override } : service;
    });
  }

  saveEnvironmentOverride(serviceName: string): void {
    if (this.currentEnvironment === 'base') {
      return; // Base environment doesn't have overrides
    }

    const env = this.environments.find(e => e.name === this.currentEnvironment);
    if (!env) {
      return;
    }

    const service = this.services.find(s => s.serviceName === serviceName);
    if (!service) {
      return;
    }

    // Get base service (from base environment)
    const baseService = this.services.find(s => s.serviceName === serviceName);
    if (!baseService) {
      return;
    }

    // Calculate differences
    const override: Partial<ServiceConfig> = {};
    Object.keys(service).forEach(key => {
      const serviceKey = key as keyof ServiceConfig;
      if (JSON.stringify(service[serviceKey]) !== JSON.stringify(baseService[serviceKey])) {
        (override as any)[serviceKey] = service[serviceKey];
      }
    });

    if (Object.keys(override).length > 0) {
      env.overrides[serviceName] = override;
    } else {
      delete env.overrides[serviceName];
    }

    this.saveEnvironments();
  }

  addEnvironment(): void {
    if (!this.newEnvironmentName.trim()) {
      alert('Please enter an environment name');
      return;
    }

    if (this.environments.find(e => e.name === this.newEnvironmentName.trim())) {
      alert('Environment with this name already exists');
      return;
    }

    const newEnv: Environment = {
      name: this.newEnvironmentName.trim(),
      profile: this.newEnvironmentProfile.trim() || undefined,
      overrides: {}
    };

    this.environments.push(newEnv);
    this.saveEnvironments();
    this.newEnvironmentName = '';
    this.newEnvironmentProfile = '';
    this.showEnvironmentModal = false;

    this.analyticsService.trackEvent('environment_added', { environment: newEnv.name });
  }

  deleteEnvironment(envName: string): void {
    if (envName === 'base') {
      alert('Cannot delete base environment');
      return;
    }

    if (!confirm(`Are you sure you want to delete the "${envName}" environment?`)) {
      return;
    }

    this.environments = this.environments.filter(e => e.name !== envName);
    if (this.currentEnvironment === envName) {
      this.currentEnvironment = 'base';
    }
    this.saveEnvironments();

    this.analyticsService.trackEvent('environment_deleted', { environment: envName });
  }

  getEnvironmentDiff(env1Name: string, env2Name: string): { [serviceName: string]: { [key: string]: { base: any; env1: any; env2: any } } } {
    const diff: { [serviceName: string]: { [key: string]: { base: any; env1: any; env2: any } } } = {};
    const env1 = this.environments.find(e => e.name === env1Name);
    const env2 = this.environments.find(e => e.name === env2Name);

    this.services.forEach(service => {
      const serviceDiff: { [key: string]: { base: any; env1: any; env2: any } } = {};
      const baseService = service;
      const env1Service = env1?.overrides[service.serviceName] ? { ...baseService, ...env1.overrides[service.serviceName] } : baseService;
      const env2Service = env2?.overrides[service.serviceName] ? { ...baseService, ...env2.overrides[service.serviceName] } : baseService;

      // Compare all properties
      Object.keys(baseService).forEach(key => {
        const serviceKey = key as keyof ServiceConfig;
        const baseValue = baseService[serviceKey];
        const env1Value = env1Service[serviceKey];
        const env2Value = env2Service[serviceKey];

        if (JSON.stringify(env1Value) !== JSON.stringify(env2Value)) {
          serviceDiff[key] = {
            base: baseValue,
            env1: env1Value,
            env2: env2Value
          };
        }
      });

      if (Object.keys(serviceDiff).length > 0) {
        diff[service.serviceName] = serviceDiff;
      }
    });

    return diff;
  }

  openEnvironmentDiff(): void {
    if (!this.diffEnvironment1 || !this.diffEnvironment2) {
      alert('Please select two environments to compare');
      return;
    }
    this.showEnvironmentDiff = true;
  }

  closeEnvironmentDiff(): void {
    this.showEnvironmentDiff = false;
    this.diffEnvironment1 = '';
    this.diffEnvironment2 = '';
  }

  // ========== SHARING ==========
  
  generateShareableLink(): void {
    this.saveCurrentServiceToArray();
    
    const shareData = {
      services: this.services,
      environments: this.environments,
      timestamp: Date.now()
    };
    
    // Encode data as base64
    const encoded = btoa(JSON.stringify(shareData));
    
    // Create shareable URL
    const baseUrl = window.location.origin;
    this.shareableLink = `${baseUrl}/share/${encoded}`;
    this.showShareModal = true;
    
    this.analyticsService.trackEvent('share_link_generated');
  }

  async copyShareableLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.shareableLink);
      this.analyticsService.trackEvent('share_link_copied');
    } catch (error) {
      console.error('Failed to copy link:', error);
      alert('Failed to copy link to clipboard');
    }
  }

  closeShareModal(): void {
    this.showShareModal = false;
  }

  loadFromShareData(shareData: any): void {
    try {
      if (shareData.services && Array.isArray(shareData.services)) {
        this.services = shareData.services;
        if (this.services.length > 0) {
          this.selectedServiceIndex = 0;
          this.loadServiceIntoForm(0);
        }
      }
      
      if (shareData.environments && Array.isArray(shareData.environments)) {
        this.environments = shareData.environments;
        this.saveEnvironments();
      }
      
      this.updateYamlPreview();
      this.updateGraph();
      this.calculateResourceUsage();
      
      this.analyticsService.trackEvent('config_loaded_from_share');
    } catch (error) {
      console.error('Error loading shared configuration:', error);
      alert('Failed to load shared configuration');
    }
  }

  // ========== DOCKER COMMANDS ==========
  
  getDockerComposeCommand(command: 'up' | 'down' | 'logs' | 'restart'): string {
    const profile = this.currentEnvironment !== 'base' 
      ? this.environments.find(e => e.name === this.currentEnvironment)?.profile 
      : undefined;
    
    let cmd = 'docker compose';
    
    if (profile) {
      cmd += ` --profile ${profile}`;
    }
    
    switch (command) {
      case 'up':
        return `${cmd} up -d`;
      case 'down':
        return `${cmd} down`;
      case 'logs':
        return `${cmd} logs -f`;
      case 'restart':
        return `${cmd} restart`;
      default:
        return cmd;
    }
  }

  getServiceLogsCommand(serviceName: string): string {
    const profile = this.currentEnvironment !== 'base' 
      ? this.environments.find(e => e.name === this.currentEnvironment)?.profile 
      : undefined;
    
    let cmd = 'docker compose';
    
    if (profile) {
      cmd += ` --profile ${profile}`;
    }
    
    return `${cmd} logs -f ${serviceName}`;
  }

  async copyCommandToClipboard(command: 'up' | 'down' | 'logs' | 'restart'): Promise<void> {
    const cmd = this.getDockerComposeCommand(command);
    try {
      await navigator.clipboard.writeText(cmd);
      this.analyticsService.trackEvent('command_copied', { command });
    } catch (error) {
      console.error('Failed to copy command:', error);
      alert('Failed to copy command to clipboard');
    }
  }

  async copyServiceLogsCommand(serviceName: string): Promise<void> {
    const cmd = this.getServiceLogsCommand(serviceName);
    try {
      await navigator.clipboard.writeText(cmd);
      this.analyticsService.trackEvent('service_logs_command_copied', { service: serviceName });
    } catch (error) {
      console.error('Failed to copy command:', error);
      alert('Failed to copy command to clipboard');
    }
  }

  // ========== QUICK WINS FEATURES ==========

  // 1. Service Search/Filter
  getFilteredServices(): ServiceConfig[] {
    if (!this.serviceSearchQuery.trim()) {
      return this.services;
    }
    
    const query = this.serviceSearchQuery.toLowerCase().trim();
    return this.services.filter(service => {
      const name = (service.serviceName || '').toLowerCase();
      const image = (service.dockerImage || '').toLowerCase();
      const port = (service.hostPort || '').toLowerCase();
      return name.includes(query) || image.includes(query) || port.includes(query);
    });
  }

  clearServiceSearch(): void {
    this.serviceSearchQuery = '';
  }

  // 2. Service Status Indicators
  getServiceStatus(service: ServiceConfig): 'complete' | 'incomplete' | 'error' {
    // Check for errors
    if (!service.serviceName || !service.serviceName.trim()) {
      return 'error';
    }
    if (!service.dockerImage || !service.dockerImage.trim()) {
      return 'error';
    }
    if (!service.hostPort || !service.containerPort) {
      return 'error';
    }

    // Check if complete (has all essential fields)
    const hasName = service.serviceName && service.serviceName.trim();
    const hasImage = service.dockerImage && service.dockerImage.trim();
    const hasPorts = service.hostPort && service.containerPort;
    
    if (hasName && hasImage && hasPorts) {
      return 'complete';
    }

    return 'incomplete';
  }

  getServiceStatusClass(service: ServiceConfig): string {
    const status = this.getServiceStatus(service);
    return `status-${status}`;
  }

  getServiceStatusIcon(service: ServiceConfig): string {
    const status = this.getServiceStatus(service);
    switch (status) {
      case 'complete':
        return '✓';
      case 'incomplete':
        return '⚠';
      case 'error':
        return '✗';
      default:
        return '';
    }
  }

  // 3. Resource Usage Calculator
  calculateResourceUsage(): void {
    this.saveCurrentServiceToArray();
    
    let totalCpu = 0;
    let totalMemory = 0;

    this.services.forEach(service => {
      if (service.resources) {
        totalCpu += service.resources.cpuLimit || 0;
        totalMemory += service.resources.memoryLimit || 0;
      }
    });

    this.totalCpu = totalCpu;
    this.totalMemory = totalMemory;
  }

  getResourceUsageText(): string {
    if (this.services.length === 0) {
      return 'No services';
    }
    const memoryGB = (this.totalMemory / 1024).toFixed(2);
    return `${this.totalCpu.toFixed(1)} CPU cores, ${memoryGB} GB RAM`;
  }

  // 4. Environment Variable Presets
  getEnvironmentPresets(): Array<{ name: string; description: string; variables: string }> {
    return [
      {
        name: 'PostgreSQL',
        description: 'Database credentials',
        variables: 'POSTGRES_USER=admin\nPOSTGRES_PASSWORD=password\nPOSTGRES_DB=mydb'
      },
      {
        name: 'MySQL',
        description: 'Database credentials',
        variables: 'MYSQL_ROOT_PASSWORD=rootpassword\nMYSQL_DATABASE=mydb\nMYSQL_USER=user\nMYSQL_PASSWORD=password'
      },
      {
        name: 'Node.js',
        description: 'Node.js environment',
        variables: 'NODE_ENV=production\nPORT=3000'
      },
      {
        name: 'Redis',
        description: 'Redis configuration',
        variables: 'REDIS_HOST=localhost\nREDIS_PORT=6379'
      },
      {
        name: 'MongoDB',
        description: 'MongoDB credentials',
        variables: 'MONGO_INITDB_ROOT_USERNAME=admin\nMONGO_INITDB_ROOT_PASSWORD=password'
      },
      {
        name: 'Python',
        description: 'Python environment',
        variables: 'PYTHONUNBUFFERED=1\nFLASK_APP=app.py'
      }
    ];
  }

  applyEnvironmentPreset(preset: { variables: string }): void {
    const currentEnv = this.composeForm.get('environment')?.value || '';
    const newEnv = currentEnv ? `${currentEnv}\n${preset.variables}` : preset.variables;
    this.composeForm.get('environment')?.setValue(newEnv);
  }

  // 5. Volume Mount Presets
  getVolumePresets(): Array<{ name: string; description: string; volume: string }> {
    return [
      {
        name: 'Data Directory',
        description: 'Local data directory',
        volume: './data:/app/data'
      },
      {
        name: 'Config Directory',
        description: 'Local config directory',
        volume: './config:/etc/config'
      },
      {
        name: 'Logs Directory',
        description: 'Local logs directory',
        volume: './logs:/var/log/app'
      },
      {
        name: 'Named Volume (Data)',
        description: 'Persistent named volume',
        volume: 'app-data:/app/data'
      },
      {
        name: 'Named Volume (Config)',
        description: 'Persistent named volume',
        volume: 'app-config:/etc/config'
      },
      {
        name: 'Read-Only Config',
        description: 'Read-only config mount',
        volume: './config:/etc/config:ro'
      }
    ];
  }

  applyVolumePreset(preset: { volume: string }): void {
    const currentVolumes = this.composeForm.get('volumes')?.value || '';
    const newVolumes = currentVolumes ? `${currentVolumes}\n${preset.volume}` : preset.volume;
    this.composeForm.get('volumes')?.setValue(newVolumes);
  }
}
