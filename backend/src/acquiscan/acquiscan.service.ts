import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import axios from 'axios';
import * as https from 'https';
import * as readline from 'readline';
import * as zlib from 'zlib';
import { PrismaService } from '../prisma.service';
import { AcquiscanAddress, AcquiscanAddressesInput, AcquiscanAddressesPage, AcquiscanImportStatus } from './acquiscan.dto';

type AcquiscanTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

type AcquiscanCopperBuilding = {
  immeuble_id: string;
  imb_code: string | null;
  addr_numero: string | null;
  addr_nom_voie: string | null;
  addr_nom_commune: string | null;
  code_insee: string | null;
  nbr_logements: string | null;
  fermeture_technique: string | null;
  fermeture_com_zone: string | null;
  fermeture_com_addr: string | null;
  elig_fo: string | null;
  annee_ft: string | null;
  sites_4g: number | null;
  sites_5g: number | null;
  sites_total: number | null;
};

type AcquiscanCopperBuildingsResponse = {
  data?: {
    rows: AcquiscanCopperBuilding[];
    total: number;
  };
};

type CsvCoordinateRow = {
  immeubleId: string;
  dept: string;
  codeInsee: string | null;
  imbCode: string | null;
  addrCode: string | null;
  addrNumero: string | null;
  addrNomVoie: string | null;
  addrNomCommune: string | null;
  imbX: number | null;
  imbY: number | null;
  longitude: number | null;
  latitude: number | null;
};

const WEB_MERCATOR_RADIUS = 6378137;

@Injectable()
export class AcquiscanService {
  private readonly logger = new Logger(AcquiscanService.name);
  private token: { value: string; expiresAt: number } | null = null;
  private readonly activeImports = new Map<string, Promise<AcquiscanImportStatus>>();

  constructor(private readonly prisma: PrismaService) {}

  async findAddresses(input: AcquiscanAddressesInput): Promise<AcquiscanAddressesPage> {
    const dept = this.normalizeDept(input.dept);
    const limit = Math.min(input.limit ?? 100, 500);
    const offset = input.offset ?? 0;

    const importStatus = await this.getImportStatus(dept);

    const copperPage = await this.fetchCopperBuildings({ ...input, dept, limit, offset });
    const rows = copperPage.rows;
    const ids = rows.map(row => row.immeuble_id).filter(Boolean);
    const imbCodes = rows.map(row => row.imb_code).filter((code): code is string => Boolean(code));
    const coordinateWhere: Prisma.AcquiscanAddressCoordinateWhereInput[] = [];
    if (ids.length) coordinateWhere.push({ immeubleId: { in: ids } });
    if (imbCodes.length) coordinateWhere.push({ imbCode: { in: imbCodes } });
    const coordinates = ids.length || imbCodes.length
      ? await this.prisma.acquiscanAddressCoordinate.findMany({
          where: { OR: coordinateWhere },
        })
      : [];
    const coordinatesById = new Map(coordinates.map(item => [item.immeubleId, item]));
    const coordinatesByImbCode = new Map(
      coordinates
        .filter(item => item.imbCode)
        .map(item => [item.imbCode, item]),
    );

    const mappedRows: AcquiscanAddress[] = rows.map(row => {
      const coordinate = coordinatesById.get(row.immeuble_id) || (row.imb_code ? coordinatesByImbCode.get(row.imb_code) : null);
      return {
        immeubleId: row.immeuble_id,
        imbCode: row.imb_code,
        addrNumero: row.addr_numero,
        addrNomVoie: row.addr_nom_voie,
        addrNomCommune: row.addr_nom_commune,
        codeInsee: row.code_insee,
        nbrLogements: row.nbr_logements,
        fermetureTechnique: row.fermeture_technique,
        fermetureComZone: row.fermeture_com_zone,
        fermetureComAddr: row.fermeture_com_addr,
        eligFo: row.elig_fo,
        anneeFt: row.annee_ft,
        sites4g: this.toNullableInt(row.sites_4g),
        sites5g: this.toNullableInt(row.sites_5g),
        sitesTotal: this.toNullableInt(row.sites_total),
        coordinates: coordinate
          ? {
              latitude: coordinate.latitude,
              longitude: coordinate.longitude,
              imbX: coordinate.imbX,
              imbY: coordinate.imbY,
            }
          : null,
      };
    });

    return {
      rows: mappedRows,
      total: copperPage.total,
      enrichedCount: mappedRows.filter(row => row.coordinates?.latitude && row.coordinates?.longitude).length,
      importStatus,
    };
  }

  async importCoordinatesForDepartment(deptInput: string): Promise<AcquiscanImportStatus> {
    const dept = this.normalizeDept(deptInput);
    const existing = await this.getImportStatus(dept);
    if (existing.isImported) return existing;

    const active = this.activeImports.get(dept);
    if (active) return existing;

    const promise = this.downloadAndImportDepartment(dept)
      .catch(error => {
        this.logger.error(`Import coordonnées ARCEP ${dept} échoué`, error?.stack || error?.message || error);
        return this.getImportStatus(dept);
      })
      .finally(() => this.activeImports.delete(dept));
    this.activeImports.set(dept, promise);
    return existing;
  }

  private async downloadAndImportDepartment(dept: string): Promise<AcquiscanImportStatus> {
    const url = `${this.getArcepBaseImbBaseUrl()}/base_imb_${dept}.csv.gz`;
    this.logger.log(`Import coordonnées ARCEP ${dept}: ${url}`);

    const response = await axios.get(url, {
      responseType: 'stream',
      timeout: 120000,
    });

    const gunzip = zlib.createGunzip();
    const lines = readline.createInterface({
      input: response.data.pipe(gunzip),
      crlfDelay: Infinity,
    });

    let headers: string[] | null = null;
    let importedCount = 0;
    let batch: CsvCoordinateRow[] = [];

    for await (const line of lines) {
      if (!headers) {
        headers = this.parseCsvLine(line);
        continue;
      }

      if (!line.trim()) continue;
      const record = this.mapBaseImbRecord(headers, this.parseCsvLine(line), dept);
      if (!record) continue;

      batch.push(record);
      if (batch.length >= 1000) {
        importedCount += await this.insertCoordinateBatch(batch);
        batch = [];
      }
    }

    if (batch.length > 0) {
      importedCount += await this.insertCoordinateBatch(batch);
    }

    this.logger.log(`Import coordonnées ARCEP ${dept} terminé: ${importedCount} lignes`);
    return this.getImportStatus(dept);
  }

  private async insertCoordinateBatch(batch: CsvCoordinateRow[]): Promise<number> {
    if (!batch.length) return 0;
    await this.prisma.acquiscanAddressCoordinate.createMany({
      data: batch,
      skipDuplicates: true,
    });
    return batch.length;
  }

  private mapBaseImbRecord(headers: string[], values: string[], dept: string): CsvCoordinateRow | null {
    const get = (name: string) => {
      const index = headers.indexOf(name);
      return index >= 0 ? this.cleanCsvValue(values[index]) : null;
    };

    const immeubleId = get('imb_id');
    if (!immeubleId) return null;

    const codeInsee = get('imb_code_insee') || get('addr_code_insee');
    const imbX = this.toNullableNumber(get('imb_x'));
    const imbY = this.toNullableNumber(get('imb_y'));
    const lngLat = imbX !== null && imbY !== null ? this.webMercatorToLngLat(imbX, imbY) : null;

    return {
      immeubleId,
      dept,
      codeInsee,
      imbCode: get('imb_code'),
      addrCode: get('addr_code'),
      addrNumero: get('addr_numero'),
      addrNomVoie: get('addr_nom_voie'),
      addrNomCommune: get('addr_nom_commune'),
      imbX,
      imbY,
      longitude: lngLat?.longitude ?? null,
      latitude: lngLat?.latitude ?? null,
    };
  }

  private async fetchCopperBuildings(input: AcquiscanAddressesInput & { dept: string; limit: number; offset: number }) {
    const token = await this.getAccessToken();
    const params = new URLSearchParams({
      dept: input.dept,
      limit: String(input.limit),
      offset: String(input.offset),
    });

    this.setOptionalParam(params, 'commune', input.commune);
    this.setOptionalParam(params, 'annee', input.annee);
    this.setOptionalParam(params, 'search', input.search);
    this.setOptionalParam(params, 'fiber', input.fiber);
    this.setOptionalParam(params, 'coverage4g', input.coverage4g);
    this.setOptionalParam(params, 'coverage5g', input.coverage5g);
    this.setOptionalParam(params, 'segment', input.segment);

    const response = await axios.get<AcquiscanCopperBuildingsResponse>(
      `${this.getApiBaseUrl()}/api/v1/map/copper-buildings?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 30000,
      },
    );

    return {
      rows: response.data.data?.rows ?? [],
      total: response.data.data?.total ?? 0,
    };
  }

  private async getAccessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 10000) {
      return this.token.value;
    }

    const issuer = process.env.ACQUISCAN_KEYCLOAK_ISSUER
      || 'https://finanssor-data-center-v1.tail446cc0.ts.net:3991/realms/acquiscan';
    const clientId = process.env.ACQUISCAN_CLIENT_ID || 'acquiscan-app';
    const clientSecret = process.env.ACQUISCAN_CLIENT_SECRET;

    if (!clientSecret) {
      throw new ServiceUnavailableException('ACQUISCAN_CLIENT_SECRET non configuré');
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'openid profile email',
    });

    const response = await axios.post<AcquiscanTokenResponse>(
      `${issuer}/protocol/openid-connect/token`,
      body.toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        httpsAgent: this.getKeycloakHttpsAgent(issuer),
        timeout: 15000,
      },
    );

    this.token = {
      value: response.data.access_token,
      expiresAt: Date.now() + response.data.expires_in * 1000,
    };
    return this.token.value;
  }

  private async getImportStatus(dept: string): Promise<AcquiscanImportStatus> {
    const [importedCount, latest] = await Promise.all([
      this.prisma.acquiscanAddressCoordinate.count({ where: { dept } }),
      this.prisma.acquiscanAddressCoordinate.findFirst({
        where: { dept },
        orderBy: { importedAt: 'desc' },
      }),
    ]);

    return {
      dept,
      isImported: importedCount > 0,
      importedCount,
      importedAt: latest?.importedAt ?? null,
    };
  }

  private normalizeDept(dept: string): string {
    const normalized = dept.trim().toUpperCase();
    if (!/^(\d{2,3}|2A|2B)$/.test(normalized)) {
      throw new BadRequestException('Département Acquiscan invalide');
    }
    return normalized.padStart(2, '0');
  }

  private parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const next = line[index + 1];
      if (char === '"' && inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ';' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);
    return values;
  }

  private cleanCsvValue(value?: string | null): string | null {
    if (value == null) return null;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }

  private toNullableNumber(value?: string | number | null): number | null {
    if (value == null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private toNullableInt(value?: string | number | null): number | null {
    const parsed = this.toNullableNumber(value);
    return parsed === null ? null : Math.trunc(parsed);
  }

  private webMercatorToLngLat(x: number, y: number) {
    const longitude = (x / WEB_MERCATOR_RADIUS) * (180 / Math.PI);
    const latitude = (2 * Math.atan(Math.exp(y / WEB_MERCATOR_RADIUS)) - Math.PI / 2) * (180 / Math.PI);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
    return { longitude, latitude };
  }

  private setOptionalParam(params: URLSearchParams, key: string, value?: string | null) {
    if (value != null && value !== '' && value !== 'all') {
      params.set(key, value);
    }
  }

  private getApiBaseUrl() {
    return (process.env.ACQUISCAN_API_BASE_URL || 'https://api.acquiscan.com').replace(/\/+$/, '');
  }

  private getKeycloakHttpsAgent(issuer: string) {
    const forcedIp = process.env.ACQUISCAN_KEYCLOAK_RESOLVE_IP;
    if (!forcedIp) return undefined;

    const issuerUrl = new URL(issuer);
    if (issuerUrl.protocol !== 'https:') return undefined;

    return new https.Agent({
      servername: issuerUrl.hostname,
      lookup: (_hostname, _options, callback) => {
        const family = forcedIp.includes(':') ? 6 : 4;
        if (_options?.all) {
          callback(null, [{ address: forcedIp, family }]);
          return;
        }
        callback(null, forcedIp, family);
      },
    });
  }

  private getArcepBaseImbBaseUrl() {
    return (process.env.ACQUISCAN_ARCEP_BASE_IMB_URL
      || 'https://data.arcep.fr/fixe/maconnexioninternet/base_imb/last/departement').replace(/\/+$/, '');
  }
}
