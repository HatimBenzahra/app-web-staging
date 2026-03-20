import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { LoginInput } from './dto/login.input';
import { AuthResponse, UserInfo } from './auth.types';
import { CurrentUser } from './decorators/current-user.decorator';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => AuthResponse)
  async login(
    @Args('loginInput') loginInput: LoginInput,
  ): Promise<AuthResponse> {
    return this.authService.login(loginInput);
  }

  @Mutation(() => AuthResponse)
  async refreshToken(
    @Args('refreshToken') refreshToken: string,
  ): Promise<AuthResponse> {
    return this.authService.refreshToken(refreshToken);
  }
  //Ajout d'une nouvelle methode pour recuperer les informations de l'utilisateur connecte qui ne se base pas sur l'id mais directement sur l'email
  @Query(() => UserInfo)
  @UseGuards(JwtAuthGuard)
  async me(
    @CurrentUser() user: { id: number; role: string; email: string },
  ): Promise<UserInfo> {
    return {
      id: user.id,
      role: user.role,
      email: user.email,
    };
  }
}
