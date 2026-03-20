import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { GpsPositionInput } from './gps-tracking.dto';

@Injectable()
export class GpsTrackingService {
  constructor(private prisma: PrismaService) {}

  async savePositions(positions: GpsPositionInput[]) {
    const data = positions.map(pos => ({
      deviceId: pos.deviceId,
      deviceName: pos.deviceName || null,
      latitude: pos.latitude,
      longitude: pos.longitude,
      accuracy: pos.accuracy || null,
      batteryLevel: pos.batteryLevel || null,
      isOnline: pos.isOnline ?? true,
    }));

    const result = await this.prisma.gpsPosition.createMany({ data });
    return { success: true, saved: result.count };
  }

  async getHistory(deviceId: string, from?: string, to?: string, limit?: number) {
    const where: any = { deviceId };

    if (from || to) {
      where.recordedAt = {};
      if (from) where.recordedAt.gte = new Date(from);
      if (to) where.recordedAt.lte = new Date(to);
    }

    const [total, positions] = await Promise.all([
      this.prisma.gpsPosition.count({ where }),
      this.prisma.gpsPosition.findMany({
        where,
        orderBy: { recordedAt: 'desc' },
        take: limit || 500,
      }),
    ]);

    return { total, positions };
  }

  async getLatestPositions() {
    const devices = await this.prisma.gpsPosition.findMany({
      orderBy: { recordedAt: 'desc' },
      distinct: ['deviceId'],
    });

    return devices;
  }

  async getDailyRoute(deviceId: string, date: string) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const positions = await this.prisma.gpsPosition.findMany({
      where: {
        deviceId,
        recordedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: { recordedAt: 'asc' },
    });

    return { total: positions.length, positions };
  }

  async getAllPositions(from: string, to: string, deviceId?: string, limit?: number) {
    const where: any = {
      recordedAt: {
        gte: new Date(from),
        lte: new Date(to),
      },
    };
    if (deviceId) {
      where.deviceId = deviceId;
    }

    const [total, positions] = await Promise.all([
      this.prisma.gpsPosition.count({ where }),
      this.prisma.gpsPosition.findMany({
        where,
        orderBy: [{ deviceId: 'asc' }, { recordedAt: 'asc' }],
        take: limit || 5000,
      }),
    ]);

    return { total, positions };
  }

  async getDeviceIds() {
    const devices = await this.prisma.gpsPosition.findMany({
      select: { deviceId: true, deviceName: true },
      distinct: ['deviceId'],
      orderBy: { recordedAt: 'desc' },
    });
    return devices;
  }

  async getDeviceMappings() {
    return this.prisma.deviceMapping.findMany({
      orderBy: { commercialName: 'asc' },
    });
  }

  async setDeviceCommercial(deviceId: string, commercialName: string) {
    return this.prisma.deviceMapping.upsert({
      where: { deviceId },
      update: { commercialName },
      create: { deviceId, commercialName },
    });
  }

  async removeDeviceMapping(deviceId: string) {
    return this.prisma.deviceMapping.delete({
      where: { deviceId },
    });
  }
}
