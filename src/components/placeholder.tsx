import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Tela provisória enquanto a etapa correspondente não é implementada. */
export function Placeholder({ title, stage, items }: { title: string; stage: string; items: string[] }) {
  return (
    <div className="grid grid-cols-1 gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <Card>
        <CardHeader>
          <CardTitle>Em construção</CardTitle>
          <CardDescription>Previsto para a {stage}.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {items.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
