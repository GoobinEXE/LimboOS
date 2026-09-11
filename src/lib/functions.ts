import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable, type HttpsCallableResult } from 'firebase/functions';

const REGION = 'southamerica-east1';

export function getCallableFunctions() {
  return getFunctions(getApp(), REGION);
}

export async function callFunction<TData = unknown, TResult = unknown>(
  name: string,
  data?: TData,
): Promise<TResult> {
  const fn = httpsCallable<TData, TResult>(getCallableFunctions(), name);
  const result: HttpsCallableResult<TResult> = await fn(data as TData);
  return result.data;
}
