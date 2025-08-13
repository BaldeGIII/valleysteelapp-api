import { sql } from "../config/db.js";

export async function getDefectiveItemsStats(req, res) {
    try {
        console.log('=== GET COMBINED DEFECTIVE ITEMS STATS ===');
        const { userId } = req.params;
        console.log('Fetching combined defective items stats for admin userId:', userId);
        
        // Verify admin status
        const adminCheck = await sql`SELECT role FROM users WHERE id = ${userId}`;
        if (adminCheck.rows?.[0]?.role !== 'admin') {
            console.log('Access denied - not admin');
            return res.status(403).json({ error: "Access denied. Admin privileges required." });
        }

        // Get all inspections with defective items or truck/trailer items
        const inspections = await sql`
            SELECT defective_items, truck_trailer_items
            FROM vehicle_inspections 
            WHERE (defective_items IS NOT NULL AND defective_items != '{}' AND defective_items != 'null' AND defective_items != '')
            OR (truck_trailer_items IS NOT NULL AND truck_trailer_items != '{}' AND truck_trailer_items != 'null' AND truck_trailer_items != '')
        `;

        console.log(`Found ${inspections.rows?.length || 0} inspections with defective items`);

        // Combined count for all items
        const combinedItemCounts = {};
        
        inspections.rows?.forEach(inspection => {
            // Process car defective items
            if (inspection.defective_items) {
                try {
                    let defectiveItems;
                    
                    if (typeof inspection.defective_items === 'string') {
                        defectiveItems = JSON.parse(inspection.defective_items);
                    } else if (typeof inspection.defective_items === 'object') {
                        defectiveItems = inspection.defective_items;
                    }
                    
                    if (defectiveItems && typeof defectiveItems === 'object') {
                        Object.entries(defectiveItems).forEach(([itemKey, isSelected]) => {
                            if (isSelected === true || isSelected === 'true') {
                                combinedItemCounts[itemKey] = (combinedItemCounts[itemKey] || 0) + 1;
                            }
                        });
                    }
                } catch (error) {
                    console.error('Error parsing defective items:', error);
                }
            }

            // Process truck/trailer items
            if (inspection.truck_trailer_items) {
                try {
                    let truckTrailerItems;
                    
                    if (typeof inspection.truck_trailer_items === 'string') {
                        truckTrailerItems = JSON.parse(inspection.truck_trailer_items);
                    } else if (typeof inspection.truck_trailer_items === 'object') {
                        truckTrailerItems = inspection.truck_trailer_items;
                    }
                    
                    if (truckTrailerItems && typeof truckTrailerItems === 'object') {
                        Object.entries(truckTrailerItems).forEach(([itemKey, isSelected]) => {
                            if (isSelected === true || isSelected === 'true') {
                                // Add prefix to distinguish truck/trailer items
                                const prefixedKey = `trailer_${itemKey}`;
                                combinedItemCounts[prefixedKey] = (combinedItemCounts[prefixedKey] || 0) + 1;
                            }
                        });
                    }
                } catch (error) {
                    console.error('Error parsing truck trailer items:', error);
                }
            }
        });

        // Convert combined items to array format for chart
        const combinedChartData = Object.entries(combinedItemCounts)
            .map(([itemKey, count]) => {
                // Determine if it's a car or truck/trailer item
                const isTrailerItem = itemKey.startsWith('trailer_');
                const cleanKey = isTrailerItem ? itemKey.replace('trailer_', '') : itemKey;
                
                return {
                    itemKey: cleanKey,
                    originalKey: itemKey,
                    count,
                    type: isTrailerItem ? 'truck/trailer' : 'car',
                    label: cleanKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                };
            })
            .sort((a, b) => b.count - a.count); // Sort by frequency

        console.log('Combined chart data:', combinedChartData);
        
        res.status(200).json(combinedChartData);
    } catch (error) {
        console.error("Error getting combined defective items stats:", error);
        res.status(500).json({ error: "Internal server error: " + error.message });
    }
}

// ... rest of your existing functions remain the same
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
        console.log('Admin check result:', adminCheck);
        
        if (adminCheck.rows?.[0]?.role !== 'admin') {
            console.log('❌ Access denied - not admin');
            return res.status(403).json({ error: "Access denied. Admin privileges required." });
        }
        
        console.log('✅ Admin verified, updating inspection:', id);
        console.log('Update data:', updateData);
        
        // First get the current inspection
        const currentInspection = await sql`
            SELECT * FROM vehicle_inspections WHERE id = ${id}
        `;
        
        console.log('Current inspection query result:', currentInspection);
        
        if (!currentInspection.rows || currentInspection.rows.length === 0) {
            console.log('❌ Inspection not found');
            return res.status(404).json({ error: "Inspection not found" });
        }
        
        const current = currentInspection.rows[0];
        console.log('Current inspection data:', current);
        
        // Update with new values or keep existing ones
        const result = await sql`
            UPDATE vehicle_inspections 
            SET 
                location = ${updateData.location !== undefined ? updateData.location : current.location},
                date = ${updateData.date !== undefined ? updateData.date : current.date},
                time = ${updateData.time !== undefined ? updateData.time : current.time},
                vehicle = ${updateData.vehicle !== undefined ? updateData.vehicle : current.vehicle},
                speedometer_reading = ${updateData.speedometer_reading !== undefined ? updateData.speedometer_reading : current.speedometer_reading},
                defective_items = ${updateData.defective_items !== undefined ? JSON.stringify(updateData.defective_items) : current.defective_items},
                truck_trailer_items = ${updateData.truck_trailer_items !== undefined ? JSON.stringify(updateData.truck_trailer_items) : current.truck_trailer_items},
                trailer_number = ${updateData.trailer_number !== undefined ? updateData.trailer_number : current.trailer_number},
                remarks = ${updateData.remarks !== undefined ? updateData.remarks : current.remarks},
                condition_satisfactory = ${updateData.condition_satisfactory !== undefined ? updateData.condition_satisfactory : current.condition_satisfactory},
                driver_signature = ${updateData.driver_signature !== undefined ? updateData.driver_signature : current.driver_signature},
                defects_corrected = ${updateData.defects_corrected !== undefined ? updateData.defects_corrected : current.defects_corrected},
                defects_need_correction = ${updateData.defects_need_correction !== undefined ? updateData.defects_need_correction : current.defects_need_correction},
                mechanic_signature = ${updateData.mechanic_signature !== undefined ? updateData.mechanic_signature : current.mechanic_signature}
            WHERE id = ${id}
            RETURNING *
        `;
        
        console.log('Update result:', result);
        console.log('✅ Inspection updated successfully');
        
        res.status(200).json({ 
            message: "Inspection updated successfully", 
            inspection: result.rows?.[0] || result[0]
        });
        
    } catch (error) {
        console.error("❌ Error updating inspection:", error);
        res.status(500).json({ error: "Internal server error: " + error.message });
    }
}

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