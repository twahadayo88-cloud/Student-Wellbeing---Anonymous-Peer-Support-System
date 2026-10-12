const { query } = require('./src/config/db.config');
const bcrypt = require('bcryptjs');

async function seedData() {
    console.log('🌱 Updating Passwords & Dummy Data...');
    try {
        const hashedPassword = await bcrypt.hash('Password123!', 10);

        // 1. Update existing users or insert new ones
        console.log('1. Resetting passwords for dummy users...');
        await query(`
      INSERT INTO users (id, email, password_hash, role, is_active) 
      VALUES 
        (101, 'student1@peerbridge.edu', '${hashedPassword}', 'student', 1),
        (102, 'student2@peerbridge.edu', '${hashedPassword}', 'student', 1),
        (103, 'faculty1@peerbridge.edu', '${hashedPassword}', 'faculty', 1)
      ON DUPLICATE KEY UPDATE 
        password_hash = VALUES(password_hash),
        is_active = 1;
    `);

        await query(`
      INSERT INTO profiles (user_id, full_name, department, semester, trust_score, onboarding_completed) 
      VALUES
        (101, 'Ali Khan', 'Computer Science', 'Semester 6', 85, 1),
        (102, 'Sara Ahmed', 'Software Engineering', 'Semester 4', 92, 1),
        (103, 'Dr. Usman Raza', 'Computer Science', 'Faculty', 100, 1)
      ON DUPLICATE KEY UPDATE 
        full_name = VALUES(full_name),
        onboarding_completed = 1;
    `);

        // 2. Academic Board Requests
        console.log('2. Seeding Academic Board...');
        await query(`
      INSERT IGNORE INTO academic_requests (id, user_id, title, description, subject, status, tags) VALUES
      (1, 101, 'Need help with Data Structures Trees & Graphs', 'Looking for a peer tutor to explain AVL tree rotations before midterms.', 'Data Structures', 'open', '["Data Structures", "Algorithms", "CS"]'),
      (2, 102, 'Database Normalization BCNF Explanation', 'Can someone help clarify 3NF vs BCNF examples?', 'Database Systems', 'open', '["Database", "SQL", "Study"]');
    `);

        // 3. Notice Board Entries
        console.log('3. Seeding Notice Board...');
        await query(`
      INSERT IGNORE INTO notices (id, title, content, category, author_id, is_active) VALUES
      (1, 'Upcoming AI Workshop on Campus', 'Join us this Friday at 3 PM in Auditorium B for a hands-on session on Machine Learning.', 'Event', 103, 1),
      (2, 'Midterm Examination Schedule Released', 'Please check your portal for updated exam timings and room allocations.', 'Academic', 103, 1);
    `);

        // 4. Resource Library Items
        console.log('4. Seeding Study Resources...');
        await query(`
      INSERT IGNORE INTO resources (id, title, description, category, file_url, uploaded_by) VALUES
      (1, 'Operating Systems Final Exam Prep Notes', 'Comprehensive summary of Memory Management and Process Scheduling.', 'Notes', '/uploads/os_notes.pdf', 101),
      (2, 'Software Engineering Architecture Patterns PDF', 'Guide covering MVC, Microservices, and Layered Architecture.', 'Slides', '/uploads/se_arch.pdf', 102);
    `);

        console.log('✅ Seeding Completed Successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Seeding failed:', err.message);
        process.exit(1);
    }
}

seedData();