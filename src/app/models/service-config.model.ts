export interface ServiceConfig {
  serviceName: string;
  dockerImage: string;
  hostPort: string;
  containerPort: string;
  environment: string;
  volumes: string;
  healthCheck: {
    enabled: boolean;
    interval: string;
    timeout: string;
    retries: number;
  };
  resources: {
    cpuLimit: number;
    memoryLimit: number;
  };
  deploy: {
    replicas: number;
  };
  restart: string;
  depends_on: string[];
}

