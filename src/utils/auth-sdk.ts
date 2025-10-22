import { logger } from './logger';
import { storage, Session } from './storage';

/**
 * Pubky authentication using official @synonymdev/pubky SDK
 */

// Import types from SDK
type Client = any;
type AuthRequest = any;

const REQUIRED_CAPABILITIES = '/pub/pubky.app/:rw';
const RELAY_URL = 'https://httprelay.pubky.app/link/';

export interface AuthQRData {
  qrUrl: string;
  qrDataUrl: string;
  authRequest: AuthRequest;
}

class AuthManagerSDK {
  private static instance: AuthManagerSDK;
  private client: Client | null = null;
  private currentAuthRequest: AuthRequest | null = null;

  private constructor() {
    this.initializePubky();
  }

  static getInstance(): AuthManagerSDK {
    if (!AuthManagerSDK.instance) {
      AuthManagerSDK.instance = new AuthManagerSDK();
    }
    return AuthManagerSDK.instance;
  }

  /**
   * Initialize Pubky client
   */
  private async initializePubky() {
    try {
      // Dynamic import to handle the SDK
      const { Client } = await import('@synonymdev/pubky');
      this.client = new Client();
      logger.info('AuthSDK', 'Pubky Client initialized');
    } catch (error) {
      logger.error('AuthSDK', 'Failed to initialize Pubky Client', error as Error);
      throw error;
    }
  }

  /**
   * Ensure Client is initialized
   */
  private async ensureClient(): Promise<Client> {
    if (!this.client) {
      await this.initializePubky();
    }
    return this.client!;
  }

  /**
   * Generate QR code for authentication using SDK
   */
  async generateAuthQR(): Promise<AuthQRData> {
    try {
      logger.info('AuthSDK', 'Generating auth QR code with SDK');

      const client = await this.ensureClient();
      
      // Create auth request with capabilities
      this.currentAuthRequest = client.authRequest(RELAY_URL, REQUIRED_CAPABILITIES);
      
      // Get authorization URL (pubkyauth:// URL)
      const authUrl = this.currentAuthRequest.url();

      logger.info('AuthSDK', 'Auth request created', { authUrl });

      // Generate QR code using qrcode library
      const QRCode = (await import('qrcode')).default;
      const qrDataUrl = await QRCode.toDataURL(authUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });

      return {
        qrUrl: authUrl,
        qrDataUrl,
        authRequest: this.currentAuthRequest,
      };
    } catch (error) {
      logger.error('AuthSDK', 'Failed to generate QR code', error as Error);
      throw error;
    }
  }

  /**
   * Wait for user to approve authentication
   */
  async awaitApproval(
    authRequest: AuthRequest,
    onSuccess: (session: Session) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      logger.info('AuthSDK', 'Waiting for user approval');

      // Wait for the response - this returns a Session object!
      const sdkSession = await authRequest.response();

      logger.info('AuthSDK', 'Authentication successful!');

      // Get the pubky ID from the session
      const pubkyId = sdkSession.pubky();
      
      // Create our session format
      const session: Session = {
        pubky: pubkyId,
        homeserver: 'pubky://' + pubkyId,
        sessionId: Date.now().toString(),
        capabilities: [REQUIRED_CAPABILITIES],
        timestamp: Date.now(),
      };

      // Store the SDK session for making authenticated requests
      await this.storeSessionData(sdkSession);

      // Save session to storage
      await storage.saveSession(session);

      logger.info('AuthSDK', 'Session created and stored', { pubky: pubkyId });
      onSuccess(session);
    } catch (error) {
      logger.error('AuthSDK', 'Failed during approval wait', error as Error);
      onError(error as Error);
    }
  }

  /**
   * Store session data for later use
   */
  private async storeSessionData(sdkSession: any): Promise<void> {
    try {
      // Store the SDK session object
      // Note: The SDK session contains authentication state/cookies
      await storage.setSetting('sdkSession', {
        timestamp: Date.now(),
        pubky: sdkSession.pubky(),
        capabilities: sdkSession.capabilities(),
      });
      logger.debug('AuthSDK', 'SDK session data stored');
    } catch (error) {
      logger.error('AuthSDK', 'Failed to store session data', error as Error);
    }
  }

  /**
   * Get SDK session for making API calls
   */
  async getSDKSession(): Promise<any> {
    try {
      const session = await storage.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      // For read operations, we can use the public storage API
      // For write operations, we'll need the authenticated session
      // This would require re-authentication or session persistence
      
      logger.debug('AuthSDK', 'Retrieved session for API calls');
      return session;
    } catch (error) {
      logger.error('AuthSDK', 'Failed to get SDK session', error as Error);
      throw error;
    }
  }

  /**
   * Stop the current auth flow
   */
  stopAuthFlow(): void {
    if (this.currentAuthRequest) {
      // Clean up the auth request
      this.currentAuthRequest = null;
      logger.info('AuthSDK', 'Auth request cancelled');
    }
  }

  /**
   * Get current session
   */
  async getSession(): Promise<Session | null> {
    return await storage.getSession();
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const session = await this.getSession();
    return session !== null;
  }

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    try {
      // Sign out from SDK if client exists
      if (this.client) {
        try {
          await this.client.signout();
        } catch (err) {
          logger.warn('AuthSDK', 'Failed to sign out from SDK', err as Error);
        }
      }
      
      await storage.clearSession();
      await storage.setSetting('sdkSession', null);
      this.currentAuthRequest = null;
      logger.info('AuthSDK', 'User signed out');
    } catch (error) {
      logger.error('AuthSDK', 'Failed to sign out', error as Error);
      throw error;
    }
  }

  /**
   * Get the authenticated client for making requests
   */
  async getAuthenticatedClient(): Promise<Client> {
    const client = await this.ensureClient();
    const session = await storage.getSession();
    
    if (!session) {
      throw new Error('No active session - user must be authenticated');
    }
    
    return client;
  }
}

export const authManagerSDK = AuthManagerSDK.getInstance();

