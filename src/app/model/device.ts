export interface ContainerInfo {
    ActivationState: string;
    ActivationStateAcknowledged: string;
    BasebandActivationTicketVersion: string;
    BasebandCertId: string;
    BasebandChipID: string;
    BasebandKeyHashInformation: string;
    BasebandKeyHashInformation_SKeyStatus: string;
    BasebandMasterKeyHash: string;
    BasebandRegionSKU: string;
    BasebandSerialNumber: string;
    BasebandStatus: string;
    BasebandVersion: string;
    BluetoothAddress: string;
    BoardId: string;
    BootSessionID: string;
    BrickState: string;
    BuildVersion: string;
    CPUArchitecture: string;
    CarrierBundleInfoArray_0: string;
    CertID: string;
    ChipID: string;
    ChipSerialNo: string;
    DeviceClass: string;
    DeviceColor: string;
    DeviceName: string;
    DieID: string;
    EthernetAddress: string;
    FirmwareVersion: string;
    FusingStatus: string;
    HardwareModel: string;
    HardwarePlatform: string;
    HasSiDP: string;
    HostAttached: string;
    HumanReadableProductVersionString: string;
    InternationalMobileEquipmentIdentity: string;
    InternationalMobileEquipmentIdentity2: string;
    MLBSerialNumber: string;
    MobileEquipmentIdentifier: string;
    MobileSubscriberCountryCode: string;
    MobileSubscriberNetworkCode: string;
    ModelNumber: string;
    NonVolatileRAM: string;
    NonVolatileRAM_SystemAudioVolumeSaved: string;
    NonVolatileRAM_auto_boot: string;
    NonVolatileRAM_backlight_level: string;
    NonVolatileRAM_backlight_nits: string;
    NonVolatileRAM_boot_args: string;
    NonVolatileRAM_bootdelay: string;
    NonVolatileRAM_fm_spstatus: string;
    NonVolatileRAM_usbcfwflasherResult: string;
    PairRecordProtectionClass: string;
    PartitionType: string;
    PasswordProtected: string;
    PkHash: string;
    ProductName: string;
    ProductType: string;
    ProductVersion: string;
    ProductionSOC: string;
    ProtocolVersion: string;
    ProximitySensorCalibration: string;
    RegionInfo: string;
    SIMStatus: string;
    SIMTrayStatus: string;
    SerialNumber: string;
    SoftwareBehavior: string;
    SoftwareBundleVersion: string;
    SupportedDeviceFamilies_1: string;
    SupportedDeviceFamilies_1_0: string;
    TelephonyCapability: string;
    TimeIntervalSince1970: string;
    TimeZone: string;
    TimeZoneOffsetFromUTC: string;
    TrustedHostAttached: string;
    UniqueChipID: string;
    UniqueDeviceID: string;
    UseRaptorCerts: string;
    Uses24HourClock: string;
    WiFiAddress: string;
    WirelessBoardSerialNumber: string;
    kCTPostponementStatus: string;
}

export interface Container {
    ID: string;
    Name: string;
    UsbPath: string;
}

export interface DeviceData {
    UDID: string;
    LastSeen: string;
    Container: Container;
    Info: ContainerInfo;
    WDA: WdaStatus;
}
export interface DeviceSession {
    id: string;
    width: number;
    height: number;
}

export interface WdaStatus {
    sessionId: string;
    detail: string;
    status: string;
    value: any
}

