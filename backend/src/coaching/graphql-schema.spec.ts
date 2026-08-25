import { NestFactory } from '@nestjs/core';
import {
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
} from '@nestjs/graphql';
import { printSchema } from 'graphql';
import { CoachingResolver } from './coaching.resolver';
import { SynthesisResolver } from './synthesis.resolver';

/**
 * Garde-fou contre le piège NestJS code-first : un `@Field({ nullable: true })`
 * sur un type string/union nullable sans thunk explicite passe `nest build` mais
 * fait crasher le schéma au RUNTIME (UndefinedTypeError). Ce test construit le
 * schéma pour de vrai, sans DB, et vérifie la surface du coaching.
 */
describe('schéma GraphQL coaching', () => {
  let sdl: string;

  beforeAll(async () => {
    const app = await NestFactory.create(GraphQLSchemaBuilderModule, {
      logger: false,
    });
    await app.init();
    const factory = app.get(GraphQLSchemaFactory);
    sdl = printSchema(
      await factory.create([CoachingResolver, SynthesisResolver]),
    );
    await app.close();
  }, 30_000);

  it('se construit sans UndefinedTypeError', () => {
    expect(sdl.length).toBeGreaterThan(0);
  });

  it.each([
    'CoachingAnalysisDto',
    'CoachingViolationDto',
    'CoachingMappedProductDto',
    'ProductSheetDto',
    'ProductSheetForbiddenDto',
  ])('expose le type %s', (type) => {
    expect(sdl).toContain(`type ${type} {`);
  });

  it.each([
    'scoreBeforeMalus',
    'malus',
    'violations',
    'detectedProducts',
    'productMapping',
  ])(
    'expose CoachingAnalysisDto.%s',
    (field) => {
      const block = /type CoachingAnalysisDto \{([^}]*)\}/.exec(sdl);
      expect(block).not.toBeNull();
      expect(block![1]).toContain(field);
    },
  );

  // Les trois citations doivent remonter jusqu'à l'écran : sans la ligne du plan,
  // un manager ne peut pas discuter l'écart avec son commercial.
  it.each(['quote', 'sheetSays', 'planSays'])(
    'expose CoachingViolationDto.%s',
    (field) => {
      const block = /type CoachingViolationDto \{([^}]*)\}/.exec(sdl);
      expect(block).not.toBeNull();
      expect(block![1]).toContain(field);
    },
  );

  it('expose la requête des fiches produit', () => {
    expect(sdl).toContain('coachingProductSheets');
  });
});
