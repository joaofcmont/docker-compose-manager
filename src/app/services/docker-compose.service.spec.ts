import { TestBed } from '@angular/core/testing';
import { DockerComposeService } from './docker-compose.service';

describe('DockerComposeService', () => {
  let service: DockerComposeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DockerComposeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
