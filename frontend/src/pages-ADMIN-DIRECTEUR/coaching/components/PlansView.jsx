import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Loader2, Sparkles, Target } from 'lucide-react'
import { FieldBlock, InlineEmptyState } from './CoachingShared'

export default function PlansView({ logic }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
      <Card className="border-border/70">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle>Créer un plan de vente</CardTitle>
              <CardDescription>
                Chaque étape saisie devient un critère évalué dans le rapport coaching.
              </CardDescription>
            </div>
            {logic.canUseDevPrefill ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={logic.fillDevSalesPlan}
                disabled={logic.submitting}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Préremplir dev
              </Button>
            ) : null}
          </div>
          {logic.canUseDevPrefill ? (
            <div className="text-xs text-muted-foreground">
              Le préremplissage sert uniquement au staging et au test rapide du flow.
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-5">
          <FieldBlock label="Nom du plan">
            <Input
              value={logic.planForm.nom}
              onChange={event =>
                logic.setPlanForm(current => ({ ...current, nom: event.target.value }))
              }
              placeholder="Plan vente terrain énergie, fibre, closing manager..."
            />
          </FieldBlock>

          <FieldBlock label="Description">
            <Textarea
              value={logic.planForm.description}
              onChange={event =>
                logic.setPlanForm(current => ({ ...current, description: event.target.value }))
              }
              placeholder="Objectif du plan, cible, contexte, variantes utiles"
              className="min-h-[84px]"
            />
          </FieldBlock>

          <FieldBlock label="Consigne LLM">
            <Textarea
              value={logic.planForm.promptInstructions}
              onChange={event =>
                logic.setPlanForm(current => ({
                  ...current,
                  promptInstructions: event.target.value,
                }))
              }
              placeholder="Précisions d’évaluation métier, ton attendu, règles internes..."
              className="min-h-[96px]"
            />
          </FieldBlock>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium">Étapes du plan</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {logic.planForm.steps.length} étape(s). Chaque titre rempli sera évalué.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={logic.addStep}>
                Ajouter une étape
              </Button>
            </div>

            {logic.planForm.steps.map((step, index) => (
              <div
                key={index}
                className="rounded-lg border border-border/70 bg-background px-4 py-4"
              >
                <div className="grid gap-4 md:grid-cols-[1fr_120px]">
                  <FieldBlock label={`Titre étape ${index + 1}`}>
                    <Input
                      value={step.titre}
                      onChange={event => logic.updateStep(index, 'titre', event.target.value)}
                      placeholder="Validation du décideur, pitch tarif, preuve sociale..."
                    />
                  </FieldBlock>
                  <FieldBlock label="Poids">
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={step.poids}
                      onChange={event => logic.updateStep(index, 'poids', event.target.value)}
                    />
                  </FieldBlock>
                </div>

                <div className="mt-4">
                  <FieldBlock label="Description">
                    <Textarea
                      value={step.description}
                      onChange={event => logic.updateStep(index, 'description', event.target.value)}
                      placeholder="Ce que le commercial doit réussir dans cette étape."
                      className="min-h-[72px]"
                    />
                  </FieldBlock>
                </div>

                <div className="mt-4">
                  <FieldBlock label="Signaux attendus">
                    <Textarea
                      value={step.expectedSignals}
                      onChange={event =>
                        logic.updateStep(index, 'expectedSignals', event.target.value)
                      }
                      placeholder="Mots clés, preuves, objections, comportements observables"
                      className="min-h-[72px]"
                    />
                  </FieldBlock>
                </div>

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => logic.duplicateStep(index)}
                  >
                    Dupliquer
                  </Button>
                  {logic.planForm.steps.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => logic.removeStep(index)}
                    >
                      Retirer
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <Button
            type="button"
            className="w-full"
            onClick={logic.createPlan}
            disabled={logic.submitting || !logic.planForm.nom.trim() || !logic.planHasNamedStep}
          >
            {logic.submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Target className="mr-2 h-4 w-4" />
            )}
            Créer et publier le plan
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Plans disponibles</CardTitle>
          <CardDescription>
            Versions existantes, statut de publication et étapes actuellement exploitées.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {logic.plans.map(plan => (
            <div
              key={plan.id}
              className="rounded-lg border border-border/70 bg-background px-4 py-4"
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-base font-semibold">{plan.nom}</div>
                  {plan.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                  ) : null}
                </div>
                <Badge variant="outline">{plan.status}</Badge>
              </div>

              <div className="mt-4 space-y-3">
                {plan.versions.map(version => (
                  <div key={version.id} className="rounded-lg bg-muted/35 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium">
                        {version.label || `Version ${version.versionNumber}`}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{version.status}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {version.steps.length} étapes
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      {version.steps.map(step => (
                        <div
                          key={step.id}
                          className="rounded-md border border-border/60 bg-background px-3 py-3"
                        >
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                            <div className="text-sm font-medium">
                              {step.ordre}. {step.titre}
                            </div>
                            <Badge variant="secondary">poids {step.poids}</Badge>
                          </div>
                          {step.description ? (
                            <p className="mt-2 text-xs text-muted-foreground">{step.description}</p>
                          ) : null}
                          {step.expectedSignals ? (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {step.expectedSignals}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {logic.plans.length === 0 ? (
            <InlineEmptyState text="Aucun plan de vente n’a encore été créé." />
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
