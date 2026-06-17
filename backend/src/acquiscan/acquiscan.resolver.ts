import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AcquiscanAddressesInput, AcquiscanAddressesPage, AcquiscanImportStatus } from './acquiscan.dto';
import { AcquiscanService } from './acquiscan.service';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AcquiscanResolver {
  constructor(private readonly acquiscanService: AcquiscanService) {}

  @Query(() => AcquiscanAddressesPage, { name: 'acquiscanAddresses' })
  @Roles('admin', 'directeur')
  findAddresses(@Args('input') input: AcquiscanAddressesInput) {
    return this.acquiscanService.findAddresses(input);
  }

  @Mutation(() => AcquiscanImportStatus)
  @Roles('admin', 'directeur')
  importAcquiscanCoordinates(@Args('dept') dept: string) {
    return this.acquiscanService.importCoordinatesForDepartment(dept);
  }
}
