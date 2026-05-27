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
  lastSeen?: string;
}

interface KioskSource {
  url: string;
  authHeader: string;
}

@Injectable()
export class GpsCollectorService implements OnModuleInit {
  private readonly logger = new Logger(GpsCollectorService.name);
  private readonly sources: KioskSource[];
  private lastFingerprint = '';

  constructor(private prisma: PrismaService) {
    // Source principale + sources additionnelles (ex: kiosk staging, quand une
    // tablette a été installée par erreur dessus). Suffixes _2, _3… optionnels.
    // Chaque source réutilise les identifiants principaux si les siens ne sont pas fournis.
    const candidates = [
      { url: process.env.KIOSK_API_URL, user: process.env.KIOSK_API_USER, pass: process.env.KIOSK_API_PASS },
      { url: process.env.KIOSK_API_URL_2, user: process.env.KIOSK_API_USER_2, pass: process.env.KIOSK_API_PASS_2 },
      { url: process.env.KIOSK_API_URL_3, user: process.env.KIOSK_API_USER_3, pass: process.env.KIOSK_API_PASS_3 },
    ];

    const defaultUser = process.env.KIOSK_API_USER || '';
    const defaultPass = process.env.KIOSK_API_PASS || '';

    this.sources = candidates
      .filter((c): c is { url: string; user: string | undefined; pass: string | undefined } =>
        Boolean(c.url),
      )
      .map((c) => {
        const user = c.user || defaultUser;
        const pass = c.pass || defaultPass;
        return {
          url: c.url.replace(/\/+$/, ''),
          authHeader: user && pass ? `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` : '',
        };
      });
  }

  onModuleInit() {
    if (this.sources.length === 0) {
      this.logger.warn('KIOSK_API_URL non configuré — collecte GPS désactivée');
      return;
    }
    this.logger.log(
      `Collecte GPS active — polling ${this.sources.map((s) => s.url).join(', ')} toutes les 60s`,
    );
    this.collect();
  }

  @Interval(60_000)
  async collect() {
    if (this.sources.length === 0) return;

    try {
      const devices = await this.fetchAllDevices();
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

  // Récupère les devices de toutes les sources et déduplique par tablette
  // (serialNumber sinon deviceId), en gardant la remontée la plus fraîche (lastSeen).
  // Une tablette physique a le même deviceId/serialNumber sur tous les kiosks,
  // donc une tablette réinstallée sur staging ne sera pas comptée deux fois.
  private async fetchAllDevices(): Promise<KioskDevice[]> {
    const results = await Promise.allSettled(this.sources.map((s) => this.fetchKioskDevices(s)));

    const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    for (const f of failed) {
      this.logger.warn(`Source kiosk injoignable: ${f.reason?.message ?? f.reason}`);
    }
    // Si toutes les sources échouent, on remonte l'erreur (logguée par collect()).
    if (failed.length === this.sources.length) {
      throw new Error(failed[0]?.reason?.message ?? 'toutes les sources kiosk injoignables');
    }

    const all = results
      .filter((r): r is PromiseFulfilledResult<KioskDevice[]> => r.status === 'fulfilled')
      .flatMap((r) => r.value);

    const byDevice = new Map<string, KioskDevice>();
    for (const d of all) {
      const key = d.serialNumber || d.deviceId;
      const existing = byDevice.get(key);
      if (!existing || this.isFresher(d, existing)) {
        byDevice.set(key, d);
      }
    }
    return Array.from(byDevice.values());
  }

  private isFresher(a: KioskDevice, b: KioskDevice): boolean {
    const ta = a.lastSeen ? new Date(a.lastSeen).getTime() : 0;
    const tb = b.lastSeen ? new Date(b.lastSeen).getTime() : 0;
    return ta >= tb;
  }

  private async fetchKioskDevices(source: KioskSource): Promise<KioskDevice[]> {
    const response = await fetch(`${source.url}/api/devices`, {
      method: 'GET',
      headers: {
        Authorization: source.authHeader,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Kiosk API ${source.url} ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }
}
