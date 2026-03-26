/**
 * Scheduler Engine Module
 * 
 * BLOCK 1: Full orchestration parity with Python
 * 
 * Features:
 * - Tier-based scheduling (T1=10m, T2=15m, T3=30m, T4=3h)
 * - Dependency chains (funding → entities → graph)
 * - Concurrency pools (rss, browser, graph, heavy)
 * - Manual override (force run, skip deps, maintenance mode)
 */

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';
import { SchedulerService } from './scheduler.service';
import { SchedulerRegistry } from './scheduler.registry';
import { SchedulerExecutor } from './scheduler.executor';
import { SchedulerController } from './scheduler.controller';

const FlexibleSchema = new MongooseSchema({}, { strict: false, timestamps: true });

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'scheduler_jobs', schema: FlexibleSchema },
      { name: 'scheduler_runs', schema: FlexibleSchema },
      { name: 'scheduler_locks', schema: FlexibleSchema },
    ]),
  ],
  controllers: [SchedulerController],
  providers: [SchedulerService, SchedulerRegistry, SchedulerExecutor],
  exports: [SchedulerService, SchedulerRegistry],
})
export class SchedulerModule {}
