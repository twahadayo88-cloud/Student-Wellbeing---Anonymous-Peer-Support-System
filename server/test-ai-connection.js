require('dotenv').config();

const {
  analyzeWithLocalModel
} = require('./src/modules/safety/safety.service');


async function runTest() {

  console.log('\n========================================');
  console.log('PeerBridge AI Connection Test');
  console.log('========================================\n');


  const testMessages = [
    'Can you explain this programming concept to me?',
    'mujhe ye programming ka concept samjha do',
    'you are stupid',
    'tum bilkul bewakoof ho'
  ];


  for (const message of testMessages) {

    console.log(`Message: ${message}`);

    try {

      const result =
        await analyzeWithLocalModel(message);

      console.log('Result:', result);

    } catch (error) {

      console.error(
        'Test failed:',
        error.message
      );
    }

    console.log('----------------------------------------');
  }
}


runTest();