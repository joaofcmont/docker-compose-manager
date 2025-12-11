import { Injectable } from '@angular/core';
import { ComposeGraph, GraphNode, GraphEdge } from '../models/compose-graph.model';
import { ServiceConfig } from '../models/service-config.model';

@Injectable({
  providedIn: 'root'
})
export class GraphService {
  constructor() {}

  // Convert services array to graph structure
  composeToGraph(services: ServiceConfig[]): ComposeGraph {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // Create nodes from services
    services.forEach((service, index) => {
      if (!service.serviceName || !service.serviceName.trim()) {
        return; // Skip invalid services
      }

      const node: GraphNode = {
        id: service.serviceName,
        label: service.serviceName,
        type: 'service',
        data: service,
        position: this.calculateNodePosition(index, services.length)
      };

      nodes.push(node);

      // Create edges from depends_on relationships
      if (service.depends_on && Array.isArray(service.depends_on) && service.depends_on.length > 0) {
        service.depends_on.forEach(dep => {
          if (dep && dep.trim()) {
            edges.push({
              from: service.serviceName,
              to: dep.trim(),
              type: 'depends_on'
            });
          }
        });
      }
    });

    return { nodes, edges };
  }

  // Calculate node position for layout (simple grid layout)
  calculateNodePosition(index: number, total: number): { x: number; y: number } {
    const cols = Math.ceil(Math.sqrt(total));
    const row = Math.floor(index / cols);
    const col = index % cols;
    
    // Spacing: 200px between nodes
    return {
      x: col * 200 + 100,
      y: row * 150 + 100
    };
  }

  // Get service icon for graph visualization
  getServiceIcon(service: ServiceConfig): string {
    const image = (service.dockerImage || '').toLowerCase();
    if (image.includes('nginx')) return '🌐';
    if (image.includes('postgres')) return '🐘';
    if (image.includes('redis')) return '🔴';
    if (image.includes('mysql')) return '🗄️';
    if (image.includes('mongo')) return '🍃';
    return '📦';
  }
}

