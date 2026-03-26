import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DropstabController } from './dropstab.controller';
import { DropstabScraperService } from './dropstab-scraper.service';
import { DropstabSyncService } from './dropstab-sync.service';

// Simple schema for all collections
const GenericSchema = {
  key: { type: String, required: true, unique: true },
  source: String,
  updated_at: Date,
};

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'intel_projects', schema: GenericSchema },
      { name: 'intel_unlocks', schema: GenericSchema },
      { name: 'intel_investors', schema: GenericSchema },
      { name: 'intel_fundraising', schema: GenericSchema },
      { name: 'intel_categories', schema: GenericSchema },
      { name: 'intel_activity', schema: GenericSchema },
    ]),
  ],
  controllers: [DropstabController],
  providers: [DropstabScraperService, DropstabSyncService],
  exports: [DropstabScraperService, DropstabSyncService],
})
export class DropstabModule {}
