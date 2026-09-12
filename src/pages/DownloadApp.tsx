import React from "react";
import { Download, ShieldCheck, Smartphone, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DownloadApp() {
  // Arquivo servido direto da pasta pública do próprio sistema
  const APK_LINK = "/apk/undoing-app.apk";

  return (
    <div className="container max-w-4xl mx-auto py-12 px-4">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Baixe o App Oficial Undoing
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Tenha a melhor experiência com máxima segurança, rodando nativamente no seu celular Android.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <Card className="border-primary/20 shadow-lg relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
          <CardHeader>
            <Smartphone className="w-12 h-12 text-primary mb-4" />
            <CardTitle className="text-2xl">Undoing Seguro</CardTitle>
            <CardDescription>Versão recomendada para Android</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ul className="space-y-3">
              <li className="flex items-center gap-3">
                <ShieldCheck className="text-emerald-500 w-5 h-5 flex-shrink-0" />
                <span className="text-sm">Blindagem Total de Tela (Impede Prints e Gravações de Tela nativamente)</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle2 className="text-emerald-500 w-5 h-5 flex-shrink-0" />
                <span className="text-sm">Desempenho fluído e renderização de hardware dedicada</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle2 className="text-emerald-500 w-5 h-5 flex-shrink-0" />
                <span className="text-sm">Notificações Push nativas e precisas</span>
              </li>
            </ul>

            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-4">
                * Para instalar, acesse este link pelo celular e permita a instalação de "Fontes Desconhecidas" nas configurações.
              </p>
              <a href={APK_LINK} target="_blank" rel="noopener noreferrer">
                <Button className="w-full gap-2 text-md h-12 font-bold shadow-md hover:shadow-lg transition-shadow">
                  <Download className="w-5 h-5" />
                  Baixar APK Oficial
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-muted/50 border-none">
            <CardHeader>
              <CardTitle className="text-lg">Como instalar no Android?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">1</div>
                <div>
                  <p className="font-medium">Baixe o Arquivo</p>
                  <p className="text-sm text-muted-foreground">Clique no botão de download e aguarde o arquivo .apk ser transferido.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">2</div>
                <div>
                  <p className="font-medium">Permita Instalação</p>
                  <p className="text-sm text-muted-foreground">Ao abrir o arquivo, o Android perguntará se você permite instalar apps de fontes desconhecidas (seu navegador). Clique em <strong>Permitir</strong>.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">3</div>
                <div>
                  <p className="font-medium">Pronto!</p>
                  <p className="text-sm text-muted-foreground">O app estará na sua tela inicial com proteção bancária contra interceptadores e captura de tela.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
