import PocketBase from 'pocketbase';

// Default port for local PocketBase is 8090
const PB_URL = import.meta.env.VITE_PB_URL || 'http://127.0.0.1:8090';

export const pb = new PocketBase(PB_URL);

// Optional: Automatically load user auth state from localStorage (handled internally by PocketBase)
// pb.authStore.loadFromCookie(document.cookie);

// Useful helper to get the full URL of an image stored in PocketBase
export const getPbImageUrl = (collectionIdOrName: string, recordId: string, fileName: string) => {
    if (!fileName) return '';
    return `${PB_URL}/api/files/${collectionIdOrName}/${recordId}/${fileName}`;
};
