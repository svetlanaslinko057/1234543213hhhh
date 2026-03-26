import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';

// Modules
import { CommonModule } from './common/common.module';
import { IntelModule } from './modules/intel/intel.module';
import { NewsModule } from './modules/news/news.module';
import { KnowledgeGraphModule } from './modules/knowledge-graph/knowledge-graph.module';
import { SentimentModule } from './modules/sentiment/sentiment.module';
import { MarketGatewayModule } from './modules/market-gateway/market-gateway.module';
import { AdminModule } from './modules/admin/admin.module';
import { ParsersModule } from './parsers/parsers.module';
import { HealthController } from './health.controller';
import { OpenApiController } from './openapi.controller';

// NEW: Sprint 1 modules (restored from Python version)
import { RootDataModule } from './modules/rootdata/rootdata.module';
import { SourceReliabilityModule } from './modules/source-reliability/source-reliability.module';
import { GraphBuildersModule } from './modules/graph-builders/graph-builders.module';

// NEW: Scheduler Engine (Block 1 - Orchestration parity)
import { SchedulerModule } from './modules/scheduler/scheduler.module';

// NEW: Graph Pipeline (Block 5 - Intelligence Engine)
import { GraphPipelineModule } from './modules/graph-pipeline/graph-pipeline.module';

// NEW: News Intelligence (Block 6 - Makes system "live")
import { NewsIntelligenceModule } from './modules/news-intelligence/news-intelligence.module';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    
    // MongoDB
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URL') || 'mongodb://localhost:27017',
        dbName: configService.get<string>('DB_NAME') || 'fomo_market',
      }),
      inject: [ConfigService],
    }),
    
    // Scheduler
    ScheduleModule.forRoot(),
    
    // Common module (Browser service)
    CommonModule,
    
    // Feature modules
    IntelModule,
    NewsModule,
    KnowledgeGraphModule,
    SentimentModule,
    MarketGatewayModule,
    AdminModule,
    
    // New parser architecture with network interception
    ParsersModule,
    
    // Sprint 1: Critical modules restored from Python version
    RootDataModule,
    SourceReliabilityModule,
    GraphBuildersModule,
    
    // Block 1: Scheduler Engine (orchestration parity)
    SchedulerModule,
    
    // Block 5: Graph Pipeline (intelligence engine)
    GraphPipelineModule,
    
    // Block 6: News Intelligence (makes system "live")
    NewsIntelligenceModule,
  ],
  controllers: [HealthController, OpenApiController],
})
export class AppModule {}
