import { TestBed } from '@angular/core/testing';

import { PromocartService } from './promocart.service';

describe('PromocartService', () => {
  let service: PromocartService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PromocartService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
