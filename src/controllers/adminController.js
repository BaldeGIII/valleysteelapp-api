import { sql } from "../config/db.js";

export async function getAllUsers(req, res) {
    try {
        const { userId } = req.params;
        
        console.log('=== GET ALL USERS REQUEST ===');
        console.log('Requesting user ID:', userId);
        
        // Verify admin status with detailed logging
        console.log('Checking admin status...');
        const adminCheck = await sql`SELECT id, email, role FROM users WHERE id = ${userId}`;
        const adminResult = adminCheck.rows || adminCheck;
        
        console.log('Admin check result:', adminResult);
        console.log('Admin result length:', adminResult.length);
        
        if (!adminResult || adminResult.length === 0) {
            console.log('❌ User not found in database');
            return res.status(403).json({ error: "User not found in database" });
        }
        
        const adminUser = adminResult[0];
        console.log('Found user:', adminUser);
        console.log('User role:', adminUser.role);
        
        if (adminUser.role !== 'admin') {
            console.log('❌ User is not admin, role is:', adminUser.role);
            return res.status(403).json({ error: "Access denied. Admin privileges required." });
        }
        
        console.log('✅ Admin verified, fetching all users...');
        
        // Get all users with inspection counts
        const users = await sql`
            SELECT 
                u.id, 
                u.email, 
                u.role, 
                u.created_at,
                COUNT(i.id) as inspection_count
            FROM users u
            LEFT JOIN vehicle_inspections i ON u.id = i.user_id
            GROUP BY u.id, u.email, u.role, u.created_at
            ORDER BY u.created_at DESC
        `;
        
        const userResults = users.rows || users;
        console.log('Found users:', userResults.length);
        console.log('Users data:', userResults);
        
        res.status(200).json(userResults);
        
    } catch (error) {
        console.error("❌ Error fetching users:", error);
        res.status(500).json({ error: "Internal server error: " + error.message });
    }
}

export async function updateUserRole(req, res) {
    try {
        console.log('=== UPDATE USER ROLE REQUEST ===');
        const { userId } = req.params; // User to update
        const { adminUserId, newRole } = req.body; // Admin making the change and new role
        
        console.log('Admin user:', adminUserId);
        console.log('Target user:', userId);
        console.log('New role:', newRole);
        
        if (!userId || !adminUserId || !newRole) {
            return res.status(400).json({ error: "Missing required parameters" });
        }
        
        if (!['user', 'admin'].includes(newRole)) {
            return res.status(400).json({ error: "Invalid role. Must be 'user' or 'admin'" });
        }
        
        // Verify admin status of the person making the change
        const adminCheck = await sql`SELECT role FROM users WHERE id = ${adminUserId}`;
        const adminResult = adminCheck.rows || adminCheck;
        if (!adminResult || adminResult.length === 0 || adminResult[0]?.role !== 'admin') {
            return res.status(403).json({ error: "Access denied. Admin privileges required." });
        }
        
        // Check if target user exists
        const targetUserCheck = await sql`SELECT id, email, role FROM users WHERE id = ${userId}`;
        const targetUserResult = targetUserCheck.rows || targetUserCheck;
        if (!targetUserResult || targetUserResult.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }
        
        const targetUser = targetUserResult[0];
        
        // Prevent admin from demoting themselves (safety check)
        if (adminUserId === userId && newRole !== 'admin') {
            return res.status(400).json({ error: "You cannot remove your own admin privileges" });
        }
        
        // Update the user's role
        const updateResult = await sql`
            UPDATE users 
            SET role = ${newRole}
            WHERE id = ${userId}
            RETURNING id, email, role
        `;
        
        const updatedUser = updateResult.rows?.[0] || updateResult[0];
        
        console.log('✅ User role updated successfully:', updatedUser);
        
        res.status(200).json({ 
            message: `User role updated successfully from '${targetUser.role}' to '${newRole}'`, 
            user: updatedUser
        });
        
    } catch (error) {
        console.error("❌ Error updating user role:", error);
        res.status(500).json({ error: "Internal server error: " + error.message });
    }
}

export async function promoteUserToAdmin(req, res) {
    try {
        const { userEmail } = req.body;
        const { adminUserId } = req.body;
        
        console.log('=== PROMOTE USER TO ADMIN ===');
        console.log('Admin user:', adminUserId);
        console.log('Target email:', userEmail);
        
        if (!userEmail || !adminUserId) {
            return res.status(400).json({ error: "Missing user email or admin user ID" });
        }
        
        // Verify admin status
        const adminCheck = await sql`SELECT role FROM users WHERE id = ${adminUserId}`;
        const adminResult = adminCheck.rows || adminCheck;
        if (!adminResult || adminResult.length === 0 || adminResult[0]?.role !== 'admin') {
            return res.status(403).json({ error: "Access denied. Admin privileges required." });
        }
        
        // Try multiple approaches to find the user
        console.log('🔍 Searching for user with multiple methods...');
        
        // Method 1: Find by exact email match
        let userCheck = await sql`SELECT id, email, role FROM users WHERE email = ${userEmail}`;
        let userResult = userCheck.rows || userCheck;
        console.log('Method 1 - Exact email match:', userResult);
        
        // Method 2: Find by case-insensitive email match
        if (!userResult || userResult.length === 0) {
            userCheck = await sql`SELECT id, email, role FROM users WHERE LOWER(email) = LOWER(${userEmail})`;
            userResult = userCheck.rows || userCheck;
            console.log('Method 2 - Case-insensitive email match:', userResult);
        }
        
        // Method 3: Find by ID that matches email (sometimes Clerk ID is used as both ID and email)
        if (!userResult || userResult.length === 0) {
            userCheck = await sql`SELECT id, email, role FROM users WHERE id = ${userEmail}`;
            userResult = userCheck.rows || userCheck;
            console.log('Method 3 - ID matches email:', userResult);
        }
        
        // Method 4: Find by partial email match (in case there are formatting differences)
        if (!userResult || userResult.length === 0) {
            userCheck = await sql`SELECT id, email, role FROM users WHERE email ILIKE ${'%' + userEmail + '%'}`;
            userResult = userCheck.rows || userCheck;
            console.log('Method 4 - Partial email match:', userResult);
        }
        
        // If still not found, create a new user record
        if (!userResult || userResult.length === 0) {
            console.log('❌ User not found in database, creating new record...');
            
            try {
                // Generate a temporary user ID based on email
                const tempUserId = userEmail.split('@')[0] + '_' + Date.now();
                
                // Insert new user with email and admin role
                const insertResult = await sql`
                    INSERT INTO users (id, email, role) 
                    VALUES (${tempUserId}, ${userEmail}, 'admin')
                    RETURNING id, email, role
                `;
                
                userResult = insertResult.rows || [insertResult];
                console.log('✅ Created new admin user record:', userResult[0]);
                
                res.status(200).json({ 
                    message: `User ${userEmail} has been created and promoted to admin. They will have admin access when they first log in.`, 
                    user: userResult[0]
                });
                return;
                
            } catch (insertError) {
                console.error('❌ Error creating user record:', insertError);
                return res.status(500).json({ 
                    error: "Failed to create user record: " + insertError.message 
                });
            }
        }
        
        const targetUser = userResult[0];
        console.log('Found target user:', targetUser);
        
        if (targetUser.role === 'admin') {
            return res.status(400).json({ error: "User is already an admin" });
        }
        
        // Promote existing user to admin - use multiple update methods
        console.log('📝 Promoting user to admin...');
        
        let updateResult;
        
        // Try updating by ID first
        try {
            updateResult = await sql`
                UPDATE users 
                SET role = 'admin'
                WHERE id = ${targetUser.id}
                RETURNING id, email, role
            `;
        } catch (updateError) {
            console.log('Update by ID failed, trying by email...');
            // Try updating by email as fallback
            updateResult = await sql`
                UPDATE users 
                SET role = 'admin'
                WHERE email = ${userEmail} OR LOWER(email) = LOWER(${userEmail})
                RETURNING id, email, role
            `;
        }
        
        const updatedUser = updateResult.rows?.[0] || updateResult[0];
        
        if (!updatedUser) {
            console.error('❌ Failed to update user role');
            return res.status(500).json({ error: "Failed to update user role" });
        }
        
        console.log('✅ User promoted to admin:', updatedUser);
        
        res.status(200).json({ 
            message: `User ${userEmail} has been promoted to admin`, 
            user: updatedUser
        });
        
    } catch (error) {
        console.error("❌ Error promoting user to admin:", error);
        res.status(500).json({ error: "Internal server error: " + error.message });
    }
}

// Add this function to your adminController.js
export async function getDefectiveItemsStats(req, res) {
    try {
        const { userId } = req.params;
        
        console.log('=== GET DEFECTIVE ITEMS STATS ===');
        console.log('Admin user:', userId);
        
        // Verify admin status
        const adminCheck = await sql`SELECT role FROM users WHERE id = ${userId}`;
        const adminResult = adminCheck.rows || adminCheck;
        if (!adminResult || adminResult.length === 0 || adminResult[0]?.role !== 'admin') {
            return res.status(403).json({ error: "Access denied. Admin privileges required." });
        }
        
        // Get all inspections with defective items
        const inspections = await sql`
            SELECT 
                defective_items,
                truck_trailer_items
            FROM vehicle_inspections 
            WHERE (defective_items IS NOT NULL AND defective_items != '[]') 
               OR (truck_trailer_items IS NOT NULL AND truck_trailer_items != '[]')
        `;
        
        const inspectionResults = inspections.rows || inspections;
        
        // Process defective items statistics
        const itemCounts = {};
        
        inspectionResults.forEach(inspection => {
            // Process car defective items
            if (inspection.defective_items) {
                let carItems = [];
                try {
                    carItems = typeof inspection.defective_items === 'string' 
                        ? JSON.parse(inspection.defective_items) 
                        : inspection.defective_items;
                } catch (e) {
                    console.log('Error parsing car defective items:', e);
                }
                
                if (Array.isArray(carItems)) {
                    carItems.forEach(item => {
                        const key = `${item}_car`;
                        itemCounts[key] = (itemCounts[key] || 0) + 1;
                    });
                }
            }
            
            // Process truck/trailer defective items
            if (inspection.truck_trailer_items) {
                let truckItems = [];
                try {
                    truckItems = typeof inspection.truck_trailer_items === 'string' 
                        ? JSON.parse(inspection.truck_trailer_items) 
                        : inspection.truck_trailer_items;
                } catch (e) {
                    console.log('Error parsing truck/trailer defective items:', e);
                }
                
                if (Array.isArray(truckItems)) {
                    truckItems.forEach(item => {
                        const key = `${item}_truck`;
                        itemCounts[key] = (itemCounts[key] || 0) + 1;
                    });
                }
            }
        });
        
        // Convert to array and sort by count
        const statsArray = Object.entries(itemCounts).map(([item, count]) => {
            const [label, type] = item.split('_');
            return {
                label: label,
                count: count,
                type: type === 'truck' ? 'truck/trailer' : 'car'
            };
        }).sort((a, b) => b.count - a.count);
        
        console.log('✅ Defective items stats processed:', statsArray.length, 'items');
        res.status(200).json(statsArray);
        
    } catch (error) {
        console.error("❌ Error fetching defective items stats:", error);
        res.status(500).json({ error: "Internal server error: " + error.message });
    }
}

// Add this debug function to your adminController.js
export async function debugUserSearch(req, res) {
    try {
        const { userEmail } = req.body;
        const { adminUserId } = req.body;
        
        console.log('=== DEBUG USER SEARCH ===');
        console.log('Admin user:', adminUserId);
        console.log('Target email:', userEmail);
        
        // Verify admin status
        const adminCheck = await sql`SELECT role FROM users WHERE id = ${adminUserId}`;
        const adminResult = adminCheck.rows || adminCheck;
        if (!adminResult || adminResult.length === 0 || adminResult[0]?.role !== 'admin') {
            return res.status(403).json({ error: "Access denied. Admin privileges required." });
        }
        
        // Get all users for comparison
        const allUsers = await sql`SELECT id, email, role, created_at FROM users ORDER BY created_at DESC`;
        const allUsersResult = allUsers.rows || allUsers;
        
        // Try different search methods
        const exactEmail = await sql`SELECT id, email, role FROM users WHERE email = ${userEmail}`;
        const caseInsensitive = await sql`SELECT id, email, role FROM users WHERE LOWER(email) = LOWER(${userEmail})`;
        const byId = await sql`SELECT id, email, role FROM users WHERE id = ${userEmail}`;
        const partialMatch = await sql`SELECT id, email, role FROM users WHERE email ILIKE ${'%' + userEmail + '%'}`;
        
        const debugInfo = {
            searchEmail: userEmail,
            totalUsers: allUsersResult.length,
            allUsers: allUsersResult,
            searchResults: {
                exactEmail: exactEmail.rows || exactEmail,
                caseInsensitive: caseInsensitive.rows || caseInsensitive,
                byId: byId.rows || byId,
                partialMatch: partialMatch.rows || partialMatch
            }
        };
        
        console.log('Debug info:', JSON.stringify(debugInfo, null, 2));
        res.status(200).json(debugInfo);
        
    } catch (error) {
        console.error("Error in debug search:", error);
        res.status(500).json({ error: error.message });
    }
}

export async function checkAdminStatus(req, res) {
    try {
        const { userId } = req.params;
        
        const result = await sql`
            SELECT role FROM users WHERE id = ${userId}
        `;
        
        const resultRows = result.rows || result;
        const isAdmin = resultRows[0]?.role === 'admin';
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
        const adminResult = adminCheck.rows || adminCheck;
        if (!adminResult || adminResult.length === 0 || adminResult[0]?.role !== 'admin') {
            return res.status(403).json({ error: "Access denied. Admin privileges required." });
        }
        
        const inspections = await sql`
            SELECT vi.*, u.email as user_email 
            FROM vehicle_inspections vi 
            LEFT JOIN users u ON vi.user_id = u.id 
            ORDER BY vi.created_at DESC
        `;
        
        const inspectionResults = inspections.rows || inspections;
        res.status(200).json(inspectionResults);
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
        const adminResult = adminCheck.rows || adminCheck;
        
        if (!adminResult || adminResult.length === 0 || adminResult[0]?.role !== 'admin') {
            console.log('❌ Access denied - not admin');
            return res.status(403).json({ error: "Access denied. Admin privileges required." });
        }
        
        console.log('✅ Admin verified, updating inspection:', id);
        console.log('Update data:', updateData);
        
        // First get the current inspection
        const currentInspection = await sql`
            SELECT * FROM vehicle_inspections WHERE id = ${id}
        `;
        
        const currentResult = currentInspection.rows || currentInspection;
        
        if (!currentResult || currentResult.length === 0) {
            console.log('❌ Inspection not found');
            return res.status(404).json({ error: "Inspection not found" });
        }
        
        const current = currentResult[0];
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
        
        const updateResult = result.rows || result;
        console.log('Update result:', updateResult);
        console.log('✅ Inspection updated successfully');
        
        res.status(200).json({ 
            message: "Inspection updated successfully", 
            inspection: updateResult[0]
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
        const adminResult = adminCheck.rows || adminCheck;
        if (!adminResult || adminResult.length === 0 || adminResult[0]?.role !== 'admin') {
            return res.status(403).json({ error: "Access denied. Admin privileges required." });
        }

        const result = await sql`
            DELETE FROM vehicle_inspections WHERE id = ${id} RETURNING *
        `;

        const deleteResult = result.rows || result;
        if (!deleteResult || deleteResult.length === 0) {
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
        const adminResult = adminCheck.rows || adminCheck;
        if (!adminResult || adminResult.length === 0 || adminResult[0]?.role !== 'admin') {
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

        const statsResult = stats.rows || stats;
        res.status(200).json(statsResult[0]);
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
        const adminResult = adminCheck.rows || adminCheck;
        if (!adminResult || adminResult.length === 0 || adminResult[0]?.role !== 'admin') {
            return res.status(403).json({ error: "Access denied. Admin privileges required." });
        }
        
        const result = await sql`
            SELECT vi.*, u.email as user_email 
            FROM vehicle_inspections vi 
            LEFT JOIN users u ON vi.user_id = u.id 
            WHERE vi.id = ${id}
        `;
        
        const inspectionResult = result.rows || result;
        if (!inspectionResult || inspectionResult.length === 0) {
            return res.status(404).json({ error: "Inspection not found" });
        }
        
        res.status(200).json(inspectionResult[0]);
    } catch (error) {
        console.error("Error fetching single inspection:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}