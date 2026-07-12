
import { DataSource } from 'typeorm';
import { SystemSettings } from 'src/system-settings/entities/system-setting.entity';

export async function seedSystemSettings(dataSource: DataSource) {
    const repo = dataSource.getRepository(SystemSettings);

    const defaults = [
        // Platform
        { key: 'COMMISSION_PERCENT', value: '0.05' },

        // Paystack
        { key: 'GATEWAY_PAYSTACK_PERCENT', value: '0.015' },
        { key: 'GATEWAY_PAYSTACK_FLAT_FEE', value: '100' },
        { key: 'GATEWAY_PAYSTACK_CAP', value: '2000' },
        { key: 'GATEWAY_PAYSTACK_MIN_FOR_FLAT', value: '2500' },

        // Flutterwave
        { key: 'GATEWAY_FLUTTERWAVE_PERCENT', value: '0.014' },
        { key: 'GATEWAY_FLUTTERWAVE_CAP', value: '2000' },
        { key: 'GATEWAY_FLUTTERWAVE_FLAT_FEE', value: '0' },
        { key: 'GATEWAY_FLUTTERWAVE_MIN_FOR_FLAT', value: '0' },
    ];

    for (const setting of defaults) {
        // insertOrIgnore — never overwrites values admin has already changed
        const exists = await repo.findOne({ where: { key: setting.key } });
        if (!exists) {
            await repo.save(repo.create(setting));
        }
    }

    console.log('✅ System settings seeded');
}