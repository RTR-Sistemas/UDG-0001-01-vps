import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { X, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MOBILE_TUTORIAL_STEPS } from "./TutorialSteps";
import { useAuth } from "@/hooks/useAuth";

const TUTORIAL_STORAGE_KEY = "udg_mobile_tutorial_done";

export function MobileTutorial() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);

    useEffect(() => {
        // Só roda em mobile/tablet (< 1024px) e se o usuário estiver logado
        if (window.innerWidth >= 1024 || !user) return;

        // Checa primeira visita
        const hasSeen = localStorage.getItem(TUTORIAL_STORAGE_KEY);
        if (!hasSeen) {
            setIsOpen(true);
        }
    }, [user]);

    // Quando o passo muda, navegar para a rota demonstrada naquele passo
    useEffect(() => {
        if (!isOpen) return;
        const stepData = MOBILE_TUTORIAL_STEPS[currentStep];
        if (location.pathname !== stepData.route) {
            navigate(stepData.route);
        }
    }, [currentStep, isOpen, navigate, location.pathname]);

    const closeTutorial = () => {
        localStorage.setItem(TUTORIAL_STORAGE_KEY, "true");
        setIsOpen(false);
    };

    const handleNext = () => {
        if (currentStep < MOBILE_TUTORIAL_STEPS.length - 1) {
            setCurrentStep((prev) => prev + 1);
        } else {
            closeTutorial();
            navigate("/"); // Volta ao início no final
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep((prev) => prev - 1);
        }
    };

    if (!isOpen) return null;

    const stepData = MOBILE_TUTORIAL_STEPS[currentStep];
    const isLast = currentStep === MOBILE_TUTORIAL_STEPS.length - 1;

    return (
        <div className="fixed inset-0 z-[100] pointer-events-none flex flex-col justify-end">
            {/* Dark overlay backdrop to block user interaction with UI underneath */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-[2px] pointer-events-auto transition-opacity duration-300"
                onClick={closeTutorial} // Failsafe, mas normalmente usamos os botões
            />

            {/* Tutorial Card */}
            <div className="relative z-[101] w-full px-4 pb-8 pointer-events-auto animate-in slide-in-from-bottom-8 duration-500 fade-in">
                <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${stepData.gradient} text-white shadow-2xl border border-white/20 p-6`}>

                    {/* Skip Button */}
                    <button
                        onClick={closeTutorial}
                        className="absolute top-4 right-4 p-1.5 rounded-full bg-black/20 hover:bg-black/40 transition-colors backdrop-blur-md"
                    >
                        <X className="w-5 h-5 text-white/90" />
                    </button>

                    <p className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-2">
                        Tour do UndoinG • Passo {currentStep + 1} de {MOBILE_TUTORIAL_STEPS.length}
                    </p>

                    <div className="flex flex-col items-center justify-center py-4 mb-4">
                        <div className="bg-white/20 p-4 rounded-full shadow-lg backdrop-blur-md border border-white/10 shrink-0 transform hover:scale-105 transition-transform">
                            {stepData.icon}
                        </div>

                        <div className="mt-4 text-center">
                            <h3 className="text-2xl font-bold mb-2 leading-tight">
                                {stepData.title}
                            </h3>
                            <p className="text-white/80 leading-relaxed text-sm">
                                {stepData.description}
                            </p>
                        </div>
                    </div>

                    {/* Progress Indicator */}
                    <div className="flex items-center justify-center gap-1.5 mb-6">
                        {MOBILE_TUTORIAL_STEPS.map((_, idx) => (
                            <div
                                key={idx}
                                className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentStep ? "w-6 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" :
                                    idx < currentStep ? "w-2 bg-white/50" : "w-1.5 bg-white/20"
                                    }`}
                            />
                        ))}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 justify-between items-center w-full mt-2">
                        <Button
                            variant="ghost"
                            className="text-white hover:bg-white/10 hover:text-white px-3 flex-1 justify-center rounded-xl font-medium"
                            onClick={handlePrev}
                            disabled={currentStep === 0}
                        >
                            <ChevronLeft className="w-4 h-4 mr-1" />
                            Voltar
                        </Button>

                        <Button
                            variant="default"
                            className="bg-white text-black hover:bg-gray-100 flex-1 justify-center rounded-xl font-bold shadow-lg"
                            onClick={handleNext}
                        >
                            {isLast ? "Começar!" : "Próximo"}
                            {isLast ? <Check className="w-4 h-4 ml-2" /> : <ChevronRight className="w-4 h-4 ml-1" />}
                        </Button>
                    </div>

                </div>
            </div>
        </div>
    );
}
