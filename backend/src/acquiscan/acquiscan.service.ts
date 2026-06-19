import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import axios from 'axios';
import * as https from 'https';
import * as readline from 'readline';
import * as zlib from 'zlib';
import { PrismaService } from '../prisma.service';
import {
  AcquiscanAddress,
  AcquiscanAddressSearchInput,
  AcquiscanAddressSuggestion,
  AcquiscanAddressesInput,
  AcquiscanAddressesPage,
  AcquiscanBoundsInput,
  AcquiscanCommuneOpportunitiesInput,
  AcquiscanCommuneOpportunitiesPage,
  AcquiscanCommuneOpportunity,
  AcquiscanCopperBuildingOpportunity,
  AcquiscanCopperBuildingsInput,
  AcquiscanCopperBuildingsPage,
  AcquiscanDepartmentOpportunitiesPage,
  AcquiscanDepartmentOpportunity,
  AcquiscanMapInput,
  AcquiscanMapPoint,
  AcquiscanMapResult,
  AcquiscanImportStatus,
  AcquiscanOpportunitySummary,
  AcquiscanZonePreviewInput,
  AcquiscanZonePreviewResult,
  AcquiscanZoneTargetPreview,
  CreateAcquiscanZoneInput,
} from './acquiscan.dto';

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

type AcquiscanTerritoryStats = {
  code_dept: string;
  code_insee?: string | null;
  nom_commune?: string | null;
  total_buildings?: number | string | null;
  fiber_buildings?: number | string | null;
  copper_buildings?: number | string | null;
  copper_shutdown?: number | string | null;
  fiber_rate?: number | string | null;
  copper_shutdown_rate?: number | string | null;
  closest_shutdown_year?: number | string | null;
  sites_4g?: number | string | null;
  sites_5g?: number | string | null;
  sites_total?: number | string | null;
};

type AcquiscanStatsResponse = {
  data?: AcquiscanTerritoryStats[] | {
    rows?: AcquiscanTerritoryStats[];
    data?: AcquiscanTerritoryStats[];
  };
};

type AcquiscanAutocompleteResponse = {
  data?: unknown;
  results?: unknown;
  suggestions?: unknown;
};

type BanAddressFeatureCollection = {
  features?: unknown[];
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
const MAP_DETAIL_ZOOM = 10;
const MAP_DEFAULT_LIMIT = 500;
const MAP_MAX_POINTS = 500;
const MAP_MAX_CLUSTERS = 300;
const ZONE_PREVIEW_MAX_COORDINATES = 2500;
const ZONE_PREVIEW_MAX_ACQUISCAN_PAGES = 40;

@Injectable()
export class AcquiscanService {
  private readonly logger = new Logger(AcquiscanService.name);
  private token: { value: string; expiresAt: number } | null = null;
  private readonly activeImports = new Map<string, Promise<AcquiscanImportStatus>>();

  constructor(private readonly prisma: PrismaService) {}

  async searchAddressSuggestions(input: AcquiscanAddressSearchInput): Promise<AcquiscanAddressSuggestion[]> {
    const query = input.query.trim();
    if (query.length < 2) return [];
    const limit = Math.min(input.limit ?? 8, 20);

    const banItems = await this.fetchBanAddressSuggestions(query, limit);
    if (banItems.length) {
      return this.mergeAddressSuggestions(banItems).slice(0, limit);
    }

    const params = new URLSearchParams({
      q: query,
      limit: String(limit),
    });
    const acquiscanItems = await this.fetchAcquiscanAddressSuggestions(params);

    return this.mergeAddressSuggestions(acquiscanItems)
      .filter((item): item is AcquiscanAddressSuggestion => Boolean(item))
      .slice(0, limit);
  }

  async findDepartmentOpportunities(): Promise<AcquiscanDepartmentOpportunitiesPage> {
    const rows = await this.fetchTerritoryStats('/api/v1/map/departments');
    const mappedRows = rows
      .map(row => this.mapDepartmentOpportunity(row))
      .sort((a, b) => b.summary.opportunityScore - a.summary.opportunityScore);

    return {
      rows: mappedRows,
      summary: this.buildAggregateSummary(mappedRows.map(row => row.summary)),
    };
  }

  async findCommuneOpportunities(input: AcquiscanCommuneOpportunitiesInput): Promise<AcquiscanCommuneOpportunitiesPage> {
    const dept = this.normalizeDept(input.dept);
    const params = new URLSearchParams({ dept });
    const rows = await this.fetchTerritoryStats(`/api/v1/map/communes?${params.toString()}`);
    const mappedRows = rows
      .map(row => this.mapCommuneOpportunity(row, dept))
      .sort((a, b) => b.summary.opportunityScore - a.summary.opportunityScore);

    return {
      rows: mappedRows,
      summary: this.buildAggregateSummary(mappedRows.map(row => row.summary)),
    };
  }

  async findCopperBuildingOpportunities(input: AcquiscanCopperBuildingsInput): Promise<AcquiscanCopperBuildingsPage> {
    const dept = this.normalizeDept(input.dept);
    const limit = Math.min(input.limit ?? 100, 500);
    const offset = input.offset ?? 0;
    const copperPage = await this.fetchCopperBuildings({ ...input, dept, limit, offset });
    const coordinatesById = await this.findCoordinatesForCopperRows(copperPage.rows);

    return {
      rows: copperPage.rows.map(row => this.mapCopperBuildingOpportunity(row, coordinatesById.get(row.immeuble_id) || null)),
      total: copperPage.total,
      limit,
      offset,
    };
  }

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

  async findMapAddresses(input: AcquiscanMapInput): Promise<AcquiscanMapResult> {
    const bounds = this.validateBounds(input.bounds);
    const zoom = this.validateZoom(input.zoom);
    const limit = Math.min(input.limit ?? MAP_DEFAULT_LIMIT, MAP_MAX_POINTS);
    const dept = input.dept ? this.normalizeDept(input.dept) : undefined;
    const where = this.buildMapCoordinateWhere({ ...input, dept, bounds });
    const shouldCluster = input.cluster ?? zoom < MAP_DETAIL_ZOOM;
    const hasBusinessFilters = this.hasBusinessMapFilters(input);

    const [totalInBounds, coverage] = await Promise.all([
      this.prisma.acquiscanAddressCoordinate.count({ where }),
      this.getMapCoverage(where),
    ]);
    const effectiveFilteredDept = dept ?? (hasBusinessFilters && coverage.length === 1 ? coverage[0].dept : undefined);

    if (effectiveFilteredDept && hasBusinessFilters) {
      const filteredMap = await this.findFilteredDepartmentMapPoints(input, bounds, effectiveFilteredDept, MAP_MAX_POINTS);
      if (shouldCluster) {
        const clusters = this.clusterMapPoints(filteredMap.points, bounds, zoom);
        return {
          points: [],
          clusters,
          totalInBounds: filteredMap.points.length,
          returnedCount: clusters.length,
          tooManyResults: filteredMap.total > filteredMap.points.length,
          clustered: true,
          coverage,
        };
      }

      return {
        points: filteredMap.points.slice(0, limit),
        clusters: [],
        totalInBounds: filteredMap.points.length,
        returnedCount: Math.min(filteredMap.points.length, limit),
        tooManyResults: filteredMap.total > filteredMap.points.length || filteredMap.points.length > limit,
        clustered: false,
        coverage,
      };
    }

    if (shouldCluster) {
      const clusters = await this.findMapClusters({
        bounds,
        zoom,
        dept,
        commune: input.commune,
        search: input.search,
      });

      return {
        points: [],
        clusters,
        totalInBounds,
        returnedCount: clusters.length,
        tooManyResults: totalInBounds > clusters.reduce((sum, cluster) => sum + cluster.count, 0),
        clustered: true,
        coverage,
      };
    }

    if (dept) {
      const enrichedPoints = await this.findDepartmentMapPoints(input, bounds, dept, limit);
      return {
        points: enrichedPoints,
        clusters: [],
        totalInBounds,
        returnedCount: enrichedPoints.length,
        tooManyResults: totalInBounds > enrichedPoints.length,
        clustered: false,
        coverage,
      };
    }

    const rows = await this.prisma.acquiscanAddressCoordinate.findMany({
      where,
      orderBy: [{ dept: 'asc' }, { id: 'asc' }],
      take: limit,
    });

    const points = rows
      .filter(row => row.latitude !== null && row.longitude !== null)
      .map(row => ({
        id: String(row.id),
        immeubleId: row.immeubleId,
        imbCode: row.imbCode,
        addrNumero: row.addrNumero,
        addrNomVoie: row.addrNomVoie,
        addrNomCommune: row.addrNomCommune,
        codeInsee: row.codeInsee,
        nbrLogements: null,
        fermetureTechnique: null,
        fermetureComZone: null,
        fermetureComAddr: null,
        eligFo: null,
        anneeFt: null,
        sites4g: null,
        sites5g: null,
        sitesTotal: null,
        dept: row.dept,
        latitude: row.latitude as number,
        longitude: row.longitude as number,
      }));

    return {
      points,
      clusters: [],
      totalInBounds,
      returnedCount: points.length,
      tooManyResults: totalInBounds > points.length,
      clustered: false,
      coverage,
    };
  }

  async previewZoneTargets(input: AcquiscanZonePreviewInput): Promise<AcquiscanZonePreviewResult> {
    const circle = this.validateZoneCircle(input);
    const bounds = this.boundsForCircle(circle.longitude, circle.latitude, circle.radiusMeters);
    const limit = Math.min(input.limit ?? MAP_DEFAULT_LIMIT, MAP_MAX_POINTS);
    const requestedDept = input.dept ? this.normalizeDept(input.dept) : undefined;
    const coordinateInput: AcquiscanMapInput = {
      bounds,
      zoom: 14,
      dept: requestedDept,
      commune: input.commune,
      cluster: false,
    };
    const coordinateCandidates = (await this.findCoordinatePreviewPoints(coordinateInput, bounds, ZONE_PREVIEW_MAX_COORDINATES))
      .map(point => ({
        ...point,
        distanceMeters: this.distanceMeters(circle.latitude, circle.longitude, point.latitude, point.longitude),
      }))
      .filter(point => point.distanceMeters <= circle.radiusMeters)
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
    const inferredDept = this.pickDominantValue(coordinateCandidates.map(point => point.dept));
    const inferredCommune = this.pickDominantValue(coordinateCandidates.map(point => point.codeInsee ?? undefined));
    const dept = requestedDept ?? inferredDept;
    const commune = input.commune ?? inferredCommune;
    const mapLikeInput: AcquiscanMapInput = {
      bounds,
      zoom: 14,
      dept,
      commune,
      annee: input.annee,
      fiber: input.fiber,
      coverage4g: input.coverage4g,
      coverage5g: input.coverage5g,
      segment: input.segment,
      limit,
      cluster: false,
    };

    const candidates = dept
      ? await this.findFilteredZonePreviewPoints(mapLikeInput, coordinateCandidates, dept, limit)
      : this.hasBusinessMapFilters(input)
        ? []
        : coordinateCandidates.slice(0, limit);

    const targets = candidates
      .map(point => ({
        ...point,
        distanceMeters: point.distanceMeters,
        opportunityScore: this.scoreMapPointOpportunity(point),
      }))
      .sort((a, b) => b.opportunityScore - a.opportunityScore || a.distanceMeters - b.distanceMeters);

    const sliced = targets.slice(0, limit);
    return {
      targets: sliced,
      summary: this.buildZonePreviewSummary(sliced),
      totalInCircle: targets.length,
      tooManyResults: targets.length > sliced.length,
    };
  }

  async createZoneFromAcquiscan(input: CreateAcquiscanZoneInput) {
    const preview = await this.previewZoneTargets(input);
    const selectedIds = new Set(input.selectedImmeubleIds?.length ? input.selectedImmeubleIds : preview.targets.map(target => target.immeubleId));
    const targets = preview.targets.filter(target => selectedIds.has(target.immeubleId));
    if (!targets.length) {
      throw new BadRequestException('Aucune adresse Acquiscan sélectionnée dans cette zone');
    }

    const filtersSnapshot = {
      dept: input.dept ?? null,
      commune: input.commune ?? null,
      annee: input.annee ?? null,
      fiber: input.fiber ?? null,
      coverage4g: input.coverage4g ?? null,
      coverage5g: input.coverage5g ?? null,
      segment: input.segment ?? null,
      radiusMeters: input.radiusMeters,
      center: { longitude: input.longitude, latitude: input.latitude },
    };

    return this.prisma.zone.create({
      data: {
        nom: input.nom,
        xOrigin: input.longitude,
        yOrigin: input.latitude,
        rayon: input.radiusMeters,
        directeurId: input.directeurId,
        managerId: input.managerId,
        acquiscanTargets: {
          create: targets.map(target => ({
            immeubleId: target.immeubleId,
            dept: target.dept,
            codeInsee: target.codeInsee,
            imbCode: target.imbCode,
            addrNumero: target.addrNumero,
            addrNomVoie: target.addrNomVoie,
            addrNomCommune: target.addrNomCommune,
            nbrLogements: target.nbrLogements,
            fermetureTechnique: target.fermetureTechnique,
            fermetureComZone: target.fermetureComZone,
            fermetureComAddr: target.fermetureComAddr,
            eligFo: target.eligFo,
            anneeFt: target.anneeFt,
            sites4g: target.sites4g,
            sites5g: target.sites5g,
            sitesTotal: target.sitesTotal,
            latitude: target.latitude,
            longitude: target.longitude,
            distanceMeters: target.distanceMeters,
            opportunityScore: target.opportunityScore,
            filtersSnapshot,
          })),
        },
      },
    });
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

  private buildMapCoordinateWhere(input: AcquiscanMapInput & { dept?: string; bounds: AcquiscanBoundsInput }): Prisma.AcquiscanAddressCoordinateWhereInput {
    const where: Prisma.AcquiscanAddressCoordinateWhereInput = {
      latitude: { not: null, gte: input.bounds.south, lte: input.bounds.north },
      longitude: { not: null, gte: input.bounds.west, lte: input.bounds.east },
    };

    if (input.dept) {
      where.dept = input.dept;
    }

    if (input.commune) {
      where.codeInsee = input.commune;
    }

    const search = input.search?.trim();
    if (search) {
      where.OR = [
        { immeubleId: { contains: search, mode: 'insensitive' } },
        { imbCode: { contains: search, mode: 'insensitive' } },
        { addrNumero: { contains: search, mode: 'insensitive' } },
        { addrNomVoie: { contains: search, mode: 'insensitive' } },
        { addrNomCommune: { contains: search, mode: 'insensitive' } },
        { codeInsee: { contains: search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private async findCoordinatePreviewPoints(
    input: AcquiscanMapInput,
    bounds: AcquiscanBoundsInput,
    limit: number,
  ): Promise<AcquiscanMapPoint[]> {
    const rows = await this.prisma.acquiscanAddressCoordinate.findMany({
      where: this.buildMapCoordinateWhere({ ...input, bounds }),
      take: limit,
      orderBy: { id: 'asc' },
    });

    return rows.flatMap(row => {
      if (!row.latitude || !row.longitude) return [];
      return [{
        id: String(row.id),
        immeubleId: row.immeubleId,
        imbCode: row.imbCode,
        addrNumero: row.addrNumero,
        addrNomVoie: row.addrNomVoie,
        addrNomCommune: row.addrNomCommune,
        codeInsee: row.codeInsee,
        nbrLogements: null,
        fermetureTechnique: null,
        fermetureComZone: null,
        fermetureComAddr: null,
        eligFo: null,
        anneeFt: null,
        sites4g: null,
        sites5g: null,
        sitesTotal: null,
        dept: row.dept,
        latitude: row.latitude,
        longitude: row.longitude,
      }];
    });
  }

  private async findFilteredZonePreviewPoints(
    input: AcquiscanMapInput,
    coordinateCandidates: Array<AcquiscanMapPoint & { distanceMeters: number }>,
    dept: string,
    limit: number,
  ): Promise<Array<AcquiscanMapPoint & { distanceMeters: number }>> {
    if (!coordinateCandidates.length) return [];

    const candidateIds = new Set(coordinateCandidates.map(point => point.immeubleId).filter(Boolean));
    const candidateImbCodes = new Set(coordinateCandidates.map(point => point.imbCode).filter((code): code is string => Boolean(code)));
    const coordinatesById = new Map(coordinateCandidates.map(point => [point.immeubleId, point]));
    const coordinatesByImbCode = new Map(
      coordinateCandidates
        .filter(point => point.imbCode)
        .map(point => [point.imbCode as string, point]),
    );
    const found = new Map<string, AcquiscanMapPoint & { distanceMeters: number }>();
    let offset = 0;
    let total = Number.POSITIVE_INFINITY;
    let pages = 0;

    while (offset < total && pages < ZONE_PREVIEW_MAX_ACQUISCAN_PAGES && found.size < Math.min(limit, coordinateCandidates.length)) {
      const copperPage = await this.fetchCopperBuildings({
        ...input,
        dept,
        limit: MAP_MAX_POINTS,
        offset,
      });
      total = copperPage.total;
      pages += 1;
      offset += MAP_MAX_POINTS;

      copperPage.rows.forEach(row => {
        if (!candidateIds.has(row.immeuble_id) && (!row.imb_code || !candidateImbCodes.has(row.imb_code))) return;
        const coordinate = coordinatesById.get(row.immeuble_id) || (row.imb_code ? coordinatesByImbCode.get(row.imb_code) : null);
        if (!coordinate) return;
        found.set(row.immeuble_id, {
          id: coordinate.id,
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
          dept: coordinate.dept,
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          distanceMeters: coordinate.distanceMeters,
        });
      });
    }

    return Array.from(found.values())
      .filter(point => this.matchesZonePreviewFilters(point, input))
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, limit);
  }

  private matchesZonePreviewFilters(point: AcquiscanMapPoint, input: Pick<AcquiscanMapInput, 'segment' | 'fiber' | 'annee' | 'coverage4g' | 'coverage5g'>) {
    if (input.fiber === 'yes' && point.eligFo !== '1') return false;
    if (input.fiber === 'no' && point.eligFo !== '0') return false;

    if (input.segment && input.segment !== 'all') {
      const hasTechClosure = point.fermetureTechnique === '1';
      const hasAddrClosure = point.fermetureComAddr === '1';
      const hasZoneClosure = point.fermetureComZone === '1';
      if (input.segment === 'urgent' && !hasTechClosure) return false;
      if (input.segment === 'chaud' && !hasAddrClosure) return false;
      if (input.segment === 'tiede' && !hasZoneClosure) return false;
      if (input.segment === 'froid' && (hasTechClosure || hasAddrClosure || hasZoneClosure)) return false;
    }

    if (input.annee && input.annee !== 'all') {
      const year = this.toNullableInt(point.anneeFt);
      const currentYear = new Date().getFullYear();
      if (input.annee === 'current' && year !== currentYear) return false;
      if (input.annee === 'future' && (year == null || year <= currentYear)) return false;
      if (/^\d{4}$/.test(input.annee) && year !== Number(input.annee)) return false;
    }

    if (!this.matchesCoverageFilter(point.sites4g, input.coverage4g)) return false;
    if (!this.matchesCoverageFilter(point.sites5g, input.coverage5g)) return false;
    return true;
  }

  private matchesCoverageFilter(value: number | null | undefined, filter?: string) {
    if (!filter || filter === 'all') return true;
    const count = this.toSafeInt(value);
    if (filter === 'faible') return count <= 1;
    if (filter === 'moyen') return count >= 2 && count <= 4;
    if (filter === 'eleve') return count >= 5;
    return true;
  }

  private pickDominantValue(values: Array<string | undefined | null>) {
    const counts = new Map<string, number>();
    values.filter((value): value is string => Boolean(value)).forEach(value => {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
  }

  private validateZoneCircle(input: AcquiscanZonePreviewInput) {
    if (!this.isValidLongitude(input.longitude) || !this.isValidLatitude(input.latitude)) {
      throw new BadRequestException('Centre de zone Acquiscan invalide');
    }
    if (!Number.isFinite(input.radiusMeters) || input.radiusMeters < 50 || input.radiusMeters > 10000) {
      throw new BadRequestException('Rayon de zone Acquiscan invalide');
    }
    return {
      longitude: input.longitude,
      latitude: input.latitude,
      radiusMeters: input.radiusMeters,
    };
  }

  private boundsForCircle(longitude: number, latitude: number, radiusMeters: number): AcquiscanBoundsInput {
    const latDelta = radiusMeters / 111_320;
    const lngDelta = radiusMeters / (111_320 * Math.max(Math.cos(latitude * Math.PI / 180), 0.2));
    return {
      west: Math.max(-180, longitude - lngDelta),
      south: Math.max(-90, latitude - latDelta),
      east: Math.min(180, longitude + lngDelta),
      north: Math.min(90, latitude + latDelta),
    };
  }

  private distanceMeters(latA: number, lngA: number, latB: number, lngB: number) {
    const radius = 6_371_000;
    const toRad = (value: number) => value * Math.PI / 180;
    const dLat = toRad(latB - latA);
    const dLng = toRad(lngB - lngA);
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(toRad(latA)) * Math.cos(toRad(latB)) * Math.sin(dLng / 2) ** 2;
    return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private scoreMapPointOpportunity(point: AcquiscanMapPoint) {
    const logements = this.toSafeInt(point.nbrLogements);
    const hasCopperSignal = point.fermetureTechnique === '1' || point.fermetureComAddr === '1' || point.fermetureComZone === '1';
    const fiberAvailable = point.eligFo === '1';
    const timingScore = point.fermetureTechnique === '1' ? 30 : point.fermetureComAddr === '1' ? 24 : point.fermetureComZone === '1' ? 16 : 6;
    const mobileScore = Math.min(12, (this.toSafeInt(point.sites4g) * 2) + (this.toSafeInt(point.sites5g) * 3));
    return Math.round(Math.min(100, 20 + timingScore + (fiberAvailable ? 10 : 0) + Math.min(logements, 25) + mobileScore + (hasCopperSignal ? 0 : -5)));
  }

  private buildZonePreviewSummary(targets: AcquiscanZoneTargetPreview[]) {
    const totalLogements = targets.reduce((sum, target) => sum + this.toSafeInt(target.nbrLogements), 0);
    const scoreSum = targets.reduce((sum, target) => sum + target.opportunityScore, 0);
    return {
      totalTargets: targets.length,
      totalLogements,
      noFiberTargets: targets.filter(target => target.eligFo === '0').length,
      fiberTargets: targets.filter(target => target.eligFo === '1').length,
      copperClosureTargets: targets.filter(target => (
        target.fermetureTechnique === '1'
        || target.fermetureComAddr === '1'
        || target.fermetureComZone === '1'
      )).length,
      strong4gTargets: targets.filter(target => this.toSafeInt(target.sites4g) >= 3).length,
      strong5gTargets: targets.filter(target => this.toSafeInt(target.sites5g) >= 1).length,
      averageOpportunityScore: targets.length ? Math.round(scoreSum / targets.length) : 0,
    };
  }

  private async findDepartmentMapPoints(
    input: AcquiscanMapInput,
    bounds: AcquiscanBoundsInput,
    dept: string,
    limit: number,
  ) {
    return (await this.findFilteredDepartmentMapPoints(input, bounds, dept, limit)).points;
  }

  private async findFilteredDepartmentMapPoints(
    input: AcquiscanMapInput,
    bounds: AcquiscanBoundsInput,
    dept: string,
    limit: number,
  ): Promise<{ points: AcquiscanMapPoint[]; total: number }> {
    const copperPage = await this.fetchCopperBuildings({
      ...input,
      dept,
      limit,
      offset: 0,
    });
    const rows = copperPage.rows;
    const ids = rows.map(row => row.immeuble_id).filter(Boolean);
    const imbCodes = rows.map(row => row.imb_code).filter((code): code is string => Boolean(code));
    const coordinateWhere: Prisma.AcquiscanAddressCoordinateWhereInput[] = [];
    if (ids.length) coordinateWhere.push({ immeubleId: { in: ids } });
    if (imbCodes.length) coordinateWhere.push({ imbCode: { in: imbCodes } });
    if (!coordinateWhere.length) return { points: [], total: copperPage.total };

    const coordinates = await this.prisma.acquiscanAddressCoordinate.findMany({
      where: { OR: coordinateWhere },
    });
    const coordinatesById = new Map(coordinates.map(item => [item.immeubleId, item]));
    const coordinatesByImbCode = new Map(
      coordinates
        .filter(item => item.imbCode)
        .map(item => [item.imbCode, item]),
    );

    const points = rows.flatMap(row => {
      const coordinate = coordinatesById.get(row.immeuble_id) || (row.imb_code ? coordinatesByImbCode.get(row.imb_code) : null);
      if (!coordinate?.latitude || !coordinate.longitude) return [];
      if (
        coordinate.latitude < bounds.south ||
        coordinate.latitude > bounds.north ||
        coordinate.longitude < bounds.west ||
        coordinate.longitude > bounds.east
      ) {
        return [];
      }

      return [{
        id: String(coordinate.id),
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
        dept: coordinate.dept,
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
      }];
    });

    return { points, total: copperPage.total };
  }

  private hasBusinessMapFilters(input: Pick<AcquiscanMapInput, 'segment' | 'fiber' | 'annee' | 'coverage4g' | 'coverage5g'>) {
    return Boolean(
      (input.segment && input.segment !== 'all')
        || (input.fiber && input.fiber !== 'all')
        || (input.annee && input.annee !== 'all')
        || (input.coverage4g && input.coverage4g !== 'all')
        || (input.coverage5g && input.coverage5g !== 'all'),
    );
  }

  private clusterMapPoints(points: AcquiscanMapPoint[], bounds: AcquiscanBoundsInput, zoom: number) {
    const cellSize = this.getClusterCellSize(zoom);
    const buckets = new Map<string, { latBucket: number; lngBucket: number; latitude: number; longitude: number; count: number }>();

    points.forEach(point => {
      const latBucket = Math.floor((point.latitude - bounds.south) / cellSize);
      const lngBucket = Math.floor((point.longitude - bounds.west) / cellSize);
      const key = `${latBucket}:${lngBucket}`;
      const current = buckets.get(key);
      if (current) {
        current.latitude += point.latitude;
        current.longitude += point.longitude;
        current.count += 1;
        return;
      }

      buckets.set(key, {
        latBucket,
        lngBucket,
        latitude: point.latitude,
        longitude: point.longitude,
        count: 1,
      });
    });

    return Array.from(buckets.values())
      .map(bucket => ({
        id: `${bucket.latBucket}:${bucket.lngBucket}`,
        latitude: bucket.latitude / bucket.count,
        longitude: bucket.longitude / bucket.count,
        count: bucket.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, MAP_MAX_CLUSTERS);
  }

  private async getMapCoverage(where: Prisma.AcquiscanAddressCoordinateWhereInput) {
    const coverage = await this.prisma.acquiscanAddressCoordinate.groupBy({
      by: ['dept'],
      where,
      _count: { _all: true },
      _max: { importedAt: true },
      orderBy: { dept: 'asc' },
      take: 80,
    });

    return coverage.map(item => ({
      dept: item.dept,
      importedCount: item._count._all,
      importedAt: item._max.importedAt,
    }));
  }

  private async findMapClusters(input: {
    bounds: AcquiscanBoundsInput;
    zoom: number;
    dept?: string;
    commune?: string;
    search?: string;
  }) {
    const cellSize = this.getClusterCellSize(input.zoom);
    const clauses: Prisma.Sql[] = [
      Prisma.sql`"latitude" IS NOT NULL`,
      Prisma.sql`"longitude" IS NOT NULL`,
      Prisma.sql`"latitude" BETWEEN ${input.bounds.south} AND ${input.bounds.north}`,
      Prisma.sql`"longitude" BETWEEN ${input.bounds.west} AND ${input.bounds.east}`,
    ];

    if (input.dept) {
      clauses.push(Prisma.sql`"dept" = ${input.dept}`);
    }

    if (input.commune) {
      clauses.push(Prisma.sql`"code_insee" = ${input.commune}`);
    }

    const search = input.search?.trim();
    if (search) {
      const like = `%${search}%`;
      clauses.push(Prisma.sql`(
        "immeuble_id" ILIKE ${like}
        OR "imb_code" ILIKE ${like}
        OR "addr_numero" ILIKE ${like}
        OR "addr_nom_voie" ILIKE ${like}
        OR "addr_nom_commune" ILIKE ${like}
        OR "code_insee" ILIKE ${like}
      )`);
    }

    const rows = await this.prisma.$queryRaw<
      Array<{
        lat_bucket: number;
        lng_bucket: number;
        latitude: number;
        longitude: number;
        count: number;
      }>
    >(Prisma.sql`
      SELECT
        FLOOR(("latitude" - ${input.bounds.south}) / ${cellSize})::int AS "lat_bucket",
        FLOOR(("longitude" - ${input.bounds.west}) / ${cellSize})::int AS "lng_bucket",
        AVG("latitude")::float AS "latitude",
        AVG("longitude")::float AS "longitude",
        COUNT(*)::int AS "count"
      FROM "acquiscan_address_coordinates"
      WHERE ${Prisma.join(clauses, ' AND ')}
      GROUP BY "lat_bucket", "lng_bucket"
      ORDER BY "count" DESC
      LIMIT ${MAP_MAX_CLUSTERS}
    `);

    return rows.map(row => ({
      id: `${row.lat_bucket}:${row.lng_bucket}`,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      count: Number(row.count),
    }));
  }

  private validateBounds(bounds: AcquiscanBoundsInput): AcquiscanBoundsInput {
    const values = [bounds.west, bounds.south, bounds.east, bounds.north];
    if (values.some(value => !Number.isFinite(value))) {
      throw new BadRequestException('Bounds Acquiscan invalides');
    }

    if (bounds.south < -90 || bounds.north > 90 || bounds.west < -180 || bounds.east > 180) {
      throw new BadRequestException('Bounds Acquiscan hors limites');
    }

    if (bounds.south >= bounds.north || bounds.west >= bounds.east) {
      throw new BadRequestException('Bounds Acquiscan incohérents');
    }

    return bounds;
  }

  private validateZoom(zoom: number): number {
    if (!Number.isFinite(zoom) || zoom < 0 || zoom > 22) {
      throw new BadRequestException('Zoom Acquiscan invalide');
    }
    return zoom;
  }

  private getClusterCellSize(zoom: number) {
    if (zoom < 6) return 0.8;
    if (zoom < 8) return 0.35;
    if (zoom < MAP_DETAIL_ZOOM) return 0.12;
    return 0.04;
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

  private async fetchTerritoryStats(path: string): Promise<AcquiscanTerritoryStats[]> {
    const token = await this.getAccessToken();
    const response = await axios.get<AcquiscanStatsResponse>(
      `${this.getApiBaseUrl()}${path}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 30000,
      },
    );

    const payload = response.data.data;
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.rows)) return payload.rows;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }

  private async fetchAcquiscanAddressSuggestions(params: URLSearchParams): Promise<AcquiscanAddressSuggestion[]> {
    try {
      const response = await axios.get<AcquiscanAutocompleteResponse>(
        `${this.getApiBaseUrl()}/api/v1/search/autocomplete?${params.toString()}`,
        { timeout: 2500 },
      );
      return this.extractAutocompleteItems(response.data)
        .map((item, index) => this.mapAddressSuggestion(item, index))
        .filter((item): item is AcquiscanAddressSuggestion => Boolean(item));
    } catch (error) {
      this.logger.warn(`Acquiscan autocomplete ignore: ${(error as Error).message?.substring(0, 120)}`);
      return [];
    }
  }

  private async fetchBanAddressSuggestions(query: string, limit: number): Promise<AcquiscanAddressSuggestion[]> {
    const params = new URLSearchParams({
      q: query,
      limit: String(Math.min(limit, 10)),
      autocomplete: '1',
    });

    try {
      const response = await axios.get<BanAddressFeatureCollection>(
        `${this.getBanAddressApiBaseUrl()}/search/?${params.toString()}`,
        { timeout: 8000 },
      );
      return (response.data.features ?? [])
        .map((item, index) => this.mapAddressSuggestion(item, index))
        .filter((item): item is AcquiscanAddressSuggestion => Boolean(item));
    } catch (error) {
      this.logger.warn(`BAN autocomplete indisponible: ${(error as Error).message?.substring(0, 120)}`);
      return [];
    }
  }

  private mergeAddressSuggestions(items: AcquiscanAddressSuggestion[]) {
    const seen = new Set<string>();
    return items
      .filter(item => {
        const key = item.id || `${item.latitude}:${item.longitude}:${item.label}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  private extractAutocompleteItems(payload: AcquiscanAutocompleteResponse): unknown[] {
    const data = payload.data;
    if (Array.isArray(data)) return data;
    if (Array.isArray(payload.results)) return payload.results;
    if (Array.isArray(payload.suggestions)) return payload.suggestions;
    if (data && typeof data === 'object') {
      const maybeData = data as Record<string, unknown>;
      if (Array.isArray(maybeData.results)) return maybeData.results;
      if (Array.isArray(maybeData.suggestions)) return maybeData.suggestions;
      if (Array.isArray(maybeData.rows)) return maybeData.rows;
      if (Array.isArray(maybeData.features)) return maybeData.features;
    }
    return [];
  }

  private mapAddressSuggestion(item: unknown, index: number): AcquiscanAddressSuggestion | null {
    if (!item || typeof item !== 'object') return null;
    const record = item as Record<string, unknown>;
    const properties = (record.properties && typeof record.properties === 'object'
      ? record.properties
      : {}) as Record<string, unknown>;
    const geometry = (record.geometry && typeof record.geometry === 'object'
      ? record.geometry
      : {}) as Record<string, unknown>;
    const coordinates = Array.isArray(geometry.coordinates) ? geometry.coordinates : null;
    const geometryLongitude = coordinates ? this.toNullableNumber(coordinates[0] as number | string) : null;
    const geometryLatitude = coordinates ? this.toNullableNumber(coordinates[1] as number | string) : null;
    const namedLongitude = this.pickNumber(record, properties, ['longitude', 'lon', 'lng']);
    const namedLatitude = this.pickNumber(record, properties, ['latitude', 'lat']);
    const xyLongitude = this.pickNumber(record, properties, ['x']);
    const xyLatitude = this.pickNumber(record, properties, ['y']);
    const longitude = this.isValidLongitude(geometryLongitude) ? geometryLongitude
      : this.isValidLongitude(namedLongitude) ? namedLongitude
        : this.isValidLongitude(xyLongitude) ? xyLongitude
          : null;
    const latitude = this.isValidLatitude(geometryLatitude) ? geometryLatitude
      : this.isValidLatitude(namedLatitude) ? namedLatitude
        : this.isValidLatitude(xyLatitude) ? xyLatitude
          : null;
    if (latitude == null || longitude == null) return null;

    const label = this.pickString(record, properties, ['label', 'display_name', 'displayName', 'name', 'adresse', 'address', 'value'])
      || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    const id = this.pickString(record, properties, ['id', 'id_ban_adresse', 'idBanAdresse', 'banId'])
      || `${label}-${index}`;

    return {
      id,
      label,
      city: this.pickString(record, properties, ['city', 'municipality', 'commune', 'nom_commune']) ?? null,
      postcode: this.pickString(record, properties, ['postcode', 'postalCode', 'code_postal']) ?? null,
      codeInsee: this.pickString(record, properties, ['citycode', 'codeInsee', 'code_insee']) ?? null,
      latitude,
      longitude,
      score: this.pickNumber(record, properties, ['score']) ?? null,
    };
  }

  private pickString(primary: Record<string, unknown>, secondary: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
      const value = primary[key] ?? secondary[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (typeof value === 'number') return String(value);
    }
    return null;
  }

  private pickNumber(primary: Record<string, unknown>, secondary: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
      const value = primary[key] ?? secondary[key];
      const parsed = this.toNullableNumber(value as string | number | null | undefined);
      if (parsed !== null) return parsed;
    }
    return null;
  }

  private mapDepartmentOpportunity(row: AcquiscanTerritoryStats): AcquiscanDepartmentOpportunity {
    return {
      codeDept: this.normalizeDept(row.code_dept),
      summary: this.mapOpportunitySummary(row),
    };
  }

  private mapCommuneOpportunity(row: AcquiscanTerritoryStats, dept: string): AcquiscanCommuneOpportunity {
    return {
      codeInsee: row.code_insee || '',
      nomCommune: row.nom_commune ?? null,
      codeDept: this.normalizeDept(row.code_dept || dept),
      summary: this.mapOpportunitySummary(row),
    };
  }

  private mapOpportunitySummary(row: AcquiscanTerritoryStats): AcquiscanOpportunitySummary {
    const totalBuildings = this.toSafeInt(row.total_buildings);
    const fiberBuildings = this.toSafeInt(row.fiber_buildings);
    const copperBuildings = this.toSafeInt(row.copper_buildings);
    const copperShutdown = this.toSafeInt(row.copper_shutdown);
    const fiberRate = this.toSafeFloat(row.fiber_rate);
    const copperShutdownRate = this.toSafeFloat(row.copper_shutdown_rate);
    const closestShutdownYear = this.toNullableInt(row.closest_shutdown_year);
    const sites4g = this.toSafeInt(row.sites_4g);
    const sites5g = this.toSafeInt(row.sites_5g);
    const sitesTotal = this.toSafeInt(row.sites_total);

    return {
      totalBuildings,
      fiberBuildings,
      copperBuildings,
      copperShutdown,
      fiberRate,
      copperShutdownRate,
      closestShutdownYear,
      sites4g,
      sites5g,
      sitesTotal,
      opportunityScore: this.scoreTerritoryOpportunity({
        totalBuildings,
        copperShutdownRate,
        fiberRate,
        closestShutdownYear,
      }),
    };
  }

  private buildAggregateSummary(items: AcquiscanOpportunitySummary[]): AcquiscanOpportunitySummary {
    const totals = items.reduce(
      (sum, item) => ({
        totalBuildings: sum.totalBuildings + item.totalBuildings,
        fiberBuildings: sum.fiberBuildings + item.fiberBuildings,
        copperBuildings: sum.copperBuildings + item.copperBuildings,
        copperShutdown: sum.copperShutdown + item.copperShutdown,
        sites4g: sum.sites4g + item.sites4g,
        sites5g: sum.sites5g + item.sites5g,
        sitesTotal: sum.sitesTotal + item.sitesTotal,
      }),
      { totalBuildings: 0, fiberBuildings: 0, copperBuildings: 0, copperShutdown: 0, sites4g: 0, sites5g: 0, sitesTotal: 0 },
    );
    const closestShutdownYear = items
      .map(item => item.closestShutdownYear)
      .filter((year): year is number => year != null)
      .sort((a, b) => a - b)[0] ?? null;
    const fiberRate = totals.totalBuildings > 0 ? (totals.fiberBuildings / totals.totalBuildings) * 100 : 0;
    const copperShutdownRate = totals.totalBuildings > 0 ? (totals.copperShutdown / totals.totalBuildings) * 100 : 0;

    return {
      ...totals,
      fiberRate,
      copperShutdownRate,
      closestShutdownYear,
      opportunityScore: this.scoreTerritoryOpportunity({
        totalBuildings: totals.totalBuildings,
        copperShutdownRate,
        fiberRate,
        closestShutdownYear,
      }),
    };
  }

  private async findCoordinatesForCopperRows(rows: AcquiscanCopperBuilding[]) {
    const ids = rows.map(row => row.immeuble_id).filter(Boolean);
    const imbCodes = rows.map(row => row.imb_code).filter((code): code is string => Boolean(code));
    const coordinateWhere: Prisma.AcquiscanAddressCoordinateWhereInput[] = [];
    if (ids.length) coordinateWhere.push({ immeubleId: { in: ids } });
    if (imbCodes.length) coordinateWhere.push({ imbCode: { in: imbCodes } });
    if (!coordinateWhere.length) return new Map<string, Prisma.AcquiscanAddressCoordinateGetPayload<object>>();

    const coordinates = await this.prisma.acquiscanAddressCoordinate.findMany({
      where: { OR: coordinateWhere },
    });
    const coordinatesById = new Map(coordinates.map(item => [item.immeubleId, item]));
    coordinates
      .filter(item => item.imbCode)
      .forEach(item => {
        if (item.imbCode && !coordinatesById.has(item.imbCode)) {
          coordinatesById.set(item.imbCode, item);
        }
      });

    rows.forEach(row => {
      if (!coordinatesById.has(row.immeuble_id) && row.imb_code && coordinatesById.has(row.imb_code)) {
        coordinatesById.set(row.immeuble_id, coordinatesById.get(row.imb_code)!);
      }
    });

    return coordinatesById;
  }

  private mapCopperBuildingOpportunity(
    row: AcquiscanCopperBuilding,
    coordinate?: Prisma.AcquiscanAddressCoordinateGetPayload<object> | null,
  ): AcquiscanCopperBuildingOpportunity {
    const opportunityScore = this.scoreBuildingOpportunity(row);
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
      opportunityScore,
      opportunityLabel: this.opportunityLabel(opportunityScore),
    };
  }

  private scoreTerritoryOpportunity(input: {
    totalBuildings: number;
    copperShutdownRate: number;
    fiberRate: number;
    closestShutdownYear?: number | null;
  }) {
    const densityScore = Math.min(25, Math.log10(Math.max(input.totalBuildings, 1)) * 7);
    const copperScore = Math.min(40, input.copperShutdownRate * 0.4);
    const fiberScore = Math.min(20, input.fiberRate * 0.2);
    const timingScore = input.closestShutdownYear && input.closestShutdownYear <= new Date().getFullYear() + 1 ? 15 : 5;
    return Math.round(Math.min(100, densityScore + copperScore + fiberScore + timingScore));
  }

  private scoreBuildingOpportunity(row: AcquiscanCopperBuilding) {
    const logements = this.toSafeInt(row.nbr_logements);
    const hasCopperSignal = row.fermeture_technique === '1' || row.fermeture_com_addr === '1' || row.fermeture_com_zone === '1';
    const fiberAvailable = row.elig_fo === '1';
    const timingScore = row.fermeture_technique === '1' ? 30 : row.fermeture_com_addr === '1' ? 24 : row.fermeture_com_zone === '1' ? 16 : 6;
    return Math.round(Math.min(100, 25 + timingScore + (fiberAvailable ? 15 : 0) + Math.min(logements, 30) + (hasCopperSignal ? 0 : -5)));
  }

  private opportunityLabel(score: number) {
    if (score >= 75) return 'Priorité haute';
    if (score >= 55) return 'Priorité moyenne';
    return 'À qualifier';
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

  private isValidLongitude(value: number | null): value is number {
    return value !== null && value >= -180 && value <= 180;
  }

  private isValidLatitude(value: number | null): value is number {
    return value !== null && value >= -90 && value <= 90;
  }

  private toNullableInt(value?: string | number | null): number | null {
    const parsed = this.toNullableNumber(value);
    return parsed === null ? null : Math.trunc(parsed);
  }

  private toSafeInt(value?: string | number | null): number {
    return this.toNullableInt(value) ?? 0;
  }

  private toSafeFloat(value?: string | number | null): number {
    return this.toNullableNumber(value) ?? 0;
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

  private getBanAddressApiBaseUrl() {
    return (process.env.BAN_ADDRESS_API_BASE_URL || 'https://api-adresse.data.gouv.fr').replace(/\/+$/, '');
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
