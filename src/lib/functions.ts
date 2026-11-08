import { getApp } from 'firebase/app';
import { connectFunctionsEmulator, getFunctions, httpsCallable, type HttpsCallableResult } from 'firebase/functions';
import { emulatorHost, emulatorPorts, useEmulators } from './firebase';

const REGION = 'southamerica-east1';

let emulatorConnected = false;

export function getCallableFunctions() {
  const functions = getFunctions(getApp(), REGION);
  if (useEmulators && !emulatorConnected) {
    connectFunctionsEmulator(functions, emulatorHost, emulatorPorts.functions);
    emulatorConnected = true;
  }
  return functions;
}

export async function callFunction<TData = unknown, TResult = unknown>(
  name: string,
  data?: TData,
): Promise<TResult> {
  const fn = httpsCallable<TData, TResult>(getCallableFunctions(), name);
  const result: HttpsCallableResult<TResult> = await fn(data as TData);
  return result.data;
}
