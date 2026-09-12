import React, { useState } from "react";
import { Monitor, Smartphone, Apple, ShieldCheck, CheckCircle2, Download, ArrowLeft, Share, PlusSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DownloadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DownloadModal({ open, onOpenChange }: DownloadModalProps) {
  const [selectedOS, setSelectedOS] = useState<'none' | 'android' | 'ios' | 'pc'>('none');
  const APK_LINK = "/apk/undoing-app.apk";

  // Reset state when closing
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setTimeout(() => setSelectedOS('none'), 300);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl bg-background border-border shadow-2xl p-0 overflow-hidden">
        {selectedOS === 'none' ? (
          <div className="p-6">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Instalar o Aplicativo
              </DialogTitle>
              <DialogDescription className="text-base text-muted-foreground">
                Escolha o seu dispositivo abaixo para ver o passo a passo de como instalar a UndoinG.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button 
                onClick={() => setSelectedOS('android')}
                className="flex flex-col items-center justify-center p-6 border rounded-2xl bg-card hover:bg-muted/50 hover:border-primary/50 transition-all group"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Smartphone className="w-8 h-8 text-emerald-500" />
                </div>
                <h3 className="font-bold text-lg">Android</h3>
                <p className="text-xs text-muted-foreground text-center mt-2">App Nativo Seguro (APK)</p>
              </button>

              <button 
                onClick={() => setSelectedOS('ios')}
                className="flex flex-col items-center justify-center p-6 border rounded-2xl bg-card hover:bg-muted/50 hover:border-primary/50 transition-all group"
              >
                <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Apple className="w-8 h-8 text-blue-500" />
                </div>
                <h3 className="font-bold text-lg">iPhone / iOS</h3>
                <p className="text-xs text-muted-foreground text-center mt-2">Instalar via Safari</p>
              </button>

              <button 
                onClick={() => setSelectedOS('pc')}
                className="flex flex-col items-center justify-center p-6 border rounded-2xl bg-card hover:bg-muted/50 hover:border-primary/50 transition-all group"
              >
                <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Monitor className="w-8 h-8 text-purple-500" />
                </div>
                <h3 className="font-bold text-lg">PC / Desktop</h3>
                <p className="text-xs text-muted-foreground text-center mt-2">Instalar via navegador</p>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full max-h-[80vh]">
            <DialogTitle className="sr-only">Tutorial de Instalação</DialogTitle>
            <div className="p-4 border-b flex items-center gap-3 bg-muted/20">
              <Button variant="ghost" size="icon" onClick={() => setSelectedOS('none')} className="rounded-full hover:bg-muted">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h2 className="font-bold text-lg">
                Tutoriais de Instalação - {
                  selectedOS === 'android' ? 'Android' :
                  selectedOS === 'ios' ? 'iPhone/iOS' : 'PC/Desktop'
                }
              </h2>
            </div>

            <div className="p-6 overflow-y-auto">
              {/* ANDROID TUTORIAL (Preserved and enhanced) */}
              {selectedOS === 'android' && (
                <div className="space-y-6">
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 mb-6">
                    <h3 className="flex items-center gap-2 font-bold text-lg text-primary mb-3">
                      <ShieldCheck className="w-6 h-6" /> Undoing Seguro (App Oficial)
                    </h3>
                    <ul className="space-y-3 mb-5">
                      <li className="flex items-center gap-3">
                        <CheckCircle2 className="text-emerald-500 w-5 h-5 flex-shrink-0" />
                        <span className="text-sm">Blindagem de Tela contra gravação e capturas (Prints)</span>
                      </li>
                      <li className="flex items-center gap-3">
                        <CheckCircle2 className="text-emerald-500 w-5 h-5 flex-shrink-0" />
                        <span className="text-sm">Notificações Push nativas e precisas</span>
                      </li>
                    </ul>
                    <a href={APK_LINK} target="_blank" rel="noopener noreferrer">
                      <Button className="w-full h-12 font-bold shadow-md hover:shadow-lg transition-all text-md gap-2">
                        <Download className="w-5 h-5" /> Baixar APK Oficial
                      </Button>
                    </a>
                  </div>

                  <h4 className="font-bold text-lg border-b pb-2">Passo a Passo de Instalação</h4>
                  <div className="space-y-5">
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">1</div>
                      <div>
                        <p className="font-medium">Baixe o Arquivo</p>
                        <p className="text-sm text-muted-foreground mt-1">Clique no botão de download acima e aguarde o download da UndoinG.apk acabar.</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">2</div>
                      <div>
                        <p className="font-medium">Permita Fontes Desconhecidas</p>
                        <p className="text-sm text-muted-foreground mt-1">Ao tocar em instalar, o Android perguntará se confia no seu navegador. Ative a chave <strong>Permitir desta fonte</strong> e volte.</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">3</div>
                      <div>
                        <p className="font-medium">Pronto!</p>
                        <p className="text-sm text-muted-foreground mt-1">Abra o aplicativo na sua tela inicial e desfrute do sistema com blindagem máxima.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* iOS TUTORIAL */}
              {selectedOS === 'ios' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-center mb-6">
                    <div className="w-20 h-20 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shadow-lg">
                      <Apple className="w-10 h-10 text-blue-500" />
                    </div>
                  </div>
                  
                  <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-5 mb-6">
                    <h3 className="font-bold text-lg text-blue-500 mb-2">Instalação via Safari</h3>
                    <p className="text-sm text-muted-foreground">O ecossistema iOS restringe aplicativos nativos baixados pela web, mas instalando como WebApp (PWA), a UndoinG rodará perfeitamente como um aplicativo de tela cheia com acesso a câmera e recursos visuais no seu iPhone ou iPad.</p>
                  </div>

                  <h4 className="font-bold text-lg border-b pb-2">Passo a Passo (iPhone/iPad)</h4>
                  <div className="space-y-5">
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold flex-shrink-0">1</div>
                      <div>
                        <p className="font-medium">Navegador Certo</p>
                        <p className="text-sm text-muted-foreground mt-1">Tenha certeza que acessou a `undoing.com.br` pelo navegador nativo <strong>Safari</strong> do seu iPhone.</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold flex-shrink-0">2</div>
                      <div>
                        <p className="font-medium flex items-center gap-1.5">Toque em Compartilhar <Share className="w-4 h-4 text-blue-500" /></p>
                        <p className="text-sm text-muted-foreground mt-1">No rodapé da tela do Safari, localize o ícone de Compartilhar (o quadradinho com uma seta apontando para cima).</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold flex-shrink-0">3</div>
                      <div>
                        <p className="font-medium flex items-center gap-1.5">Adicionar à Tela de Início <PlusSquare className="w-4 h-4 text-blue-500" /></p>
                        <p className="text-sm text-muted-foreground mt-1">Role o menu levemente para baixo e clique em <strong>Adicionar à Tela de Início</strong> (Add to Home Screen). Depois confirme em "Adicionar" no topo direito.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* PC TUTORIAL */}
              {selectedOS === 'pc' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-center mb-6">
                    <div className="w-full max-w-sm border rounded-xl overflow-hidden shadow-lg">
                      <div className="bg-muted h-8 flex items-center px-4 border-b">
                        <div className="flex gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-red-400"></div><div className="w-3 h-3 rounded-full bg-amber-400"></div><div className="w-3 h-3 rounded-full bg-green-400"></div>
                        </div>
                        <div className="mx-auto flex items-center justify-end px-3 bg-background rounded-md text-[10px] text-muted-foreground w-1/2 h-5 border relative">
                           <Download className="w-3 h-3 text-primary absolute right-2" />
                        </div>
                      </div>
                      <div className="bg-card h-24 flex items-center justify-center">
                         <span className="text-primary font-bold">UndoinG</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-5 mb-6">
                    <h3 className="font-bold text-lg text-purple-500 mb-2">Instalação Desktop (Windows/Mac)</h3>
                    <p className="text-sm text-muted-foreground">Experimente uma navegação idêntica a de um software convencional. Ao instalar, a plataforma vai abrir em janela própria fora do navegador e ficará acessível ali mesmo no seu Menu Iniciar.</p>
                  </div>

                  <h4 className="font-bold text-lg border-b pb-2">Via Chrome, Edge ou Brave</h4>
                  <div className="space-y-5">
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold flex-shrink-0">1</div>
                      <div>
                        <p className="font-medium">Faça Login na UndoinG</p>
                        <p className="text-sm text-muted-foreground mt-1">Navegue na plataforma usando seu computador.</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold flex-shrink-0">2</div>
                      <div>
                        <p className="font-medium">O botão Mágico de Instalar</p>
                        <p className="text-sm text-muted-foreground mt-1">Lá no topo da tela do seu navegador, repare no lado direito da barra de links. Haverá um ícone de "Um Computador com uma setinha" (ou um +, dependendo da versão do navegador). Clique nele.</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold flex-shrink-0">3</div>
                      <div>
                        <p className="font-medium">Instalar</p>
                        <p className="text-sm text-muted-foreground mt-1">Aparecerá a mensagem perguntando se quer instalar o App "UndoinG". Confirme! O atalho será salvo em sua área de trabalho.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
