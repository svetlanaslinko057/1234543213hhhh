/**
 * RootData Module
 * 
 * CRITICAL: Tier 1 source for funds, persons, teams, founders
 * Restored from Python version for graph enrichment
 */

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';
import { RootDataService } from './rootdata.service';
import { RootDataClient } from './rootdata.client';
import { RootDataSyncService } from './rootdata.sync.service';
import { RootDataController } from './rootdata.controller';

const FlexibleSchema = new MongooseSchema({}, { strict: false, timestamps: true });

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'rootdata_projects', schema: FlexibleSchema },
      { name: 'rootdata_funds', schema: FlexibleSchema },
      { name: 'rootdata_people', schema: FlexibleSchema },
      { name: 'rootdata_rounds', schema: FlexibleSchema },
      { name: 'rootdata_links', schema: FlexibleSchema },
    ]),
  ],
  controllers: [RootDataController],
  providers: [RootDataService, RootDataClient, RootDataSyncService],
  exports: [RootDataService, RootDataSyncService],
})
export class RootDataModule {}
