import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

// ═══════════════════════════════════════════════════════════════
// PROJECT SCHEMA
// ═══════════════════════════════════════════════════════════════

@Schema({ collection: 'intel_projects', timestamps: true, strict: false })
export class Project extends Document {
  @Prop({ required: true, unique: true, index: true })
  key: string;

  @Prop()
  source: string;

  @Prop({ index: true })
  slug: string;

  @Prop({ index: true })
  symbol: string;

  @Prop()
  name: string;

  @Prop()
  image: string;

  @Prop()
  price_usd: number;

  @Prop()
  market_cap: number;

  @Prop()
  fully_diluted_valuation: number;

  @Prop()
  total_volume: number;

  @Prop()
  price_change_percentage_24h: number;

  @Prop()
  market_cap_rank: number;

  @Prop()
  category: string;

  @Prop()
  updated_at: Date;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);

// ═══════════════════════════════════════════════════════════════
// INVESTOR SCHEMA
// ═══════════════════════════════════════════════════════════════

@Schema({ collection: 'intel_investors', timestamps: true, strict: false })
export class Investor extends Document {
  @Prop({ required: true, unique: true, index: true })
  key: string;

  @Prop()
  source: string;

  @Prop({ index: true })
  slug: string;

  @Prop()
  name: string;

  @Prop()
  tier: number;

  @Prop()
  type: string;

  @Prop()
  image: string;

  @Prop()
  investments_count: number;

  @Prop()
  website: string;

  @Prop()
  twitter: string;

  @Prop()
  aum: string;

  @Prop()
  updated_at: Date;
}

export const InvestorSchema = SchemaFactory.createForClass(Investor);

// ═══════════════════════════════════════════════════════════════
// UNLOCK SCHEMA
// ═══════════════════════════════════════════════════════════════

@Schema({ collection: 'intel_unlocks', timestamps: true, strict: false })
export class Unlock extends Document {
  @Prop({ required: true, unique: true, index: true })
  key: string;

  @Prop()
  source: string;

  @Prop({ index: true })
  slug: string;

  @Prop()
  symbol: string;

  @Prop()
  name: string;

  @Prop({ index: true })
  unlock_date: string;

  @Prop()
  unlock_percent: number;

  @Prop()
  unlock_usd: number;

  @Prop()
  tokens_amount: number;

  @Prop()
  allocation: string;

  @Prop()
  updated_at: Date;
}

export const UnlockSchema = SchemaFactory.createForClass(Unlock);

// ═══════════════════════════════════════════════════════════════
// FUNDRAISING SCHEMA
// ═══════════════════════════════════════════════════════════════

@Schema({ collection: 'intel_fundraising', timestamps: true, strict: false })
export class Fundraising extends Document {
  @Prop({ required: true, unique: true, index: true })
  key: string;

  @Prop()
  source: string;

  @Prop()
  round_id: string;

  @Prop({ index: true })
  coin_slug: string;

  @Prop()
  symbol: string;

  @Prop()
  name: string;

  @Prop()
  round: string;

  @Prop({ index: true })
  date: string;

  @Prop()
  amount: number;

  @Prop()
  valuation: number;

  @Prop({ type: Object })
  investors: any[];

  @Prop()
  updated_at: Date;
}

export const FundraisingSchema = SchemaFactory.createForClass(Fundraising);

// ═══════════════════════════════════════════════════════════════
// CATEGORY SCHEMA
// ═══════════════════════════════════════════════════════════════

@Schema({ collection: 'intel_categories', timestamps: true, strict: false })
export class Category extends Document {
  @Prop({ required: true, unique: true, index: true })
  key: string;

  @Prop()
  source: string;

  @Prop()
  category_id: string;

  @Prop()
  name: string;

  @Prop({ index: true })
  slug: string;

  @Prop()
  coins_count: number;

  @Prop()
  market_cap: number;

  @Prop()
  updated_at: Date;
}

export const CategorySchema = SchemaFactory.createForClass(Category);

// ═══════════════════════════════════════════════════════════════
// ACTIVITY SCHEMA
// ═══════════════════════════════════════════════════════════════

@Schema({ collection: 'intel_activity', timestamps: true, strict: false })
export class Activity extends Document {
  @Prop({ required: true, unique: true, index: true })
  key: string;

  @Prop()
  source: string;

  @Prop({ index: true })
  type: string;

  @Prop()
  activity_id: string;

  @Prop()
  title: string;

  @Prop()
  description: string;

  @Prop()
  symbol: string;

  @Prop()
  name: string;

  @Prop()
  slug: string;

  @Prop()
  rank: number;

  @Prop()
  price: number;

  @Prop()
  change_24h: number;

  @Prop()
  date: string;

  @Prop()
  exchange: string;

  @Prop()
  status: string;

  @Prop()
  updated_at: Date;
}

export const ActivitySchema = SchemaFactory.createForClass(Activity);

// ═══════════════════════════════════════════════════════════════
// FUND SCHEMA
// ═══════════════════════════════════════════════════════════════

@Schema({ collection: 'intel_funds', timestamps: true, strict: false })
export class Fund extends Document {
  @Prop({ required: true, unique: true, index: true })
  key: string;

  @Prop()
  source: string;

  @Prop({ index: true })
  slug: string;

  @Prop()
  name: string;

  @Prop()
  type: string;

  @Prop()
  tier: number;

  @Prop()
  aum: string;

  @Prop()
  investments_count: number;

  @Prop({ type: [String] })
  portfolio: string[];

  @Prop()
  website: string;

  @Prop()
  twitter: string;

  @Prop()
  updated_at: Date;
}

export const FundSchema = SchemaFactory.createForClass(Fund);

// ═══════════════════════════════════════════════════════════════
// PERSON SCHEMA
// ═══════════════════════════════════════════════════════════════

@Schema({ collection: 'intel_persons', timestamps: true, strict: false })
export class Person extends Document {
  @Prop({ required: true, unique: true, index: true })
  key: string;

  @Prop()
  source: string;

  @Prop({ index: true })
  slug: string;

  @Prop()
  name: string;

  @Prop()
  role: string;

  @Prop({ type: [String] })
  projects: string[];

  @Prop()
  twitter: string;

  @Prop()
  status: string;

  @Prop()
  updated_at: Date;
}

export const PersonSchema = SchemaFactory.createForClass(Person);
