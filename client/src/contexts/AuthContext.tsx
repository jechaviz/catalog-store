import { createContext, useContext, useEffect, useState } from 'react';

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  role?: 'admin' | 'user';
}

export interface MockProfileInput {
  email: string;
  name?: string;
  avatar?: string;
  role?: 'admin' | 'user';
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
  mockProfiles: User[];
  switchMockProfile: (userId: string) => void;
  createMockProfile: (profile: MockProfileInput) => User;
  updateMockProfile: (userId: string, profile: Partial<MockProfileInput>) => User | null;
}

export const SESSION_STORAGE_KEY = 'odoo_session';
export const MOCK_USER_STORAGE_KEY = 'odoo_mock_user';
export const MOCK_PROFILES_STORAGE_KEY = 'odoo_mock_profiles';
export const ACTIVE_MOCK_USER_ID_STORAGE_KEY = 'odoo_mock_active_user_id';
export const AUTH_STORAGE_KEYS = new Set([
  SESSION_STORAGE_KEY,
  MOCK_USER_STORAGE_KEY,
  MOCK_PROFILES_STORAGE_KEY,
  ACTIVE_MOCK_USER_ID_STORAGE_KEY,
]);

const MOCK_SESSION_TOKEN = 'mock-google-session';

const DEFAULT_MOCK_USER: User = {
  id: 'demo-user',
  email: 'cliente@ejemplo.com',
  name: 'Cliente Natura',
  role: 'user',
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  loginWithGoogle: async () => {},
  logout: () => {},
  mockProfiles: [],
  switchMockProfile: () => {},
  createMockProfile: () => DEFAULT_MOCK_USER,
  updateMockProfile: () => null,
});

type RestoredAuthState = {
  user: User | null;
  profiles: User[];
};

const createMockUser = (overrides: Partial<User> = {}): User => ({
  ...DEFAULT_MOCK_USER,
  ...overrides,
});

const isUser = (value: unknown): value is User => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<User>;

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.email === 'string' &&
    (candidate.name === undefined || typeof candidate.name === 'string') &&
    (candidate.avatar === undefined || typeof candidate.avatar === 'string') &&
    (candidate.role === undefined || candidate.role === 'admin' || candidate.role === 'user')
  );
};

const safeParseJson = <T,>(rawValue: string | null, fallbackValue: T): T => {
  if (!rawValue) {
    return fallbackValue;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return fallbackValue;
  }
};

const readLegacyUser = (value: unknown): User | null => {
  if (isUser(value)) {
    return createMockUser(value);
  }

  if (!value || typeof value !== 'object' || !('user' in value)) {
    return null;
  }

  const legacyUser = (value as { user?: unknown }).user;
  return isUser(legacyUser) ? createMockUser(legacyUser) : null;
};

const normalizeMockProfile = (value: Partial<User>): User | null => {
  if (typeof value.email !== 'string' || !value.email.trim()) {
    return null;
  }

  if (typeof value.id !== 'string' || !value.id.trim()) {
    return null;
  }

  return createMockUser({
    ...value,
    id: value.id.trim(),
    email: value.email.trim().toLowerCase(),
    name: value.name?.trim() || undefined,
    avatar: value.avatar?.trim() || undefined,
    role: value.role === 'admin' ? 'admin' : 'user',
  });
};

const readStoredProfiles = (): User[] => {
  const parsedProfiles = safeParseJson<unknown[]>(localStorage.getItem(MOCK_PROFILES_STORAGE_KEY), []);
  const profiles = parsedProfiles
    .map((candidate) => (isUser(candidate) ? normalizeMockProfile(candidate) : null))
    .filter((candidate): candidate is User => Boolean(candidate));

  return profiles.length > 0 ? profiles : [createMockUser()];
};

const writeStoredProfiles = (profiles: User[]) => {
  localStorage.setItem(MOCK_PROFILES_STORAGE_KEY, JSON.stringify(profiles));
};

const setActiveMockUserId = (userId: string | null) => {
  if (userId) {
    localStorage.setItem(ACTIVE_MOCK_USER_ID_STORAGE_KEY, userId);
    return;
  }

  localStorage.removeItem(ACTIVE_MOCK_USER_ID_STORAGE_KEY);
};

const persistSessionState = (nextUser: User | null) => {
  if (nextUser) {
    localStorage.setItem(SESSION_STORAGE_KEY, MOCK_SESSION_TOKEN);
    localStorage.setItem(MOCK_USER_STORAGE_KEY, JSON.stringify(nextUser));
    setActiveMockUserId(nextUser.id);
    return;
  }

  localStorage.removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem(MOCK_USER_STORAGE_KEY);
};

const createBaseUserId = (profile: Pick<MockProfileInput, 'email' | 'name'>) => {
  const source = profile.email.split('@')[0] || profile.name || 'cliente';
  const normalized = source
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'cliente';
};

const ensureUniqueUserId = (baseUserId: string, existingProfiles: User[]) => {
  const existingIds = new Set(existingProfiles.map(profile => profile.id));

  if (!existingIds.has(baseUserId)) {
    return baseUserId;
  }

  let suffix = 2;
  let nextUserId = `${baseUserId}-${suffix}`;

  while (existingIds.has(nextUserId)) {
    suffix += 1;
    nextUserId = `${baseUserId}-${suffix}`;
  }

  return nextUserId;
};

const buildMockProfile = (profile: MockProfileInput, existingProfiles: User[]): User => {
  const email = profile.email.trim().toLowerCase();
  const name = profile.name?.trim() || email.split('@')[0] || DEFAULT_MOCK_USER.name;
  const baseUserId = createBaseUserId({ email, name });
  const userId = ensureUniqueUserId(baseUserId, existingProfiles);

  return createMockUser({
    id: userId,
    email,
    name,
    avatar: profile.avatar?.trim() || undefined,
    role: profile.role === 'admin' ? 'admin' : 'user',
  });
};

const replaceProfile = (profiles: User[], nextProfile: User) =>
  profiles.map((profile) => (profile.id === nextProfile.id ? nextProfile : profile));

const restoreMockSession = (): RestoredAuthState => {
  try {
    let profiles = readStoredProfiles();
    let activeUserId = localStorage.getItem(ACTIVE_MOCK_USER_ID_STORAGE_KEY);
    const storedSession = localStorage.getItem(SESSION_STORAGE_KEY);
    const storedMockUser = localStorage.getItem(MOCK_USER_STORAGE_KEY);
    const activeProfile = profiles.find(profile => profile.id === activeUserId) || null;

    if (!storedSession) {
      if (storedMockUser) {
        localStorage.removeItem(MOCK_USER_STORAGE_KEY);
      }

      writeStoredProfiles(profiles);
      return { user: null, profiles };
    }

    if (storedSession === MOCK_SESSION_TOKEN) {
      if (activeProfile) {
        localStorage.setItem(MOCK_USER_STORAGE_KEY, JSON.stringify(activeProfile));
        writeStoredProfiles(profiles);
        return { user: activeProfile, profiles };
      }

      const parsedMockUser = normalizeMockProfile(
        safeParseJson<unknown>(storedMockUser, null) as Partial<User>,
      );

      if (parsedMockUser) {
        const existingIndex = profiles.findIndex(profile => profile.id === parsedMockUser.id);
        profiles =
          existingIndex >= 0
            ? replaceProfile(profiles, parsedMockUser)
            : [parsedMockUser, ...profiles];
        activeUserId = parsedMockUser.id;
        writeStoredProfiles(profiles);
        persistSessionState(parsedMockUser);
        return { user: parsedMockUser, profiles };
      }

      const fallbackProfile = profiles[0] || createMockUser();
      profiles = profiles.length > 0 ? profiles : [fallbackProfile];
      writeStoredProfiles(profiles);
      persistSessionState(fallbackProfile);
      return { user: fallbackProfile, profiles };
    }

    try {
      const legacySession = JSON.parse(storedSession) as unknown;
      const legacyUser = readLegacyUser(legacySession);

      if (legacyUser) {
        const existingIndex = profiles.findIndex(profile => profile.id === legacyUser.id);
        profiles =
          existingIndex >= 0
            ? replaceProfile(profiles, legacyUser)
            : [legacyUser, ...profiles];
        writeStoredProfiles(profiles);
        persistSessionState(legacyUser);
        return { user: legacyUser, profiles };
      }
    } catch {
      // Non-JSON session tokens are reserved for real auth flows; leave them untouched.
    }

    if (storedMockUser) {
      localStorage.removeItem(MOCK_USER_STORAGE_KEY);
    }

    writeStoredProfiles(profiles);
    return { user: null, profiles };
  } catch {
    const fallbackProfiles = [createMockUser()];
    return { user: null, profiles: fallbackProfiles };
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [mockProfiles, setMockProfiles] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const restoredState = restoreMockSession();
    setUser(restoredState.user);
    setMockProfiles(restoredState.profiles);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key && !AUTH_STORAGE_KEYS.has(event.key)) {
        return;
      }

      const restoredState = restoreMockSession();
      setUser(restoredState.user);
      setMockProfiles(restoredState.profiles);
      setIsLoading(false);
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const loginWithGoogle = async () => {
    if (user) {
      return;
    }

    setIsLoading(true);

    try {
      const profiles = mockProfiles.length > 0 ? mockProfiles : [createMockUser()];
      const activeUserId = localStorage.getItem(ACTIVE_MOCK_USER_ID_STORAGE_KEY);
      const nextUser =
        profiles.find(profile => profile.id === activeUserId) ||
        profiles[0] ||
        createMockUser();

      writeStoredProfiles(profiles);
      persistSessionState(nextUser);
      setMockProfiles(profiles);
      setUser(nextUser);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setIsLoading(false);
    persistSessionState(null);
  };

  const switchMockProfile = (userId: string) => {
    const nextUser = mockProfiles.find(profile => profile.id === userId);

    if (!nextUser) {
      return;
    }

    writeStoredProfiles(mockProfiles);
    persistSessionState(nextUser);
    setUser(nextUser);
  };

  const createMockProfile = (profile: MockProfileInput) => {
    const nextProfile = buildMockProfile(profile, mockProfiles);
    const nextProfiles = [nextProfile, ...mockProfiles];

    writeStoredProfiles(nextProfiles);
    persistSessionState(nextProfile);
    setMockProfiles(nextProfiles);
    setUser(nextProfile);

    return nextProfile;
  };

  const updateMockProfile = (userId: string, profile: Partial<MockProfileInput>) => {
    const currentProfile = mockProfiles.find(candidate => candidate.id === userId);

    if (!currentProfile) {
      return null;
    }

    const nextProfile = normalizeMockProfile({
      ...currentProfile,
      ...profile,
      id: currentProfile.id,
      email: profile.email?.trim().toLowerCase() || currentProfile.email,
      name: profile.name?.trim() || currentProfile.name,
      avatar: profile.avatar?.trim() || undefined,
      role: profile.role === 'admin' ? 'admin' : profile.role === 'user' ? 'user' : currentProfile.role,
    });

    if (!nextProfile) {
      return null;
    }

    const nextProfiles = replaceProfile(mockProfiles, nextProfile);
    writeStoredProfiles(nextProfiles);
    setMockProfiles(nextProfiles);

    if (user?.id === userId) {
      persistSessionState(nextProfile);
      setUser(nextProfile);
    }

    return nextProfile;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        loginWithGoogle,
        logout,
        mockProfiles,
        switchMockProfile,
        createMockProfile,
        updateMockProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
