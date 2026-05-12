import axios, { AxiosInstance } from 'axios';

export function createFineractClient(): AxiosInstance {
  const client = axios.create({
    baseURL: process.env.FINERACT_URL,
    timeout: 30_000,
    headers: {
      'Fineract-Platform-TenantId': process.env.FINERACT_TENANT_ID ?? 'default',
      'Content-Type': 'application/json',
    },
    auth: {
      username: process.env.FINERACT_USERNAME!,
      password: process.env.FINERACT_PASSWORD!,
    },
  });

  client.interceptors.response.use(
    (r) => r,
    (err) => {
      const status = err.response?.status;
      const message = err.response?.data?.errors?.[0]?.developerMessage ?? err.message;
      const error = new Error(`Fineract ${status}: ${message}`);
      (error as any).status = status;
      return Promise.reject(error);
    }
  );

  return client;
}
