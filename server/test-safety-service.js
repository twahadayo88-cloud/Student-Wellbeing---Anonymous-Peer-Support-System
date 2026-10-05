require('dotenv').config();

const {
  monitorContent
} = require('./src/modules/safety/safety.service');


async function runTest() {

  console.log('\n========================================');
  console.log('PeerBridge Safety Service Test');
  console.log('========================================\n');


  const tests = [
    {
      name: 'Normal academic message',
      text: 'Can you explain this programming concept to me?',
      type: 'message'
    },

    {
      name: 'Normal Roman Urdu academic message',
      text: 'mujhe ye programming ka concept samjha do',
      type: 'message'
    },

    {
      name: 'English insult',
      text: 'you are stupid',
      type: 'message'
    },

    {
      name: 'Roman Urdu insult',
      text: 'tum bilkul bewakoof ho',
      type: 'message'
    },

    {
      name: 'Threat',
      text: 'I will kill you',
      type: 'message'
    }
  ];


  // IMPORTANT:
  // Use an existing valid PeerBridge user ID
  // from your database for this test.
  const TEST_USER_ID = 1;


  for (const test of tests) {

    console.log('\n----------------------------------------');
    console.log(`Test: ${test.name}`);
    console.log(`Text: ${test.text}`);
    console.log('----------------------------------------');


    try {

      const result = await monitorContent(
        test.text,
        test.type,
        TEST_USER_ID,
        null
      );

      console.log('Final Result:');
      console.log(result);

    } catch (error) {

      console.error(
        'Test failed:',
        error.message
      );
    }
  }


  console.log('\n========================================');
  console.log('Safety Service Test Finished');
  console.log('========================================\n');
}


runTest();