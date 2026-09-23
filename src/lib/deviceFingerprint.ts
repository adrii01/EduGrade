export interface ClientDevice {
  id: string;
  name: string;
  browser: string;
  os: string;
}

export function getClientDevice(): ClientDevice {
  let deviceId = localStorage.getItem('edugrade_device_id');
  if (!deviceId) {
    deviceId = 'dev_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
    localStorage.setItem('edugrade_device_id', deviceId);
  }

  const userAgent = navigator.userAgent;
  let browser = 'Navegador Web';
  if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Edg/')) browser = 'Edge';
  else if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Safari')) browser = 'Safari';

  let os = 'Dispositivo';
  if (userAgent.includes('Win')) os = 'Windows';
  else if (userAgent.includes('Mac')) os = 'macOS';
  else if (userAgent.includes('Linux')) os = 'Linux';
  else if (userAgent.includes('Android')) os = 'Android';
  else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';

  return {
    id: deviceId,
    name: `${browser} en ${os}`,
    browser,
    os
  };
}

export function getStoredSessionToken(): string | null {
  return localStorage.getItem('edugrade_session_token');
}

export function setStoredSessionToken(token: string) {
  localStorage.setItem('edugrade_session_token', token);
}

export function clearStoredSessionToken() {
  localStorage.removeItem('edugrade_session_token');
}
