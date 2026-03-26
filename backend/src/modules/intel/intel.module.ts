import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonModule } from '../../common/common.module';
import { IntelController } from './intel.controller';
import { IntelExtendedController } from './intel-extended.controller';
import { IntelAdminController } from './intel-admin.controller';
import { FundsController } from './funds.controller';
import { PersonsController } from './persons.controller';
import { ProjectsController } from './projects.controller';
import { UnlocksController } from './unlocks.controller';
import { DropstabModule } from './dropstab/dropstab.module';
import { CryptoRankModule } from './cryptorank/cryptorank.module';
import { IcoDropsScraperService } from './icodrops/icodrops-scraper.service';
import { IcoDropsSyncService } from './icodrops/icodrops-sync.service';
import { IcoDropsController } from './icodrops/icodrops.controller';
import {
  ProjectSchema,
  InvestorSchema,
  UnlockSchema,
  FundraisingSchema,
  CategorySchema,
  ActivitySchema,
  FundSchema,
  PersonSchema,
} from './schemas/intel.schemas';
import { Schema } from 'mongoose';

// Proxy Schema for admin
const ProxySchema = new Schema({
  host: String,
  httpPort: Number,
  socks5Port: Number,
  type: String,
  username: String,
  password: String,
  priority: { type: Number, default: 1 },
  active: { type: Boolean, default: true },
  last_used_at: Date,
  avg_latency: Number,
  success_rate: Number,
  created_at: Date,
  updated_at: Date,
});

@Module({
  imports: [
    CommonModule,
    MongooseModule.forFeature([
      { name: 'intel_projects', schema: ProjectSchema },
      { name: 'intel_investors', schema: InvestorSchema },
      { name: 'intel_unlocks', schema: UnlockSchema },
      { name: 'intel_fundraising', schema: FundraisingSchema },
      { name: 'intel_categories', schema: CategorySchema },
      { name: 'intel_activity', schema: ActivitySchema },
      { name: 'intel_funds', schema: FundSchema },
      { name: 'intel_persons', schema: PersonSchema },
      { name: 'intel_launchpads', schema: new Schema({}, { strict: false }) },
      { name: 'intel_market', schema: new Schema({}, { strict: false }) },
      { name: 'intel_icos', schema: new Schema({}, { strict: false }) },
      { name: 'admin_proxies', schema: ProxySchema },
    ]),
    DropstabModule,
    CryptoRankModule,
  ],
  controllers: [
    // High-priority specific controllers first
    FundsController,
    PersonsController,
    ProjectsController,
    UnlocksController,
    // Then generic controllers
    IntelController,
    IntelExtendedController,
    IntelAdminController,
    IcoDropsController,
  ],
  providers: [IcoDropsScraperService, IcoDropsSyncService],
})
export class IntelModule {}
