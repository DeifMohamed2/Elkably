# Migration from Waziper to Wasender

This document outlines the changes made to migrate from the Waziper WhatsApp API to the Wasender API.

## Changes Made

### 1. Updated `controllers/homeController.js`
- **Import Change**: Replaced `const waziper = require('../utils/waziper')` with `const wasender = require('../utils/wasender')`
- **Instance IDs**: Changed from hardcoded instance IDs to environment variable-based session IDs
- **API Calls**: Updated all WhatsApp API calls to use the Wasender interface

#### Key Function Updates:
- `sendQRCode()`: Now uses `wasender.sendImageMessage()` with proper session API key retrieval
- `send_verification_code()`: Now uses `wasender.sendTextMessage()` with session management
- `forgetPassword_post()`: Now uses `wasender.sendTextMessage()` for password reset links

### 2. Updated `scripts/broadcastOnlineTimings.js`
- **Import Change**: Replaced `const waziper = require('../utils/waziper')` with `const wasender = require('../utils/wasender')`
- **API Calls**: Updated `sendToNumber()` function to use Wasender API with proper session management

### 3. Phone Number Formatting
- **Before**: Phone numbers were formatted as `2011XXXXXXXXX` (without suffix)
- **After**: Phone numbers are formatted as `2011XXXXXXXXX@s.whatsapp.net` (with WhatsApp suffix)

## Environment Variables

No additional environment variables are needed for session management. The system automatically finds the appropriate sessions based on admin phone numbers:

- **GTA Center**: Uses session with phone number `+201065057897` or `01065057897`
- **Tagmo3 Center**: Uses session with phone number `+201055640148` or `01055640148`
- **Online Center**: Uses session with phone number `+201147929010` or `01147929010`

If no specific session is found, the system will use any connected session as a fallback.

```env
# JWT Secret (existing)
JWTSECRET=your_jwt_secret
```

## Session Management

The Wasender API requires session API keys for sending messages. The code now dynamically finds the appropriate session:
1. Retrieves all sessions using `wasender.getAllSessions()`
2. Finds the session matching the center's admin phone number
3. Extracts the API key from the session data
4. Uses the API key for sending messages

This approach eliminates the need for hardcoded session IDs and makes the system more flexible.

## Testing

Run the test script to verify the integration:

```bash
node test_wasender_integration.js
```

This will test:
- Authentication with Wasender API
- Retrieving all sessions
- Getting details for specific sessions
- Verifying API keys are available

## API Method Mapping

| Old Waziper Method | New Wasender Method |
|-------------------|-------------------|
| `waziper.sendTextMessage(instanceId, phone, message)` | `wasender.sendTextMessage(sessionApiKey, phone@s.whatsapp.net, message)` |
| `waziper.sendMediaMessage(instanceId, phone, message, url, filename)` | `wasender.sendImageMessage(sessionApiKey, phone@s.whatsapp.net, url, text)` |

**Note**: For media messages (images, videos, audio), the text/caption is sent as the `text` parameter in the same request body as the media URL, not as a separate `caption` parameter.

## Error Handling

The new implementation includes better error handling:
- Session API key validation
- Response success/failure checking
- Detailed error messages for debugging

## Center-Specific Sessions

- **GTA Center**: Uses session with phone number `+201065057897` or `01065057897`
- **Tagmo3 Center**: Uses session with phone number `+201055640148` or `01055640148`
- **Online Center**: Uses session with phone number `+201147929010` or `01147929010`
- **Other Centers**: Default to any connected session as fallback

## Notes

- The old `utils/waziper.js` file was removed as it's no longer needed
- All WhatsApp functionality now goes through the `utils/wasender.js` module
- Session management is handled automatically by the code using dynamic session discovery
- Phone number formatting is consistent across all functions
- No hardcoded session IDs are required - the system finds sessions automatically
