import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { WsAdapter } from '@nestjs/platform-ws';
import { ConsoleLogger } from '@nestjs/common';
import { SnapshotGateway } from './investments/snapshot/snapshot.gateway';
import placeBuyOrder from './investments/bot/actions/placeBuyOrder';
import { registerBinanceRequestLogger } from './investments/utils/binance-request-logger';

const consoleMethods = ['log', 'info', 'warn', 'error', 'debug'] as const;

const registerConsoleTimestamp = () => {
  const originalConsole = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
  };

  const dateFormatter = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'Etc/GMT+6',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const getTimestamp = () => {
    const parts = dateFormatter.formatToParts(new Date());
    const lookup = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    );
    return `${lookup.day}/${lookup.month}/${lookup.year} - ${lookup.hour}:${lookup.minute}:${lookup.second} ${lookup.dayPeriod}`;
  };

  consoleMethods.forEach((method) => {
    console[method] = (...args: unknown[]) => {
      originalConsole[method](`[${getTimestamp()}]`, ...args);
    };
  });
};

async function bootstrap() {
  registerConsoleTimestamp();
  registerBinanceRequestLogger();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    {
      logger: new ConsoleLogger({ timestamp: false }),
    },
  );

  app.useWebSocketAdapter(new WsAdapter(app));

  app.enableCors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  });

  const snapshotGateway = app.get(SnapshotGateway);
  const httpServer = app.getHttpServer();
  snapshotGateway.bindServer(httpServer);

  await app.listen(3000, '0.0.0.0');

  // await placeBuyOrder();
}

bootstrap();
