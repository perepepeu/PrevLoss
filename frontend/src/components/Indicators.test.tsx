import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActiveAlerts, CalibrationStatus, HealthPanel, SensorCards } from './Indicators';
import { fixture } from '../test/fixtures';

describe('Apresentação fiel aos dados', () => {
  it.each([[0, 'Crítico'], [49.99, 'Crítico'], [50, 'Atenção'], [50.01, 'Atenção'], [79.99, 'Atenção'], [80, 'Normal'], [80.01, 'Normal'], [100, 'Normal']] as const)('apresenta ISE %s e classe recebida', (ise, classificacao) => {
    const state = fixture('normal'); state.ultima_leitura!.ise = ise; state.ultima_leitura!.classificacao = classificacao;
    render(<HealthPanel reading={state.ultima_leitura}/>);
    expect(screen.getByTestId('ise-value')).toHaveTextContent(ise.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    expect(screen.getByText(classificacao)).toBeVisible();
  });
  it.each(['dado-ausente', 'dado-invalido'])('%s deixa índice indisponível', name => {
    const state = fixture(name); render(<><HealthPanel reading={state.ultima_leitura}/><SensorCards reading={state.ultima_leitura}/></>);
    expect(screen.getByTestId('ise-value')).toHaveTextContent('—');
    expect(screen.getByText('Indisponível')).toBeVisible();
    expect(screen.queryByText('Normal')).not.toBeInTheDocument();
  });
  it('mantém alerta individual com ISE Normal', () => {
    const state = fixture('normal-com-alerta-individual');
    render(<><HealthPanel reading={state.ultima_leitura}/><ActiveAlerts alerts={state.alertas_ativos} reading={state.ultima_leitura} available/></>);
    expect(screen.getByText('Normal')).toBeVisible();
    expect(screen.getByText(state.alertas_ativos[0].mensagem.replace(/^Ambiente simulado:\s*/, ''))).toBeVisible();
  });
  it('explica empate nas contribuições', () => {
    const state = fixture('normal'); state.ultima_leitura!.contribuicoes_perda!.principais = ['temperatura', 'vibracao'];
    render(<HealthPanel reading={state.ultima_leitura}/>);
    expect(screen.getByText(/Maior contribuição: Temperatura e Vibração/)).toBeVisible();
  });
  it('informa novo teste pausado sem inventar leitura', () => {
    render(<CalibrationStatus state={fixture('execucao-nova-pausada')}/>);
    expect(screen.getByText('Linha de base concluída. Inicie o monitoramento.')).toBeVisible();
  });
  it('exibe progresso de referência', () => {
    render(<CalibrationStatus state={fixture('calibracao-24-de-60')}/>);
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '24');
  });
});
