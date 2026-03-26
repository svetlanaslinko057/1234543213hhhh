export const API_URL = process.env.REACT_APP_BACKEND_URL || '';
export const WS_URL = API_URL.replace('https://', 'wss://').replace('http://', 'ws://');
