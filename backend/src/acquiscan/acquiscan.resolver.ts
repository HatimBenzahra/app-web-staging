import { Args, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  AcquiscanAddressesInput,
  AcquiscanAddressesPage,
  AcquiscanAddressSearchInput,
  AcquiscanAddressSuggestion,
  AcquiscanCommuneOpportunitiesInput,
  AcquiscanCommuneOpportunitiesPage,
  AcquiscanCopperBuildingsInput,
  AcquiscanCopperBuildingsPage,
  AcquiscanDepartmentOpportunitiesPage,
  AcquiscanMapInput,
  AcquiscanMapResult,
} from './acquiscan.dto';
import { AcquiscanService } from './acquiscan.service';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AcquiscanResolver {
  constructor(private readonly acquiscanService: AcquiscanService) {}

  @Query(() => [AcquiscanAddressSuggestion], { name: 'acquiscanAddressSuggestions' })
  @Roles('admin', 'directeur')
  searchAddressSuggestions(@Args('input') input: AcquiscanAddressSearchInput) {
    return this.acquiscanService.searchAddressSuggestions(input);
  }

  @Query(() => AcquiscanAddressesPage, { name: 'acquiscanAddresses' })
  @Roles('admin', 'directeur')
  findAddresses(@Args('input') input: AcquiscanAddressesInput) {
    return this.acquiscanService.findAddresses(input);
  }

  @Query(() => AcquiscanDepartmentOpportunitiesPage, { name: 'acquiscanDepartmentOpportunities' })
  @Roles('admin', 'directeur')
  findDepartmentOpportunities() {
    return this.acquiscanService.findDepartmentOpportunities();
  }

  @Query(() => AcquiscanCommuneOpportunitiesPage, { name: 'acquiscanCommuneOpportunities' })
  @Roles('admin', 'directeur')
  findCommuneOpportunities(@Args('input') input: AcquiscanCommuneOpportunitiesInput) {
    return this.acquiscanService.findCommuneOpportunities(input);
  }

  @Query(() => AcquiscanCopperBuildingsPage, { name: 'acquiscanCopperBuildings' })
  @Roles('admin', 'directeur')
  findCopperBuildingOpportunities(@Args('input') input: AcquiscanCopperBuildingsInput) {
    return this.acquiscanService.findCopperBuildingOpportunities(input);
  }

  @Query(() => AcquiscanMapResult, { name: 'acquiscanMapAddresses' })
  @Roles('admin', 'directeur')
  findMapAddresses(@Args('input') input: AcquiscanMapInput) {
    return this.acquiscanService.findMapAddresses(input);
  }
}
