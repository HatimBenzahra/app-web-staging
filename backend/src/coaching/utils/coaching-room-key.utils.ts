const DEFAULT_RECORDING_PREFIX = 'recordings/';

export function extractRoomFromRecordingKey(
  key: string,
  prefix = process.env.S3_PREFIX || DEFAULT_RECORDING_PREFIX,
): string | null {
  if (!key.startsWith(prefix)) {
    return null;
  }

  const [safeRoom] = key.slice(prefix.length).split('/');
  return safeRoom ? safeRoom.replace(/_/g, ':') : null;
}

export function extractCommercialIdFromRoomName(
  roomName?: string | null,
): number | null {
  if (!roomName) {
    return null;
  }

  const parts = roomName.split(':');
  if (parts.length !== 3 || parts[1]?.toUpperCase() !== 'COMMERCIAL') {
    return null;
  }

  const commercialId = Number(parts[2]);
  return Number.isFinite(commercialId) ? commercialId : null;
}
