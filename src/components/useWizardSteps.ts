"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Etapas de um wizard em memória, integradas ao histórico do navegador:
 * avançar cria uma entrada no histórico, e o "voltar" do celular volta uma etapa.
 * Se a etapa inicial veio restaurada (sem entradas empilhadas), voltar só troca a etapa.
 */
export function useWizardSteps(initialStep = 1, onChange?: () => void) {
  const [step, setStep] = useState(initialStep);
  const pushed = useRef(0);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const s = (e.state as { wizardStep?: number } | null)?.wizardStep;
      if (typeof s !== "number") return;
      pushed.current = Math.max(0, pushed.current - 1);
      onChangeRef.current?.();
      setStep(s);
    };
    window.history.replaceState({ ...window.history.state, wizardStep: initialStep }, "");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [initialStep]);

  function go(n: number) {
    onChangeRef.current?.();
    window.scrollTo({ top: 0 });
    if (n < step && pushed.current > 0) {
      window.history.back();
      return;
    }
    if (n > step) {
      window.history.pushState({ ...window.history.state, wizardStep: n }, "");
      pushed.current += 1;
    } else {
      window.history.replaceState({ ...window.history.state, wizardStep: n }, "");
    }
    setStep(n);
  }

  return { step, go };
}
