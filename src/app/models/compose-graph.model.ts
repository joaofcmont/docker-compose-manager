import { ServiceConfig } from './service-config.model';

export interface GraphNode {
  id: string; // service name
  label: string;
  type: 'service';
  data: ServiceConfig;
  position?: { x: number; y: number }; // For rendering
}

export interface GraphEdge {
  from: string; // service name
  to: string; // service name
  type: 'depends_on';
}

export interface ComposeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

