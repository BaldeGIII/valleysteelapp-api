import { sql } from "../config/db.js";

// Check if user is admin
export async function checkAdminStatus(req, res) {
    try {
        const { userId } = req.params;
        
        const result = await sql`
            SELECT role FROM users WHERE id = ${userId}
        `;
        
        const isAdmin = result.rows?.[0]?.role === 'admin';
        res.status(200).json({ isAdmin });
    } catch (error) {
        console.error("Error checking admin status:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

// Get all inspections for admin
export async function getAllInspections(req, res) {
    try {
        const { userId } = req.params;
        
        // Verify admin status
        const adminCheck = await sql`SELECT role FROM users WHERE id = ${userId}`;
        if (adminCheck.rows?.[0]?.role !== 'admin') {
            return res.status(403).json({ error: "Access denied. Admin privileges required." });
        }
        
        const inspections = await sql`
            SELECT vi.*, u.email as user_email 
            FROM vehicle_inspections vi 
            LEFT JOIN users u ON vi.user_id = u.id 
            ORDER BY vi.created_at DESC
        `;
        
        res.status(200).json(inspections.rows || inspections);
    } catch (error) {
        console.error("Error fetching all inspections:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

// Update inspection (admin only)
export async function updateInspection(req, res) {
    try {
        console.log('=== ADMIN UPDATE INSPECTION REQUEST ===');
        console.log('Params:', req.params);
        console.log('Body:', req.body);
        
        const { id } = req.params;
        const { adminUserId, ...updateData } = req.body;
        
        if (!id || !adminUserId) {
            console.log('❌ Missing required parameters');
            return res.status(400).json({ error: "Missing inspection ID or admin user ID" });
        }
        
        // Verify admin status
        console.log('Checking admin status for user:', adminUserId);
        const adminCheck = await sql`SELECT role FROM users WHERE id = ${adminUserId}`;
        console.log('Admin check result:', adminCheck.rows);
        
        if (adminCheck.rows?.length === 0 || adminCheck.rows?.[0]?.role !== 'admin') {
            console.log('❌ Access denied - not admin');
            return res.status(403).json({ error: "Access denied. Admin privileges required." });
        }
        
        console.log('✅ Admin verified, updating inspection:', id);
        console.log('Update data:', updateData);
        
        // Build the update query dynamically
        const updateFields = [];
        const updateValues = [];
        let paramIndex = 1;
        
        // Handle each field that might be updated
        if (updateData.location !== undefined) {
            updateFields.push(`location = $${paramIndex}`);
            updateValues.push(updateData.location);
            paramIndex++;
        }
        
        if (updateData.date !== undefined) {
            updateFields.push(`date = $${paramIndex}`);
            updateValues.push(updateData.date);
            paramIndex++;
        }
        
        if (updateData.time !== undefined) {
            updateFields.push(`time = $${paramIndex}`);
            updateValues.push(updateData.time);
            paramIndex++;
        }
        
        if (updateData.vehicle !== undefined) {
            updateFields.push(`vehicle = $${paramIndex}`);
            updateValues.push(updateData.vehicle);
            paramIndex++;
        }
        
        if (updateData.speedometer_reading !== undefined) {
            updateFields.push(`speedometer_reading = $${paramIndex}`);
            updateValues.push(updateData.speedometer_reading);
            paramIndex++;
        }
        
        if (updateData.defective_items !== undefined) {
            updateFields.push(`defective_items = $${paramIndex}`);
            updateValues.push(JSON.stringify(updateData.defective_items));
            paramIndex++;
        }
        
        if (updateData.truck_trailer_items !== undefined) {
            updateFields.push(`truck_trailer_items = $${paramIndex}`);
            updateValues.push(JSON.stringify(updateData.truck_trailer_items));
            paramIndex++;
        }
        
        if (updateData.trailer_number !== undefined) {
            updateFields.push(`trailer_number = $${paramIndex}`);
            updateValues.push(updateData.trailer_number);
            paramIndex++;
        }
        
        if (updateData.remarks !== undefined) {
            updateFields.push(`remarks = $${paramIndex}`);
            updateValues.push(updateData.remarks);
            paramIndex++;
        }
        
        if (updateData.condition_satisfactory !== undefined) {
            updateFields.push(`condition_satisfactory = $${paramIndex}`);
            updateValues.push(updateData.condition_satisfactory);
            paramIndex++;
        }
        
        if (updateData.driver_signature !== undefined) {
            updateFields.push(`driver_signature = $${paramIndex}`);
            updateValues.push(updateData.driver_signature);
            paramIndex++;
        }
        
        if (updateData.defects_corrected !== undefined) {
            updateFields.push(`defects_corrected = $${paramIndex}`);
            updateValues.push(updateData.defects_corrected);
            paramIndex++;
        }
        
        if (updateData.defects_need_correction !== undefined) {
            updateFields.push(`defects_need_correction = $${paramIndex}`);
            updateValues.push(updateData.defects_need_correction);
            paramIndex++;
        }
        
        if (updateData.mechanic_signature !== undefined) {
            updateFields.push(`mechanic_signature = $${paramIndex}`);
            updateValues.push(updateData.mechanic_signature);
            paramIndex++;
        }
        
        // Always update the updated_at timestamp
        updateFields.push(`updated_at = $${paramIndex}`);
        updateValues.push(new Date().toISOString());
        paramIndex++;
        
        // Add the inspection ID for the WHERE clause
        updateValues.push(id);
        
        if (updateFields.length === 1) { // Only updated_at was added
            return res.status(400).json({ error: "No fields to update" });
        }
        
        const updateQuery = `
            UPDATE vehicle_inspections 
            SET ${updateFields.join(', ')} 
            WHERE id = $${paramIndex}
            RETURNING *
        `;
        
        console.log('Update query:', updateQuery);
        console.log('Update values:', updateValues);
        
        const result = await sql.unsafe(updateQuery, updateValues);
        
        console.log('Update result:', result.rows);
        
        if (result.rows?.length === 0) {
            console.log('❌ Inspection not found');
            return res.status(404).json({ error: "Inspection not found" });
        }
        
        console.log('✅ Inspection updated successfully');
        res.status(200).json({ 
            message: "Inspection updated successfully", 
            inspection: result.rows[0] 
        });
        
    } catch (error) {
        console.error("❌ Error updating inspection:", error);
        res.status(500).json({ error: "Internal server error: " + error.message });
    }
}

// Delete inspection (admin only)
export async function adminDeleteInspection(req, res) {
    try {
        const { id } = req.params;
        const { adminUserId } = req.body;
        
        // Verify admin status
        const adminCheck = await sql`SELECT role FROM users WHERE id = ${adminUserId}`;
        if (adminCheck.rows?.[0]?.role !== 'admin') {
            return res.status(403).json({ error: "Access denied. Admin privileges required." });
        }

        const result = await sql`
            DELETE FROM vehicle_inspections WHERE id = ${id} RETURNING *
        `;

        if (result.rows?.length === 0) {
            return res.status(404).json({ error: "Inspection not found" });
        }

        res.status(200).json({ message: "Inspection deleted successfully" });
    } catch (error) {
        console.error("Error deleting inspection:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

// Get inspection statistics
export async function getInspectionStats(req, res) {
    try {
        const { userId } = req.params;
        
        // Verify admin status
        const adminCheck = await sql`SELECT role FROM users WHERE id = ${userId}`;
        if (adminCheck.rows?.[0]?.role !== 'admin') {
            return res.status(403).json({ error: "Access denied. Admin privileges required." });
        }

        const stats = await sql`
            SELECT 
                COUNT(*) as total_inspections,
                COUNT(CASE WHEN condition_satisfactory = true THEN 1 END) as satisfactory_count,
                COUNT(CASE WHEN condition_satisfactory = false THEN 1 END) as unsatisfactory_count,
                COUNT(CASE WHEN defects_need_correction = true THEN 1 END) as needs_correction_count,
                COUNT(DISTINCT user_id) as total_users,
                COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as today_inspections
            FROM vehicle_inspections
        `;

        res.status(200).json(stats.rows?.[0] || stats[0]);
    } catch (error) {
        console.error("Error getting inspection stats:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function getAdminSingleInspection(req, res) {
    try {
        const { id } = req.params;
        const { adminUserId } = req.body;
        
        // Verify admin status
        const adminCheck = await sql`SELECT role FROM users WHERE id = ${adminUserId}`;
        if (adminCheck.rows?.[0]?.role !== 'admin') {
            return res.status(403).json({ error: "Access denied. Admin privileges required." });
        }
        
        const result = await sql`
            SELECT vi.*, u.email as user_email 
            FROM vehicle_inspections vi 
            LEFT JOIN users u ON vi.user_id = u.id 
            WHERE vi.id = ${id}
        `;
        
        if (result.rows?.length === 0) {
            return res.status(404).json({ error: "Inspection not found" });
        }
        
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error("Error fetching single inspection:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}