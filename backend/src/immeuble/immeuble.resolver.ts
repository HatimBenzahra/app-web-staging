import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ImmeubleService } from './immeuble.service';
import {
  Immeuble,
  CreateImmeubleInput,
  UpdateImmeubleInput,
} from './immeuble.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Resolver(() => Immeuble)
@UseGuards(JwtAuthGuard, RolesGuard)
export class ImmeubleResolver {
  constructor(private readonly immeubleService: ImmeubleService) {}

  @Mutation(() => Immeuble)
  @Roles('admin', 'directeur', 'manager', 'commercial')
  createImmeuble(
    @Args('createImmeubleInput') createImmeubleInput: CreateImmeubleInput,
  ) {
    return this.immeubleService.create(createImmeubleInput);
  }

  @Query(() => [Immeuble], { name: 'immeubles' })
  @Roles('admin', 'directeur', 'manager', 'commercial')
  findAll(@CurrentUser() user: any) {
    return this.immeubleService.findAll(user.id, user.role);
  }

  @Query(() => Immeuble, { name: 'immeuble' })
  @Roles('admin', 'directeur', 'manager', 'commercial')
  findOne(@Args('id', { type: () => Int }) id: number, @CurrentUser() user: any) {
    return this.immeubleService.findOne(id, user.id, user.role);
  }

  @Mutation(() => Immeuble)
  @Roles('admin', 'directeur', 'manager', 'commercial')
  updateImmeuble(
    @Args('updateImmeubleInput') updateImmeubleInput: UpdateImmeubleInput,
    @CurrentUser() user: any,
  ) {
    return this.immeubleService.update(updateImmeubleInput, user.id, user.role);
  }

  @Mutation(() => Immeuble)
  @Roles('admin', 'directeur')
  removeImmeuble(@Args('id', { type: () => Int }) id: number, @CurrentUser() user: any) {
    return this.immeubleService.remove(id, user.id, user.role);
  }

  @Mutation(() => Immeuble)
  @Roles('admin', 'directeur', 'manager', 'commercial')
  addPorteToEtage(
    @Args('immeubleId', { type: () => Int }) immeubleId: number,
    @Args('etage', { type: () => Int }) etage: number,
    @CurrentUser() user: any,
  ) {
    return this.immeubleService.addPorteToEtage(immeubleId, etage, user.id, user.role);
  }

  @Mutation(() => Immeuble)
  @Roles('admin', 'directeur', 'manager', 'commercial')
  removePorteFromEtage(
    @Args('immeubleId', { type: () => Int }) immeubleId: number,
    @Args('etage', { type: () => Int }) etage: number,
    @CurrentUser() user: any,
  ) {
    return this.immeubleService.removePorteFromEtage(immeubleId, etage, user.id, user.role);
  }

  @Mutation(() => Immeuble)
  @Roles('admin', 'directeur', 'manager', 'commercial')
  addEtageToImmeuble(@Args('id', { type: () => Int }) id: number, @CurrentUser() user: any) {
    return this.immeubleService.addEtage(id, user.id, user.role);
  }

  @Mutation(() => Immeuble)
  @Roles('admin', 'directeur', 'manager', 'commercial')
  removeEtageFromImmeuble(@Args('id', { type: () => Int }) id: number, @CurrentUser() user: any) {
    return this.immeubleService.removeEtage(id, user.id, user.role);
  }
}
