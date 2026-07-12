import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSettings } from './entities/system-setting.entity';
import { CreateSystemSettingDto } from './dto/create-system-setting.dto';
import { Category } from 'src/categories/entities/category.entity';

@Injectable()
export class SystemSettingsService {
  constructor(
    @InjectRepository(SystemSettings)
    private settingsRepo: Repository<SystemSettings>,
  ) {}

  // 1. Used by Admin to see all current settings
  async findAll() {
  const settings = await this.settingsRepo.find();

  const result: Record<string, string> = {};

  settings.forEach(setting => {
    result[setting.key] = setting.value;
  });

  return result;
}


  // 2. Used by OrdersService to get a specific value
  // Returns defaultValue if the key hasn't been set in the DB yet
  async getNumber(key: string, defaultValue: number): Promise<number> {
    const setting = await this.settingsRepo.findOne({ where: { key } });
    if (!setting) return defaultValue;
    return parseFloat(setting.value);
  }

  // 3. Used by Admin Dashboard to save everything at once
  async updateBulk(settings: CreateSystemSettingDto ){
    const updatePromises = Object.entries(settings).map(([key, value]) => {
      // Upsert: Create if doesn't exist, update if it does
      return this.settingsRepo.upsert(
        { key, value: String(value) },
        ['key'], // The unique column to check against
      );
    });

    await Promise.all(updatePromises);
    return { message: 'Settings updated successfully' };
  }

  async getEffectiveCommission(category: Category | null): Promise<number> {
  // Tier 1: Category has its own explicit rate
  if (category?.commissionPercent != null) {
    return Number(category.commissionPercent);
  }

  // Tier 2: Check parent category's rate (for sub-categories)
  if (category?.parent?.commissionPercent != null) {
    return Number(category.parent.commissionPercent);
  }

  // Tier 3: Fall back to global platform setting
  return this.getNumber('COMMISSION_PERCENT', 0.05);
}
}