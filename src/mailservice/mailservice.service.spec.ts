import { Test, TestingModule } from '@nestjs/testing';
import { MailserviceService } from './mailservice.service';

describe('MailserviceService', () => {
  let service: MailserviceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MailserviceService],
    }).compile();

    service = module.get<MailserviceService>(MailserviceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
