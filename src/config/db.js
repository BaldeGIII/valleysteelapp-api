import { sql } from '@vercel/postgres';
import 'dotenv/config';

async function initDB() {
    try {
        console.log('Initializing database...');
        
        // Create users table for admin roles
        await sql`CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(255) PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            role VARCHAR(50) DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        // RESTORE YOUR ADMIN ACCESS - Multiple approaches to ensure it works
        const yourClerkUserId = "user_30yBMfBIYMUv07iT9jOhhVqsfxN";
        const yourEmail = "baldemarguajardo20@gmail.com";
        
        console.log('🔧 Restoring admin access...');
        
        // First, delete any conflicting records to start fresh
        await sql`DELETE FROM users WHERE email = ${yourEmail}`;
        await sql`DELETE FROM users WHERE id = ${yourClerkUserId}`;
        
        // Now insert your admin record fresh
        await sql`INSERT INTO users (id, email, role) 
                  VALUES (${yourClerkUserId}, ${yourEmail}, 'admin')
                  ON CONFLICT (id) DO UPDATE SET 
                  email = EXCLUDED.email, 
                  role = 'admin'`;
        
        // Also add a backup record with just email as ID (in case Clerk ID is different)
        await sql`INSERT INTO users (id, email, role) 
                  VALUES (${yourEmail}, ${yourEmail}, 'admin')
                  ON CONFLICT (id) DO UPDATE SET 
                  role = 'admin'`;
        
        console.log(`✅ Admin access restored for ${yourEmail}`);
        console.log(`✅ Clerk ID: ${yourClerkUserId}`);
        
        // Verify the admin was created
        const adminCheck = await sql`SELECT id, email, role FROM users WHERE email = ${yourEmail} OR id = ${yourClerkUserId}`;
        console.log('📋 Admin users found:', adminCheck.rows || adminCheck);

        // Create vehicle_inspections table
        await sql`CREATE TABLE IF NOT EXISTS vehicle_inspections (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL,
            location VARCHAR(255),
            date DATE NOT NULL DEFAULT CURRENT_DATE,
            time VARCHAR(50),
            vehicle VARCHAR(255),
            speedometer_reading VARCHAR(50),
            defective_items JSONB,
            truck_trailer_items JSONB,
            trailer_number VARCHAR(100),
            remarks TEXT,
            condition_satisfactory BOOLEAN DEFAULT true,
            driver_signature VARCHAR(255),
            defects_corrected BOOLEAN DEFAULT false,
            defects_need_correction BOOLEAN DEFAULT false,
            mechanic_signature VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_by VARCHAR(255)
        )`;

        console.log("✅ Database initialized successfully.");
    } catch (error) {
        console.error("❌ Error initializing database:", error);
        
        // Emergency admin restore - try alternative methods
        try {
            console.log('🚨 Emergency admin restore...');
            const yourEmail = "baldemarguajardo20@gmail.com";
            
            // Try to find any existing user with this email
            const existingUsers = await sql`SELECT * FROM users WHERE email ILIKE ${yourEmail}`;
            console.log('Found existing users:', existingUsers.rows || existingUsers);
            
            // Force update any user with this email to admin
            await sql`UPDATE users SET role = 'admin' WHERE email ILIKE ${yourEmail}`;
            
            // Also try with the Clerk ID
            await sql`UPDATE users SET role = 'admin' WHERE id = 'user_30yBMfBIYMUv07iT9jOhhVqsfxN'`;
            
            console.log('🆘 Emergency admin restore attempted');
        } catch (emergencyError) {
            console.error('❌ Emergency restore failed:', emergencyError);
        }
        
        // Don't exit the process, let it continue
    }
}

export { sql, initDB };