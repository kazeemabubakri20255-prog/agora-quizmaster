export type StoredSession = {
  sessionId: string;
  token: string;
  submissionId?: string;
};

const key = (slug: string) => `agora.session.${slug}`;

export function readSession(slug: string): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key(slug));
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export function writeSession(slug: string, value: StoredSession) {
  try {
    localStorage.setItem(key(slug), JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function clearSession(slug: string) {
  try {
    localStorage.removeItem(key(slug));
  } catch {
    /* ignore */
  }
}

const GATE_KEY = "agora.gate.v1";

export function readGate(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(GATE_KEY) === "visited";
  } catch {
    return false;
  }
}

export function markGateVisited() {
  try {
    localStorage.setItem(GATE_KEY, "visited");
  } catch {
    /* ignore */
  }
}
