const wasender = require('./utils/wasender');

async function testQRCodeSending() {
  console.log('Testing QR Code Sending with Text...\n');

  try {
    // Test 1: Test authentication
    console.log('1. Testing authentication...');
    const authTest = await wasender.testAuth();
    if (!authTest.success) {
      console.log('❌ Authentication failed:', authTest.message);
      return;
    }
    console.log('✅ Authentication successful');

    // Test 2: Get all sessions
    console.log('\n2. Getting all sessions...');
    const sessionsResponse = await wasender.getAllSessions();
    if (!sessionsResponse.success) {
      console.log('❌ Failed to get sessions:', sessionsResponse.message);
      return;
    }
    
    const sessions = sessionsResponse.data;
    console.log(`✅ Found ${sessions.length} sessions`);
    
    // Find a connected session
    const connectedSession = sessions.find(s => s.status === 'connected');
    if (!connectedSession) {
      console.log('❌ No connected session found');
      return;
    }
    
    console.log(`✅ Using session: ${connectedSession.name || connectedSession.id}`);
    console.log(`  Phone: ${connectedSession.phone_number}`);
    console.log(`  Status: ${connectedSession.status}`);

    // Test 3: Test QR code sending with text
    console.log('\n3. Testing QR code sending with text...');
    
    const testPhoneNumber = '201156012078@s.whatsapp.net'; // Replace with a test number
    const testStudentCode = 'TEST123';
    const testMessage = `This is your QR Code \n\n Student Code: ${testStudentCode} \n\n Test message with QR code image`;
    
    // Create QR code URL
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(testStudentCode)}`;
    
    console.log('Sending QR code with text to:', testPhoneNumber);
    console.log('QR Code URL:', qrCodeUrl);
    console.log('Message:', testMessage);
    
    const response = await wasender.sendImageMessage(
      connectedSession.api_key,
      testPhoneNumber,
      qrCodeUrl,
      testMessage
    );
    
    if (response.success) {
      console.log('✅ QR code with text sent successfully!');
      console.log('Response:', response.data);
    } else {
      console.log('❌ Failed to send QR code with text:', response.message);
      if (response.error) {
        console.log('Error details:', response.error);
      }
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run the test
testQRCodeSending();
