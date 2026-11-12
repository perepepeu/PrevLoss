import { useCallback, useEffect, useRef, useState } from 'react';

export const ONBOARDING_KEY = 'prevloss:onboarding:v2';

type TourStep = {
  title: string;
  text: string;
  target: string;
  label: string;
};

const steps: TourStep[] = [
  {
    title: 'Bem-vindo ao prevLoss',
    text: 'Aqui você acompanha a condição de um conjunto motor-bomba e compara diferentes cenários de operação.',
    target: '[data-tour="brand"]',
    label: 'Visão geral',
  },
  {
    title: 'Prepare a linha de base',
    text: 'No primeiro uso, inicie a coleta de 60 leituras. Essa linha de base é a referência usada para comparar os cenários.',
    target: '[data-tour="operation"]',
    label: 'Primeiro passo',
  },
  {
    title: 'Escolha e controle o cenário',
    text: 'Selecione o comportamento da bomba e use o botão principal para iniciar, pausar ou retomar. “Nova execução” reinicia o cenário sem apagar a linha de base.',
    target: '[data-tour="controls"]',
    label: 'Operação',
  },
  {
    title: 'Acompanhe as medições',
    text: 'Temperatura, vibração, corrente e pressão são atualizadas durante a execução. A unidade aparece junto de cada valor.',
    target: '[data-tour="sensors"]',
    label: 'Medições',
  },
  {
    title: 'Entenda a condição',
    text: 'O ISE resume a condição de 0 a 100. A classificação, as contribuições e os alertas vêm do servidor; um alerta pode aparecer mesmo com ISE Normal.',
    target: '[data-tour="condition"]',
    label: 'ISE e alertas',
  },
  {
    title: 'Consulte a evolução',
    text: 'Os gráficos mostram as últimas leituras. Em Histórico, você pode voltar a qualquer execução da sessão sem alterar a operação atual.',
    target: '[data-tour="history"]',
    label: 'Gráficos e histórico',
  },
];

export function shouldStartOnboarding() {
  try {
    return localStorage.getItem(ONBOARDING_KEY) !== 'complete';
  } catch {
    return true;
  }
}

export function completeOnboarding() {
  try {
    localStorage.setItem(ONBOARDING_KEY, 'complete');
  } catch {
    // A experiência continua funcionando mesmo se o navegador bloquear armazenamento local.
  }
}

export function OnboardingTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const step = steps[stepIndex];
  const finish = useCallback(() => {
    completeOnboarding();
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    setStepIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const target = document.querySelector<HTMLElement>(step.target);
    target?.classList.add('tour-target-active');
    if (stepIndex === 0) window.scrollTo({ top: 0, behavior: 'auto' });
    else target?.scrollIntoView?.({
      behavior: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'center',
    });
    panel.current?.focus({ preventScroll: true });
    return () => target?.classList.remove('tour-target-active');
  }, [open, step, stepIndex]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [finish, open]);

  if (!open) return null;
  const last = stepIndex === steps.length - 1;

  return <div className="tour-layer" role="presentation">
    <div className="tour-backdrop" aria-hidden="true" />
    <div className="tour-panel" role="dialog" aria-modal="true" aria-labelledby="tour-title" ref={panel} tabIndex={-1}>
      <div className="tour-brand">
        <span className="tour-logo" aria-hidden="true" />
        <div><strong>prevLoss</strong><span>{step.label}</span></div>
        <button className="tour-skip" onClick={finish}>Pular tutorial</button>
      </div>
      <div className="tour-progress" aria-label={`Passo ${stepIndex + 1} de ${steps.length}`}>
        <span>Passo {stepIndex + 1} de {steps.length}</span>
        <div>{steps.map((item, index) => <i key={item.title} className={index <= stepIndex ? 'done' : ''} />)}</div>
      </div>
      <h2 id="tour-title">{step.title}</h2>
      <p>{step.text}</p>
      <div className="tour-actions">
        <button disabled={stepIndex === 0} onClick={() => setStepIndex(index => index - 1)}>Voltar</button>
        <button className="primary" onClick={() => last ? finish() : setStepIndex(index => index + 1)}>{last ? 'Começar a usar' : 'Próximo'}</button>
      </div>
    </div>
  </div>;
}
