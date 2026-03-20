import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World! NestJS + Prisma + PostgreSQL + GraphQL is ready!';
  }
}
