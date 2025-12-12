import { Component, OnInit, inject } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { DockerComposeService } from '../services/docker-compose.service';
import { AnalyticsService } from '../services/analytics.service';
import { FirestoreService } from '../services/firestore.service';
import { GraphService } from '../services/graph.service';
import { ServiceConfig } from '../models/service-config.model';
import { ComposeGraph } from '../models/compose-graph.model';
import { SvgIconComponent } from '../shared/svg-icon.component';
import * as yaml from 'js-yaml';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-compose-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, FormsModule, SvgIconComponent],
  templateUrl: './compose-form.component.html',
  styleUrl: './compose-form.component.scss'

})
export class ComposeFormComponent implements OnInit {
  // Inject services using inject() function
  private dockerComposeService = inject(DockerComposeService);
  private analyticsService = inject(AnalyticsService);
  private firestoreService = inject(FirestoreService);
  private graphService = inject(GraphService);

  services: ServiceConfig[] = [];
  selectedServiceIndex: number = 0;
  activeTab: 'form' | 'diagram' | 'yaml' = 'form';
  composeGraph: ComposeGraph = { nodes: [], edges: [] };

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
    labels: new FormControl<{ [key: string]: string }>({})
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


  ngOnInit() {
    // Initialize with one empty service
    this.addNewService();
    this.setupFormSubscriptions();
    this.updateGraph();
    this.analyticsService.trackEditorUsed();
    
    // Check if user has seen the multi-service hint
    const seenHint = localStorage.getItem('hasSeenMultiServiceHint');
    this.hasSeenMultiServiceHint = seenHint === 'true';
  }

  dismissMultiServiceHint(): void {
    this.hasSeenMultiServiceHint = true;
    localStorage.setItem('hasSeenMultiServiceHint', 'true');
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
      labels: {}
    };
  }

  // Add a new service to the services array
  addNewService(): void {
    const newService = this.createDefaultService();
    newService.serviceName = `service-${this.services.length + 1}`;
    this.services.push(newService);
    this.selectedServiceIndex = this.services.length - 1;
    this.loadServiceIntoForm(this.selectedServiceIndex);
    this.updateGraph();
  }

  // Duplicate the currently selected service
  duplicateService(): void {
    if (this.selectedServiceIndex < 0 || this.selectedServiceIndex >= this.services.length) {
      return;
    }
    const serviceToDuplicate = { ...this.services[this.selectedServiceIndex] };
    serviceToDuplicate.serviceName = `${serviceToDuplicate.serviceName}-copy`;
    this.services.push(serviceToDuplicate);
    this.selectedServiceIndex = this.services.length - 1;
    this.loadServiceIntoForm(this.selectedServiceIndex);
    this.updateGraph();
  }

  // Delete a service
  deleteService(index: number): void {
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
      depends_on: service.depends_on || []
    }, { emitEvent: false });
    this.updateYamlPreview();
    this.updateGraph();
  }

  // Save current form data to the services array
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
      labels: formValue.labels && typeof formValue.labels === 'object' ? formValue.labels : {}
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
      this.updateYamlPreview();
      // Only update graph if we're on the diagram tab to avoid unnecessary re-renders
      if (this.activeTab === 'diagram') {
        this.updateGraph();
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
  setActiveTab(tab: 'form' | 'diagram' | 'yaml'): void {
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

  // Drag and drop handlers
  onTemplateDragStart(event: DragEvent, templateName: string): void {
    if (event.dataTransfer) {
      event.dataTransfer.setData('template', templateName);
      event.dataTransfer.effectAllowed = 'copy';
    }
  }

  onDiagramDrop(event: DragEvent): void {
    event.preventDefault();
    const templateName = event.dataTransfer?.getData('template');
    if (templateName) {
      this.createServiceFromTemplate(templateName, event);
    }
  }

  onDiagramDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  // Create service from template at drop position
  private createServiceFromTemplate(templateName: string, event: DragEvent): void {
    const template = this.dockerComposeService.getServiceTemplate(templateName);
    if (!template) {
      return;
    }

    // Get drop coordinates relative to diagram view container
    const diagramView = (event.target as HTMLElement).closest('.diagram-view');
    if (!diagramView) return;

    const rect = diagramView.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

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

  // Get available templates for drag and drop
  getAvailableTemplates(): string[] {
    return ['nginx', 'postgres', 'redis'];
  }

  getTemplateDisplayName(templateName: string): string {
    const names: { [key: string]: string } = {
      'nginx': 'Nginx',
      'postgres': 'PostgreSQL',
      'redis': 'Redis'
    };
    return names[templateName] || templateName;
  }

  getTemplateIcon(templateName: string): string {
    // Return icon name for use in template
    return templateName;
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
      const config = this.dockerComposeService.generateDockerComposeConfigFromServices(this.services);
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
      const config = this.dockerComposeService.generateDockerComposeConfigFromServices(this.services);
    this.dockerComposeService.generateAndDownloadFile(config);
      this.analyticsService.trackFileGenerated();
    } catch (error: any) {
      // Show graceful error message instead of crashing
      const errorMessage = error?.message || 'An error occurred while generating the Docker Compose file. Please check your configuration.';
      alert(`Error: ${errorMessage}`);
      console.error('Error generating Docker Compose file:', error);
    } finally {
      this.isGenerating = false;
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

  // Method to handle file selection
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.isImporting = true;
      this.analyticsService.trackFileUploaded();
      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        try {
          const parsedYaml = yaml.load(content) as any;
          this.populateFormFromYaml(parsedYaml);
          // Check for advanced features
          this.checkAdvancedFeatures(parsedYaml);
          // YAML preview will be updated by populateFormFromYaml via updateYamlPreview()
        } catch (error) {
          console.error('Error parsing YAML file:', error);
          alert('Error parsing YAML file. Please ensure it is a valid Docker Compose file.');
        } finally {
          this.isImporting = false;
        }
      };
      reader.onerror = () => {
        this.isImporting = false;
        alert('Error reading file. Please try again.');
      };
      reader.readAsText(file);
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

  // Method to populate form from parsed YAML
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
      labels: {}
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
}
