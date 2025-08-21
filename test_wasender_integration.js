const wasender = require('./utils/wasender');

async function testWasenderIntegration() {
  console.log('Testing Wasender Integration...\n');

  try {
    // Test 1: Test authentication
    console.log('1. Testing authentication...');
    const authTest = await wasender.testAuth();
    if (authTest.success) {
      console.log('✅ Authentication successful');
      console.log('User data:', authTest.data);
    } else {
      console.log('❌ Authentication failed:', authTest.message);
      return;
    }

    // Test 2: Get all sessions
    console.log('\n2. Getting all sessions...');
    const sessions = await wasender.getAllSessions();
    if (sessions.success) {
      console.log('✅ Sessions retrieved successfully');
      console.log('Number of sessions:', sessions.data.length);
      sessions.data.forEach((session, index) => {
        console.log(`  Session ${index + 1}: ${session.name || session.id} (${session.status})`);
      });
    } else {
      console.log('❌ Failed to get sessions:', sessions.message);
      return;
    }

    // Test 3: Test center-specific session finding
    console.log('\n3. Testing center-specific session finding...');
    const centers = ['GTA', 'tagmo3', 'Online'];
    
    for (const center of centers) {
      console.log(`\nTesting center: ${center}`);
      try {
        // Simulate the findWasenderSession function logic
        const sessionsResponse = await wasender.getAllSessions();
        if (sessionsResponse.success) {
          const sessions = sessionsResponse.data;
          let targetSession = null;
          
          // Find session by center name mapping to admin phone numbers
          if (center === 'GTA') {
            targetSession = sessions.find(s => s.phone_number === '+201065057897' || s.phone_number === '01065057897');
          } else if (center === 'tagmo3') {
            targetSession = sessions.find(s => s.phone_number === '+201055640148' || s.phone_number === '01055640148');
          } else if (center === 'Online') {
            targetSession = sessions.find(s => s.phone_number === '+201147929010' || s.phone_number === '01147929010');
          }
          
          if (targetSession) {
            console.log(`✅ Found session for ${center}: ${targetSession.name || targetSession.id}`);
            console.log(`  Phone: ${targetSession.phone_number}`);
            console.log(`  Status: ${targetSession.status}`);
            console.log(`  API Key: ${targetSession.api_key ? 'Present' : 'Missing'}`);
          } else {
            console.log(`❌ No specific session found for ${center}`);
          }
        } else {
          console.log(`❌ Failed to get sessions for ${center}:`, sessionsResponse.message);
        }
      } catch (error) {
        console.log(`❌ Error testing ${center}:`, error.message);
      }
    }

    console.log('\n✅ Wasender integration test completed successfully!');
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run the test
testWasenderIntegration();
