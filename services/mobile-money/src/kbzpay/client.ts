import axios, { AxiosInstance } from 'axios';
import { nanoid } from 'nanoid';
import type {
  KbzPayOrderParams,
  KbzPayPrepayResponse,
  KbzPayCallbackPayload,
  KbzPayStatusResponse,
} from '@mifos-x/shared-types';
import { buildSignature } from './signature';

export interface KbzPayConfig {
  appId: string;
  merchantCode: string;
  signKey: string;
  baseUrl: string;
  callbackUrl: string;
}

export class KbzPayClient {
  private http: AxiosInstance;

  constructor(private config: KbzPayConfig) {
    this.http = axios.create({ baseURL: config.baseUrl, timeout: 15_000 });
  }

  async createOrder(params: KbzPayOrderParams): Promise<KbzPayPrepayResponse> {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonceStr = nanoid(16);

    const body: Record<string, string> = {
      appid: this.config.appId,
      merch_code: this.config.merchantCode,
      merch_order_id: params.orderId,
      total_amount: String(params.amount),
      trans_currency: params.currency,
      timeout_express: '30m',
      notify_url: params.callbackUrl ?? this.config.callbackUrl,
      goods_desc: params.description,
      timestamp,
      nonce_str: nonceStr,
    };

    body['sign'] = buildSignature(body, this.config.signKey);

    const response = await this.http.post('/precreate', { Request: body });
    const result = response.data?.Response;

    if (!result || result.result !== '1') {
      throw new Error(`KBZ Pay precreate failed: ${result?.result_msg ?? 'unknown error'}`);
    }

    return {
      prepayId: result.prepay_id,
      orderId: params.orderId,
      expireTime: Math.floor(Date.now() / 1000) + 1800, // 30 min
    };
  }

  async queryOrder(orderId: string): Promise<KbzPayStatusResponse> {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonceStr = nanoid(16);

    const body: Record<string, string> = {
      appid: this.config.appId,
      merch_code: this.config.merchantCode,
      merch_order_id: orderId,
      timestamp,
      nonce_str: nonceStr,
    };

    body['sign'] = buildSignature(body, this.config.signKey);

    const response = await this.http.post('/query', { Request: body });
    const result = response.data?.Response;

    const statusMap: Record<string, KbzPayStatusResponse['status']> = {
      '1': 'success',
      '0': 'pending',
      '2': 'failed',
    };

    return {
      orderId,
      transactionId: result?.trans_id,
      status: statusMap[result?.trans_status] ?? 'pending',
      amount: Number(result?.total_amount ?? 0),
      paidAt: result?.paid_time,
    };
  }

  parseCallback(payload: KbzPayCallbackPayload): { valid: boolean; orderId: string; success: boolean } {
    const params = { ...payload } as unknown as Record<string, string>;
    const valid = buildSignature(
      Object.fromEntries(Object.entries(params).filter(([k]) => k !== 'sign')),
      this.config.signKey
    ) === payload.sign;

    return {
      valid,
      orderId: payload.orderId,
      success: payload.status === '0',
    };
  }
}
