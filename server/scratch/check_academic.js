const { query } = require('../src/config/db.config');

async function check() {
  try {
    const [requests] = await query('SELECT * FROM academic_requests');
    console.log("ACADEMIC REQUESTS:");
    console.log(JSON.stringify(requests, null, 2));
    
    const [profiles] = await query('SELECT * FROM profiles');
    console.log("PROFILES:");
    console.log(JSON.stringify(profiles, null, 2));

    const academicService = require('../src/modules/academic/academic.service');
    const trends = await academicService.getFacultyTrends('Computer Science');
    console.log("TRENDS FOR COMPUTER SCIENCE:");
    console.log(JSON.stringify(trends, null, 2));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
