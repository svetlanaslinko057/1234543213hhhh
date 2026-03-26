import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { ApiRegistryController } from './api-registry.controller';
import { Schema } from 'mongoose';

// Schemas
const ProxySchema = new Schema({
  host: String,
  httpPort: Number,
  socks5Port: Number,
  username: String,
  password: String,
  active: { type: Boolean, default: true },
  created_at: Date,
  updated_at: Date,
});

const ApiKeySchema = new Schema({
  name: String,
  key: String,
  provider: String,
  active: { type: Boolean, default: true },
  created_at: Date,
  updated_at: Date,
});

const LlmKeySchema = new Schema({
  name: String,
  key: String,
  provider: String,
  active: { type: Boolean, default: true },
  created_at: Date,
  updated_at: Date,
});

const ApiRegistrySchema = new Schema({
  method: String,
  path: String,
  summary: String,
  category: String,
  tags: [String],
  source_file: String,
  status: String,
  priority: String,
  working: { type: Boolean, default: null },
  implemented: { type: Boolean, default: false },
  notes: String,
  last_tested: Date,
  test_results: [Schema.Types.Mixed],
  created_at: Date,
  updated_at: Date,
}, { strict: false, collection: 'api_endpoints_registry' });

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'admin_proxies', schema: ProxySchema },
      { name: 'admin_api_keys', schema: ApiKeySchema },
      { name: 'admin_llm_keys', schema: LlmKeySchema },
      { name: 'api_endpoints_registry', schema: ApiRegistrySchema },
    ]),
  ],
  controllers: [AdminController, ApiRegistryController],
  exports: [],
})
export class AdminModule {}
