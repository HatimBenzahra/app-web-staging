import { Resolver, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { CreationCompteService } from './creation_compte.service';
import {
  CreerUtilisateurInput,
  ReponseCreationUtilisateur,
  SupprimerUtilisateurInput,
  ReponseSupprimerUtilisateur,
  ModifierUtilisateurInput,
  ReponseModifierUtilisateur,
} from './creation_compte.dto';
import { CreationCompteGuard } from './creation_compte.guard';

@Resolver()
export class CreationCompteResolver {
  constructor(private readonly creationCompteService: CreationCompteService) {}

  @Mutation(() => ReponseCreationUtilisateur)
  @UseGuards(CreationCompteGuard)
  async creerUtilisateurProWin(
    @Args('input') input: CreerUtilisateurInput,
    @Context() context: any,
  ): Promise<ReponseCreationUtilisateur> {
    const adminToken = context.req.user.token;
    return this.creationCompteService.creerCompteProWin(input, adminToken);
  }

  @Mutation(() => ReponseSupprimerUtilisateur)
  @UseGuards(CreationCompteGuard)
  async supprimerUtilisateur(
    @Args('input') input: SupprimerUtilisateurInput,
    @Context() context: any,
  ): Promise<ReponseSupprimerUtilisateur> {
    const adminToken = context.req.user.token;
    return this.creationCompteService.supprimerUtilisateur(input, adminToken);
  }

  @Mutation(() => ReponseModifierUtilisateur)
  @UseGuards(CreationCompteGuard)
  async modifierUtilisateur(
    @Args('input') input: ModifierUtilisateurInput,
    @Context() context: any,
  ): Promise<ReponseModifierUtilisateur> {
    const adminToken = context.req.user.token;
    return this.creationCompteService.modifierUtilisateur(input, adminToken);
  }
}
