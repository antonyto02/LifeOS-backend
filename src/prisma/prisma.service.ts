import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { PrismaClient as PrismaClientType } from '@prisma/client';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PrismaClient } = require('@prisma/client') as {
  PrismaClient: PrismaClientConstructor;
};

type PrismaClientConstructor = new (...args: any[]) => PrismaClientType;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
