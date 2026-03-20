import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';

interface KioskDevice {
  deviceId: string;
  deviceName?: string;
  serialNumber?: string;
  latitude: number | null;
  longitude: number | null;
  locationAccuracy: number | null;
  batteryLevel: number | null;
  online: boolean;
}

@Injectable()
export class GpsCollectorService implements OnModuleInit {
  private readonly logger = new Logger(GpsCollectorService.name);
  private readonly kioskUrl: string;
  private readonly authHeader: string;
  private lastFingerprint = '';

  constructor(private prisma: PrismaService) {
    this.kioskUrl = (process.env.KIOSK_API_URL || '').replace(/\/+$/, '');
    const user = process.env.KIOSK_API_USER || '';
    const pass = process.env.KIOSK_API_PASS || '';
    this.authHeader =
      user && pass ? `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` : '';
  }

  onModuleInit() {
    if (!this.kioskUrl) {
      this.logger.warn('KIOSK_API_URL non configuré — collecte GPS désactivée');
      return;
    }
    this.logger.log(`Collecte GPS active — polling ${this.kioskUrl} toutes les 60s`);
    this.collect();
  }

  @Interval(60_000)
  async collect() {
    if (!this.kioskUrl) return;

    try {
      const devices = await this.fetchKioskDevices();
      const withGps = devices.filter(
        (d) => typeof d.latitude === 'number' && typeof d.longitude === 'number',
      );

      if (withGps.length === 0) return;

      const fingerprint = withGps
        .map((d) => `${d.deviceId}:${d.latitude}:${d.longitude}`)
        .sort()
        .join('|');

      if (fingerprint === this.lastFingerprint) return;

      const data = withGps.map((d) => ({
        deviceId: d.serialNumber || d.deviceId,
        deviceName: d.deviceName || null,
        latitude: d.latitude!,
        longitude: d.longitude!,
        accuracy: d.locationAccuracy ?? null,
        batteryLevel: d.batteryLevel ?? null,
        isOnline: d.online ?? true,
      }));

      const result = await this.prisma.gpsPosition.createMany({ data });
      this.lastFingerprint = fingerprint;
      this.logger.debug(`${result.count} positions GPS enregistrées`);
    } catch (error) {
      this.logger.error(`Erreur collecte GPS: ${error.message}`);
    }
  }

  private async fetchKioskDevices(): Promise<KioskDevice[]> {
    const response = await fetch(`${this.kioskUrl}/api/devices`, {
      method: 'GET',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Kiosk API ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }
}
