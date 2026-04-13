export type DeviceType = 'android' | 'ios';
export type DeviceStatus = 'starting' | 'running' | 'error' | 'stopped';

export interface DeviceScan {
  type: string;
  path: string;
  serial: string;
  vendorId: string;
  productId: string;
  usbPath: string;
  startTime: number;
}

export interface ContainerStatus {
  state: string;
  reason: string;
  message: string;
}

export interface DeviceInfo {
  // Android
  model?: string;
  batteryLevel?: number;
  batteryTemperature?: number;
  androidVersion?: string;
  sdkVersion?: string;
  manufacturer?: string;
  // iOS
  DeviceName?: string;
  ProductType?: string;
  ProductVersion?: string;
  HumanReadableProductVersionString?: string;
  UniqueDeviceID?: string;
  BatteryCurrentCapacity?: number;
  HardwareModel?: string;
  // generic
  [key: string]: any;
}

export interface Device {
  type: DeviceType;
  serial: string;
  scan: DeviceScan;
  containerStatus?: ContainerStatus;
  Info: DeviceInfo;
  Status: DeviceStatus;
  StatusMsg: string;
  disabled?: boolean;
  LastSeen: string;
}

export interface WsMessage {
  type: string;
  event: string;
  device: string;
  platform: string;
  data: any;
}
