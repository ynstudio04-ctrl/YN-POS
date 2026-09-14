export type DeviceRole = 'pos' | 'scanner';

export type RegisterMessage = {
  type: 'barcode';
  barcode: string;
  sourceId: string;
  sentAt: number;
};

export type RegisterStatus =
  | 'CONNECTING'
  | 'SUBSCRIBED'
  | 'CLOSED'
  | 'CHANNEL_ERROR'
  | 'TIMED_OUT'
  | 'NO_SUPABASE'
  | 'AUTH_ERROR';

export type RealtimeDiagnostics = {
  topic?: string;
  userId?: string;
  authenticated: boolean;
  setAuth: boolean;
  authError?: string;
};

// Multi-device pairing uses PeerJS/WebRTC.
// Supabase Realtime is intentionally not used for scanner traffic.
const ROLE_KEY = 'yn-device-role';
const REGISTER_KEY = 'yn-register-code';
const PEER_KEY = 'yn-peer-id';
const DEVICE_KEY = 'yn-device-id';

type PeerConstructor = new (
  id?: string,
  options?: Record<string, unknown>,
) => PeerLike;

type PeerLike = {
  id: string;
  on: (event: string, callback: (...args: any[]) => void) => void;
  connect: (
    id: string,
    options?: Record<string, unknown>,
  ) => DataConnection;
  destroy: () => void;
};

type DataConnection = {
  open: boolean;
  send: (data: unknown) => void;
  close: () => void;
  on: (event: string, callback: (...args: any[]) => void) => void;
};

declare global {
  interface Window {
    Peer?: PeerConstructor;
  }
}

let peer: PeerLike | null = null;
let peerLoad: Promise<PeerConstructor> | null = null;
let activeConnection: DataConnection | null = null;
let activeCode = '';

const messageHandlers = new Set<
  (message: RegisterMessage) => void
>();

const statusHandlers = new Set<
  (status: RegisterStatus, detail?: string) => void
>();

function notifyConfigChanged() {
  window.dispatchEvent(new Event('yn-device-config-changed'));
}

function getDeviceId(): string {
  let value = localStorage.getItem(DEVICE_KEY);

  if (!value) {
    value = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, value);
  }

  return value;
}

export const getSavedDeviceRole = (): DeviceRole | null => {
  const value = localStorage.getItem(ROLE_KEY);

  return value === 'pos' || value === 'scanner'
    ? value
    : null;
};

export const setDeviceRole = (value: DeviceRole) => {
  localStorage.setItem(ROLE_KEY, value);
  notifyConfigChanged();
};

export const getRegisterCode = (): string => {
  return localStorage.getItem(REGISTER_KEY) || '';
};

export const setRegisterCode = (value: string) => {
  localStorage.setItem(REGISTER_KEY, value);
  notifyConfigChanged();
};

export const makePairCode = (): string => {
  return `YN-${Math.floor(1000 + Math.random() * 9000)}`;
};

export function makePeerId(code: string): string {
  const normalizedCode = code
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();

  const deviceId = getDeviceId().slice(0, 8);

  return `ynpos-${normalizedCode}-${deviceId}`;
}

export function getPeerId(): string {
  return localStorage.getItem(PEER_KEY) || '';
}

async function loadPeer(): Promise<PeerConstructor> {
  if (window.Peer) {
    return window.Peer;
  }

  if (peerLoad) {
    return peerLoad;
  }

  peerLoad = new Promise<PeerConstructor>((resolve, reject) => {
    const existing =
      document.querySelector<HTMLScriptElement>(
        'script[data-yn-peerjs]',
      );

    if (existing) {
      existing.addEventListener('load', () => {
        if (window.Peer) {
          resolve(window.Peer);
        } else {
          reject(
            new Error(
              'WebRTC library loaded but Peer is unavailable.',
            ),
          );
        }
      });

      existing.addEventListener('error', () => {
        reject(
          new Error(
            'Could not load WebRTC connection service.',
          ),
        );
      });

      return;
    }

    const script = document.createElement('script');

    script.src =
      'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';

    script.async = true;
    script.dataset.ynPeerjs = 'true';

    script.onload = () => {
      if (window.Peer) {
        resolve(window.Peer);
      } else {
        reject(
          new Error(
            'WebRTC library loaded but Peer is unavailable.',
          ),
        );
      }
    };

    script.onerror = () => {
      reject(
        new Error(
          'Could not load WebRTC connection service.',
        ),
      );
    };

    document.head.appendChild(script);
  });

  return peerLoad;
}

function setStatus(
  status: RegisterStatus,
  detail?: string,
) {
  statusHandlers.forEach((handler) => {
    handler(status, detail);
  });
}

function closeConnection() {
  try {
    activeConnection?.close();
  } catch {
    // Ignore cleanup errors.
  }

  activeConnection = null;
}

function attachPOSConnection(
  connection: DataConnection,
) {
  closeConnection();

  activeConnection = connection;

  connection.on('open', () => {
    setStatus('SUBSCRIBED');
  });

  connection.on('data', (data: unknown) => {
    const message = data as Partial<RegisterMessage>;

    if (
      message.type === 'barcode' &&
      typeof message.barcode === 'string' &&
      typeof message.sourceId === 'string' &&
      message.sourceId !== getDeviceId()
    ) {
      const normalizedMessage: RegisterMessage = {
        type: 'barcode',
        barcode: message.barcode,
        sourceId: message.sourceId,
        sentAt:
          typeof message.sentAt === 'number'
            ? message.sentAt
            : Date.now(),
      };

      messageHandlers.forEach((handler) => {
        handler(normalizedMessage);
      });
    }
  });

  connection.on('close', () => {
    if (activeConnection === connection) {
      activeConnection = null;
      setStatus('CLOSED');
    }
  });

  connection.on('error', (error: unknown) => {
    setStatus(
      'CHANNEL_ERROR',
      error instanceof Error
        ? error.message
        : String(error),
    );
  });
}

export async function startPOSPairing(
  code: string,
  onMessage: (message: RegisterMessage) => void,
  onStatus?: (
    status: RegisterStatus,
    detail?: string,
  ) => void,
): Promise<string> {
  const normalized = code.trim().toUpperCase();

  if (!normalized) {
    throw new Error('A register code is required.');
  }

  if (peer && activeCode === normalized) {
    messageHandlers.add(onMessage);

    if (onStatus) {
      statusHandlers.add(onStatus);
    }

    if (peer.id) {
      setStatus('SUBSCRIBED');
    }

    return peer.id;
  }

  await disconnectRegister();

  const Peer = await loadPeer();

  activeCode = normalized;

  messageHandlers.add(onMessage);

  if (onStatus) {
    statusHandlers.add(onStatus);
  }

  setRegisterCode(normalized);
  setDeviceRole('pos');

  const peerId: string = makePeerId(normalized);

  localStorage.setItem(PEER_KEY, peerId);

  setStatus('CONNECTING');

  const posPeer: PeerLike = new Peer(peerId);

  peer = posPeer;

  posPeer.on('open', () => {
    setStatus('SUBSCRIBED');
  });

  posPeer.on('error', (error: unknown) => {
    setStatus(
      'CHANNEL_ERROR',
      error instanceof Error
        ? error.message
        : String(error),
    );
  });

  posPeer.on('disconnected', () => {
    setStatus(
      'CLOSED',
      'WebRTC signaling connection disconnected.',
    );
  });

  posPeer.on('close', () => {
    setStatus('CLOSED');
  });

  posPeer.on(
    'connection',
    (connection: DataConnection) => {
      attachPOSConnection(connection);
    },
  );

  return peerId;
}

export async function connectScanner(
  peerId: string,
  onStatus?: (
    status: RegisterStatus,
    detail?: string,
  ) => void,
): Promise<string> {
  await disconnectRegister();

  const Peer = await loadPeer();

  const target = peerId.trim();

  if (!target.startsWith('ynpos-')) {
    throw new Error(
      'Invalid POS connection QR code.',
    );
  }

  activeCode = target;

  if (onStatus) {
    statusHandlers.add(onStatus);
  }

  setStatus('CONNECTING');

  const randomPart = Math.random()
    .toString(36)
    .slice(2, 8);

  const scannerPeerId: string = makePeerId(
    `scanner-${randomPart}`,
  );

  localStorage.setItem(PEER_KEY, scannerPeerId);

  setDeviceRole('scanner');

  const scannerPeer: PeerLike = new Peer(
    scannerPeerId,
  );

  peer = scannerPeer;

  scannerPeer.on('open', () => {
    const connection: DataConnection =
      scannerPeer.connect(target, {
        reliable: true,
      });

    activeConnection = connection;

    connection.on('open', () => {
      setStatus('SUBSCRIBED');
    });

    connection.on('close', () => {
      if (activeConnection === connection) {
        activeConnection = null;
      }

      setStatus('CLOSED');
    });

    connection.on('error', (error: unknown) => {
      setStatus(
        'CHANNEL_ERROR',
        error instanceof Error
          ? error.message
          : String(error),
      );
    });
  });

  scannerPeer.on('error', (error: unknown) => {
    setStatus(
      'CHANNEL_ERROR',
      error instanceof Error
        ? error.message
        : String(error),
    );
  });

  scannerPeer.on('close', () => {
    setStatus('CLOSED');
  });

  return scannerPeerId;
}

export function subscribeToRegister(
  code: string,
  onMessage: (message: RegisterMessage) => void,
  onStatus?: (
    status: RegisterStatus,
    detail?: string,
  ) => void,
) {
  void startPOSPairing(
    code,
    onMessage,
    onStatus,
  ).catch((error: unknown) => {
    setStatus(
      'CHANNEL_ERROR',
      error instanceof Error
        ? error.message
        : String(error),
    );
  });

  return () => {
    messageHandlers.delete(onMessage);

    if (onStatus) {
      statusHandlers.delete(onStatus);
    }
  };
}

export async function sendBarcode(
  _code: string,
  barcode: string,
): Promise<boolean> {
  if (!activeConnection?.open) {
    return false;
  }

  const cleanBarcode = barcode.trim();

  if (!cleanBarcode) {
    return false;
  }

  activeConnection.send({
    type: 'barcode',
    barcode: cleanBarcode,
    sourceId: getDeviceId(),
    sentAt: Date.now(),
  });

  return true;
}

export async function disconnectRegister(): Promise<void> {
  closeConnection();

  messageHandlers.clear();
  statusHandlers.clear();

  if (peer) {
    try {
      peer.destroy();
    } catch {
      // Ignore cleanup errors.
    }

    peer = null;
  }

  activeCode = '';
}

export function qrUrl(peerId: string): string {
  const encodedPeerId = encodeURIComponent(peerId);

  return (
    'https://api.qrserver.com/v1/create-qr-code/' +
    `?size=320x320&margin=12&data=${encodedPeerId}`
  );
}

// Compatibility function for the existing Devices page.
// No Supabase Realtime authentication is used.
export function getRealtimeDiagnostics(): RealtimeDiagnostics {
  const savedPeerId = getPeerId();

  const diagnostics: RealtimeDiagnostics = {
    authenticated: false,
    setAuth: false,
  };

  if (activeCode) {
    diagnostics.topic = activeCode;
  }

  if (savedPeerId) {
    diagnostics.userId = savedPeerId;
  }

  return diagnostics;
}