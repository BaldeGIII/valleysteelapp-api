import { sql } from './src/config/db.js';

async function testVehicleOrganizationFields() {
    try {
        console.log('🔍 Testing vehicle organization fields in inspection_images table...');
        
        // Check if the new columns exist
        const result = await sql`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'inspection_images' 
            AND column_name IN ('vehicle_id', 'vehicle_folder', 'context_metadata')
            ORDER BY column_name
        `;
        
        const columns = result.rows || result;
        console.log('📋 Found vehicle organization columns:', columns);
        
        if (columns.length === 3) {
            console.log('✅ All vehicle organization fields are present');
            console.log('🚗 vehicle_id:', columns.find(c => c.column_name === 'vehicle_id'));
            console.log('📁 vehicle_folder:', columns.find(c => c.column_name === 'vehicle_folder'));
            console.log('📝 context_metadata:', columns.find(c => c.column_name === 'context_metadata'));
        } else {
            console.log('❌ Missing vehicle organization fields');
        }
        
        return columns.length === 3;
    } catch (error) {
        console.error('❌ Test failed:', error);
        return false;
    }
}

testVehicleOrganizationFields()
    .then((success) => {
        if (success) {
            console.log('🎉 Vehicle organization setup is ready!');
        } else {
            console.log('⚠️ Vehicle organization setup needs attention');
        }
        process.exit(success ? 0 : 1);
    })
    .catch((error) => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    });
