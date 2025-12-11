// HospitalApp/src/shared/api/client.ts
// John Surette
// Dec 8, 2025
// client.ts

// small wrapper around fetch with base URL+auth header.

const BASE_URL = 'https://api.hospitalapp.com';

export async function client(endpoint: string, options: RequestInit = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const headers = { 'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`, ...options.headers };

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
    }

    return response.json();
}